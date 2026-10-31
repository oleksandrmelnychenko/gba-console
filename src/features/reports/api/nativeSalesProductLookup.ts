import { apiRequest } from '../../../shared/api/apiClient'
import { positiveProductId } from '../data/salesProductLookupCapability'
export type NativeSalesProduct = { Id: string; Name: string; VendorCode: string }
export type NativeSalesProductQuery = { value?: string; exactId?: string; offset?: number; limit?: number }
export function productBusinessName(product: NativeSalesProduct): string {
  return [product.Name.trim(), product.VendorCode.trim()].filter(Boolean).join(' · ') || `Товар [${product.Id}]`
}
export function productOptionName(product: NativeSalesProduct): string {
  return product.Name.trim() || product.VendorCode.trim()
    ? `${productBusinessName(product)} [${product.Id}]`
    : productBusinessName(product)
}
export async function searchNativeSalesProducts(
  query: NativeSalesProductQuery,
  signal?: AbortSignal,
): Promise<NativeSalesProduct[]> {
  const value = (query.value ?? '').trim(),
    offset = query.offset ?? 0,
    limit = query.limit ?? 30
  if (
    value.length > 120 ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > 10000 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 50 ||
    (query.exactId !== undefined && (!positiveProductId(query.exactId) || value !== '' || offset !== 0))
  )
    throw new Error('Перевірте параметри пошуку товару.')
  const parameters = query.exactId !== undefined ? { exactId: query.exactId, offset, limit } : { value, offset, limit }
  const result = await apiRequest<unknown>('/report/datasets/sales/products/lookup', { query: parameters, signal })
  if (!Array.isArray(result) || result.length > limit) throw new Error('Не вдалося прочитати список товарів.')
  const ids = new Set<string>()
  return result.map((raw: unknown) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Не вдалося прочитати список товарів.')
    const item = raw as Record<string, unknown>
    if (
      !positiveProductId(item.Id) ||
      typeof item.Name !== 'string' ||
      typeof item.VendorCode !== 'string' ||
      ids.has(item.Id) ||
      (query.exactId !== undefined && item.Id !== query.exactId)
    )
      throw new Error('Не вдалося прочитати список товарів.')
    ids.add(item.Id)
    return { Id: item.Id, Name: item.Name, VendorCode: item.VendorCode }
  })
}
