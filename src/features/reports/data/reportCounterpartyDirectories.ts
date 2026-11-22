import { apiRequest } from '../../../shared/api/apiClient'
import { normalizeClientSearchValue } from '../../clients/api/clientsApi'
import type { Client } from '../../clients/types'
import { searchDatasetReportValues } from '../api/reportsApi'
import { exactId } from './exactId'

export type ReportCounterpartyRole = 'buyer' | 'goods-supplier' | 'service-supplier'

export const REPORT_COUNTERPARTY_ROLES: ReadonlyArray<{ key: ReportCounterpartyRole; label: string }> = [
  { key: 'buyer', label: 'Покупець' },
  { key: 'goods-supplier', label: 'Постачальник товару' },
  { key: 'service-supplier', label: 'Постачальник послуг' },
]

export const REPORT_COUNTERPARTY_PAGE_SIZE = 30
export const REPORT_COUNTERPARTY_LOOKUP_MAX_OFFSET = 10000

const GOODS_SUPPLIER_REGISTRY = '/clients/suppliers/registry/manufacturers'
const REGISTRY_PAGE_SIZE = 100

type ReportCounterparty = { id: string; label: string }
type GoodsSupplier = ReportCounterparty & { searchable: string }
type ReportDirectoryPage = { entries: ReportCounterparty[]; hasMore: boolean }

const searchableText = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase('uk')

function clientDirectoryEntry(client: Client, supplierCode?: string) {
  const id = exactId(client)
  const name = client.Name?.trim() || client.FullName?.trim()
  if (!id || !name) return null
  const sourceCodes = [client.SourceFenixCode && `Fenix ${client.SourceFenixCode}`,
    client.SourceAmgCode && `AMG ${client.SourceAmgCode}`].filter(Boolean).join(' / ')
  const code = supplierCode?.trim() || client.RegionCode?.Value?.trim() || sourceCodes
  return { id, label: [code, name].filter(Boolean).join(' — '), sourceCodes }
}

export async function readGoodsSupplierDirectory(signal: AbortSignal): Promise<GoodsSupplier[]> {
  // This registry covers the 1C supplier folder, including suppliers without receipts.
  const total = await apiRequest<number>(`${GOODS_SUPPLIER_REGISTRY}/total`, { signal })
  if (!Number.isSafeInteger(total) || total < 0) throw new Error('Некоректна кількість постачальників.')

  const entries = new Map<string, GoodsSupplier>()
  for (let offset = 0; offset < total; offset += REGISTRY_PAGE_SIZE) {
    signal.throwIfAborted()
    const page = await apiRequest<Client[]>(`${GOODS_SUPPLIER_REGISTRY}/filtered`, {
      query: { offset, limit: REGISTRY_PAGE_SIZE, value: '' },
      signal,
    })
    for (const supplier of page) {
      const parsed = clientDirectoryEntry(supplier, supplier.SupplierCode)
      if (!parsed) continue
      const { id, label, sourceCodes } = parsed
      entries.set(id, { id, label, searchable: searchableText([label, supplier.FullName, supplier.USREOU,
        supplier.TIN, supplier.RegionCode?.Value, sourceCodes].filter(Boolean).join(' ')) })
    }
    if (page.length < REGISTRY_PAGE_SIZE) break
  }
  return [...entries.values()]
}

export function goodsSupplierDirectoryPage(entries: GoodsSupplier[], query: string, offset: number): ReportDirectoryPage {
  const term = searchableText(normalizeClientSearchValue(query))
  const matching = term ? entries.filter(entry => entry.searchable.includes(term)) : entries
  return { entries: matching.slice(offset, offset + REPORT_COUNTERPARTY_PAGE_SIZE),
    hasMore: offset + REPORT_COUNTERPARTY_PAGE_SIZE < matching.length }
}

export async function searchReportCounterpartyDirectory(role: Exclude<ReportCounterpartyRole, 'goods-supplier'>,
  query: string, offset: number, signal: AbortSignal): Promise<ReportDirectoryPage> {
  const limit = REPORT_COUNTERPARTY_PAGE_SIZE + 1
  if (role === 'buyer') {
    const rows = await apiRequest<Client[]>('/clients/registry/all/filtered', {
      query: {
        filterSql: 'RegionCode.Value/Client.Name/Client.FullName/Client.USREOU/Client.SourceCode',
        typeRoleFilter: '1',
        value: normalizeClientSearchValue(query),
        offset,
        limit,
      },
      signal,
    })
    return { entries: rows.slice(0, REPORT_COUNTERPARTY_PAGE_SIZE).flatMap(row => {
      const entry = clientDirectoryEntry(row)
      return entry ? [{ id: entry.id, label: entry.label }] : []
    }), hasMore: rows.length > REPORT_COUNTERPARTY_PAGE_SIZE }
  }
  const rows = await searchDatasetReportValues(40, 17, { value: query.trim(), offset, limit }, signal)
  return { entries: rows.slice(0, REPORT_COUNTERPARTY_PAGE_SIZE).map(row => ({ id: String(row.Id), label: row.Name as string })),
    hasMore: rows.length > REPORT_COUNTERPARTY_PAGE_SIZE && offset + REPORT_COUNTERPARTY_PAGE_SIZE <= REPORT_COUNTERPARTY_LOOKUP_MAX_OFFSET }
}
