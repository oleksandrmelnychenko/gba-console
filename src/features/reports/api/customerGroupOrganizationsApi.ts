import { apiRequest } from '../../../shared/api/apiClient'
export type CustomerGroupOrganizationOption = { Id: number; Name: string }
/** Same authenticated local GBA catalogue, with a strict identity boundary for source44 only. */
export async function getCustomerGroupOrganizations(signal?: AbortSignal): Promise<CustomerGroupOrganizationOption[]> {
  const result = await apiRequest<unknown>('/organizations/all', { signal })
  if (!Array.isArray(result)) throw new Error('Некоректний список організацій.')
  const seen = new Set<number>()
  return result.map(item => {
    if (!item || typeof item !== 'object' || !Number.isSafeInteger(item.Id) || item.Id <= 0
      || typeof item.Name !== 'string' || !item.Name.trim() || seen.has(item.Id))
      throw new Error('Не вдалося підтвердити ідентифікатори організацій.')
    seen.add(item.Id)
    return { Id: item.Id, Name: item.Name }
  })
}
