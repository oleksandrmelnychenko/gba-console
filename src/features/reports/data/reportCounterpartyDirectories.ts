import { apiRequest } from '../../../shared/api/apiClient'
import { normalizeClientSearchValue } from '../../clients/api/clientsApi'
import type { Client } from '../../clients/types'
import { searchDatasetReportValues } from '../api/reportsApi'
import type { ReportSelectedValue } from '../types'
import type { ReportCounterpartyRole } from './reportFilterFields'
import { exactId } from './exactId'

export const REPORT_COUNTERPARTY_PAGE_SIZE = 30
export const REPORT_COUNTERPARTY_LOOKUP_MAX_OFFSET = 10000

const GOODS_SUPPLIER_REGISTRY = '/clients/suppliers/registry/manufacturers'
const REGISTRY_PAGE_SIZE = 100

type GoodsSupplier = { entry: ReportSelectedValue; searchable: string }
export type ReportDirectoryPage = { entries: ReportSelectedValue[]; hasMore: boolean }

const searchableText = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase('uk')

function clientDirectoryEntry(client: Client, supplierCode?: string) {
  const id = exactId(client)
  const name = client.Name?.trim() || client.FullName?.trim()
  if (!id || !name) return null
  const sourceCodes = [client.SourceFenixCode && `Fenix ${client.SourceFenixCode}`,
    client.SourceAmgCode && `AMG ${client.SourceAmgCode}`].filter(Boolean).join(' / ')
  const code = supplierCode?.trim() || client.RegionCode?.Value?.trim() || sourceCodes
  return { entry: { Data: { Id: id }, Name: [code, name].filter(Boolean).join(' — '), Value: 0 }, sourceCodes }
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
      const { sourceCodes, entry } = parsed
      entries.set(entry.Data.Id, { entry, searchable: searchableText([entry.Name, supplier.FullName, supplier.USREOU,
        supplier.TIN, supplier.RegionCode?.Value, sourceCodes].filter(Boolean).join(' ')) })
    }
    if (page.length < REGISTRY_PAGE_SIZE) break
  }
  return [...entries.values()]
}

export function goodsSupplierDirectoryPage(entries: GoodsSupplier[], query: string, offset: number): ReportDirectoryPage {
  const term = searchableText(normalizeClientSearchValue(query))
  const matching = term ? entries.filter(entry => entry.searchable.includes(term)) : entries
  return { entries: matching.slice(offset, offset + REPORT_COUNTERPARTY_PAGE_SIZE).map(item => item.entry),
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
      const parsed = clientDirectoryEntry(row)
      return parsed ? [parsed.entry] : []
    }), hasMore: rows.length > REPORT_COUNTERPARTY_PAGE_SIZE }
  }
  const rows = await searchDatasetReportValues(40, 17, { value: query.trim(), offset, limit }, signal)
  return { entries: rows.slice(0, REPORT_COUNTERPARTY_PAGE_SIZE).map(row => ({ Data: row, Name: row.Name as string, Value: 0 })),
    hasMore: rows.length > REPORT_COUNTERPARTY_PAGE_SIZE && offset + REPORT_COUNTERPARTY_PAGE_SIZE <= REPORT_COUNTERPARTY_LOOKUP_MAX_OFFSET }
}
