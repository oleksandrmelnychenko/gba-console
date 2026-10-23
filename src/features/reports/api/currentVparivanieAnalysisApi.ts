import { apiRequest } from '../../../shared/api/apiClient'
import type { ReportEntity } from '../types'
export type AnalysisLookupValue = { id: string; name: string; data: ReportEntity }
export async function searchAnalysisValues(field: number, value: string, from: string, to: string, buyerId?: string, signal?: AbortSignal): Promise<AnalysisLookupValue[]> {
  const result = await apiRequest<unknown>('/report/datasets/current-vparivanie/analysis/lookup', {
    query: { field, value, offset: 0, limit: 30, from, to, ...(buyerId ? { buyerId } : {}) }, signal,
  })
  if (!Array.isArray(result)) throw new Error('Некоректні значення відбору аналізу.')
  const seen = new Set<string>()
  return result.map(item => {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id || seen.has(item.id)
      || typeof item.name !== 'string' || !item.name || typeof item.data !== 'string') throw new Error('Некоректні значення відбору аналізу.')
    seen.add(item.id)
    const data: unknown = JSON.parse(item.data, (_key, value) => {
      if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error('Сервер повернув неточну числову ідентичність.')
      return value
    })
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Некоректна ідентичність значення відбору.')
    return { id: item.id, name: item.name, data: data as ReportEntity }
  })
}
