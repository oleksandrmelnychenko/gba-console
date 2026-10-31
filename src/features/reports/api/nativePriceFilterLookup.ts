import { apiRequest } from '../../../shared/api/apiClient'
import { isNativePriceFilterField, nativePriceRawKey, priceFilterDescriptor } from '../data/nativePriceFilterLookup'
export type NativePriceFilterOption = { Id: string; Name: string }
export type NativePriceFilterQuery = { value?: string; exactId?: string; exactValue?: string; from?: string; to?: string; offset?: number; limit?: number }
function validDate(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < '2025-01-01' || day > '9998-12-31') return false
  const stamp = Date.parse(`${day}T00:00:00Z`)
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === day
}
export function validPriceFilterPeriod(from: string, to: string): boolean {
  return validDate(from) && validDate(to) && from <= to && (Date.parse(to) - Date.parse(from)) / 86400000 < 366
}
export function priceFilterQueryError(source: number, field: number, query: NativePriceFilterQuery): string | null {
  if (!isNativePriceFilterField(source, field)) return 'Непідтверджений довідник відбору.'
  const descriptor = priceFilterDescriptor(field), value = query.value ?? '', offset = query.offset ?? 0, limit = query.limit ?? 30
  if (value.length > 120 || !Number.isSafeInteger(offset) || offset < 0 || offset > 10000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 50) return 'Перевірте параметри пошуку.'
  if (descriptor.periodRequired ? !validPriceFilterPeriod(query.from ?? '', query.to ?? '') : query.from !== undefined || query.to !== undefined) return 'Оберіть коректний період від 2025 року тривалістю до 366 днів.'
  const exact = descriptor.exactParameter === 'exactId' ? query.exactId : query.exactValue
  const foreign = descriptor.exactParameter === 'exactId' ? query.exactValue : query.exactId
  if (foreign !== undefined || exact !== undefined && (value !== '' || offset !== 0 || nativePriceRawKey(field, exact) === null)) return field === 3 ? 'Вкажіть збережену позначку TOP без зміни пробілів.' : 'Вкажіть точний позитивний ID без пробілів чи початкових нулів.'
  return null
}
export async function searchNativePriceFilters(source: number, field: number, query: NativePriceFilterQuery, signal?: AbortSignal): Promise<NativePriceFilterOption[]> {
  const error = priceFilterQueryError(source, field, query)
  if (error || !isNativePriceFilterField(source, field)) throw new Error(error ?? 'Непідтверджений відбір.')
  const descriptor = priceFilterDescriptor(field), offset = query.offset ?? 0, limit = query.limit ?? 30
  const exact = descriptor.exactParameter === 'exactId' ? query.exactId : query.exactValue
  const mode = exact === undefined ? { value: query.value ?? '' } : { [descriptor.exactParameter]: exact }
  const period = descriptor.periodRequired ? { from: query.from!, to: query.to! } : {}
  const rows = await apiRequest<unknown>('/report/datasets/price-comparison/filters/lookup', {
    query: { dataSource: source, field, ...mode, ...period, offset, limit }, signal,
  })
  if (!Array.isArray(rows) || rows.length > limit) throw new Error('Не вдалося прочитати довідник відбору.')
  const seen = new Set<string>()
  return rows.map(raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).length !== 2
      || typeof raw.Name !== 'string' || field !== 3 && !raw.Name.trim() || nativePriceRawKey(field, raw.Id) === null
      || seen.has(raw.Id) || exact !== undefined && raw.Id !== exact || field === 3 && raw.Name !== raw.Id) throw new Error('Сервер повернув некоректні або неоднозначні значення відбору.')
    seen.add(raw.Id)
    return { Id: raw.Id, Name: raw.Name }
  })
}
