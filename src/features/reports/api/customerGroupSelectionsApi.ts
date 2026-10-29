import { apiRequest } from '../../../shared/api/apiClient'
import { customerGroupProductQueryError } from '../data/customerGroupSelections'
export type CustomerGroupChoice = { Id: number; Name: string }
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) }
function positiveId(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 }
function choices(value: unknown, caption: (item: Record<string, unknown>) => string): CustomerGroupChoice[] {
  if (!Array.isArray(value)) throw new Error('Некоректний список значень.')
  const seen = new Set<number>()
  return value.map(item => {
    if (!record(item) || !positiveId(item.Id) || seen.has(item.Id)) throw new Error('Ідентифікатори значень не підтверджено.')
    const Name = caption(item)
    if (!Name.trim()) throw new Error('Назву значення не підтверджено.')
    seen.add(item.Id)
    return { Id: item.Id, Name }
  })
}
/** Child RegionCode.Id only; parent identity is display context, never a client-region constraint. */
export async function getCustomerGroupRegionCodes(signal?: AbortSignal): Promise<CustomerGroupChoice[]> {
  const result = await apiRequest<unknown>('/regions/all/codes', { signal })
  if (!Array.isArray(result)) throw new Error('Некоректний список кодів регіонів.')
  const seen = new Set<number>(), parents = new Set<number>(), options: CustomerGroupChoice[] = []
  for (const parent of result) {
    if (!record(parent) || !positiveId(parent.Id) || parents.has(parent.Id) || typeof parent.Name !== 'string' || !parent.Name.trim() || !Array.isArray(parent.RegionCodes))
      throw new Error('Регіон коду не підтверджено.')
    parents.add(parent.Id)
    for (const child of parent.RegionCodes) {
      if (!record(child) || !positiveId(child.Id) || seen.has(child.Id) || child.RegionId !== parent.Id || typeof child.Value !== 'string' || !child.Value.trim())
        throw new Error('Ідентифікатор коду регіону не підтверджено.')
      seen.add(child.Id)
      options.push({ Id: child.Id, Name: `${child.Value} — ${parent.Name} [${child.Id}]` })
    }
  }
  return options
}
export async function searchCustomerGroupChoices(field: 1 | 10, value: string, offset: number, signal?: AbortSignal): Promise<CustomerGroupChoice[]> {
  const query = value.trim()
  if (!Number.isInteger(offset) || offset < 0 || offset > 10000 || query.length > 120) throw new Error('Некоректні параметри пошуку.')
  if (field === 1 && (customerGroupProductQueryError(query) || query.startsWith('id:') && offset !== 0)) throw new Error('Некоректний точний ID товару.')
  if (!query) return []
  const response = await apiRequest<unknown>(field === 1 ? '/report/datasets/lookup' : '/usermanagement/profiles/search/lookup', {
    query: { ...(field === 1 ? { dataSource: 44, field: 1 } : {}), value: query, offset, limit: 30 }, signal,
  })
  const result = choices(response, item => field === 1 ? typeof item.Name === 'string' ? item.Name : ''
    : `${[item.LastName, item.FirstName, item.MiddleName].filter((part): part is string => typeof part === 'string' && !!part.trim()).join(' ') || 'Без імені'} [${item.Id}]`)
  if (field === 1 && query.startsWith('id:') && (result.length > 1 || result.some(item => item.Id !== Number(query.slice(3)))))
    throw new Error('Сервер не підтвердив точний ID товару.')
  return result
}
