import { apiRequest } from '../../../shared/api/apiClient'
import { isReportProductLookupSource, type ReportProductLookupSource } from '../data/productLookupCapability'
import { positiveProductId } from '../data/salesProductLookupCapability'
import type { NativeSalesProduct, NativeSalesProductQuery } from './nativeSalesProductLookup'

function readProducts(raw: unknown, limit: number, exactId?: string): NativeSalesProduct[] {
  if (!Array.isArray(raw) || raw.length > limit) throw new Error('Не вдалося прочитати список товарів.')
  const ids = new Set<string>()
  return raw.map(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Не вдалося прочитати список товарів.')
    const item = value as Record<string, unknown>
    if (!positiveProductId(item.Id) || typeof item.Name !== 'string' || typeof item.VendorCode !== 'string'
      || ids.has(item.Id) || exactId !== undefined && item.Id !== exactId) throw new Error('Не вдалося прочитати список товарів.')
    ids.add(item.Id)
    return { Id: item.Id, Name: item.Name, VendorCode: item.VendorCode }
  })
}
export async function searchNativeReportProducts(dataSource: ReportProductLookupSource, query: NativeSalesProductQuery, signal?: AbortSignal): Promise<NativeSalesProduct[]> {
  const value = (query.value ?? '').trim(), offset = query.offset ?? 0, limit = query.limit ?? 30
  if (!isReportProductLookupSource(dataSource) || value.length > 120 || !Number.isSafeInteger(offset) || offset < 0 || offset > 10000
    || !Number.isSafeInteger(limit) || limit < 1 || limit > 50
    || query.exactId !== undefined && (!positiveProductId(query.exactId) || value !== '' || offset !== 0))
    throw new Error('Перевірте параметри пошуку товару.')
  const parameters = query.exactId !== undefined ? { dataSource, exactId: query.exactId, offset, limit } : { dataSource, value, offset, limit }
  const result = await apiRequest<unknown>('/report/datasets/products/lookup', { query: parameters, signal })
  return readProducts(result, limit, query.exactId)
}
