import { apiRequest } from '../../../shared/api/apiClient'
export type CustomerGroupRegionOption = { Id: number; Name: string }
/** Parent Region IDs only. RegionCodes are a different field and never become choices here. */
export async function getCustomerGroupRegions(signal?: AbortSignal): Promise<CustomerGroupRegionOption[]> {
  const result = await apiRequest<unknown>('/regions/all/codes', { signal })
  if (!Array.isArray(result)) throw new Error('Некоректний список регіонів.')
  const seen = new Set<number>()
  return result.map(item => {
    if (!item || typeof item !== 'object' || !Number.isSafeInteger(item.Id) || item.Id <= 0
      || typeof item.Name !== 'string' || !item.Name.trim() || seen.has(item.Id))
      throw new Error('Не вдалося підтвердити ідентифікатори регіонів.')
    seen.add(item.Id)
    return { Id: item.Id, Name: item.Name }
  })
}
