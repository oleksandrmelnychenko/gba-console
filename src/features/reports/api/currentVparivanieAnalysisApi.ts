import { ANALYSIS_GROUPS_ENDPOINT, analysisGroupIdentity } from '../data/currentVparivanieAnalysis'
import { apiRequest } from '../../../shared/api/apiClient'
import type { ReportEntity } from '../types'
export type AnalysisLookupValue = { id: string; name: string; data: ReportEntity }
export async function searchAnalysisValues(field: number, value: string, from: string, to: string, buyerId?: string, signal?: AbortSignal, offset = 0): Promise<AnalysisLookupValue[]> {
  const result = await apiRequest<unknown>('/report/datasets/current-vparivanie/analysis/lookup', {
    query: { field, value, offset, limit: 30, from, to, ...(buyerId ? { buyerId } : {}) }, signal,
  })
  if (!Array.isArray(result) || result.length > 30) throw new Error('Некоректні значення відбору аналізу.')
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

export type AnalysisGroupNode = AnalysisLookupValue & { hasChildren: boolean }
export type AnalysisGroupPage = { parentId: string | null; items: AnalysisGroupNode[]; hasMore: boolean }
export async function getAnalysisGroupPage(parentId: string | null, offset: number, limit: number, value: string, signal?: AbortSignal): Promise<AnalysisGroupPage> {
  const result = await apiRequest<unknown>(ANALYSIS_GROUPS_ENDPOINT, {
    query: { ...(parentId ? { parentId } : {}), offset, limit, value }, signal,
  })
  const fail = () => { throw new Error('Сервер повернув некоректну ієрархію товарних груп.') }
  if (!result || typeof result !== 'object') return fail()
  const page = result as Record<string, unknown>
  if (page.parentId !== parentId || typeof page.hasMore !== 'boolean' || !Array.isArray(page.items) || page.items.length > limit
    || page.hasMore && page.items.length === 0) return fail()
  const seen = new Set<string>()
  const items = page.items.map(item => {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || typeof item.name !== 'string' || !item.name
      || typeof item.data !== 'string' || typeof item.hasChildren !== 'boolean') return fail()
    const data: unknown = JSON.parse(item.data, (_key, value) => {
      if (typeof value === 'number' && !Number.isSafeInteger(value)) return fail()
      return value
    })
    if (!data || typeof data !== 'object' || Array.isArray(data)) return fail()
    const identity = analysisGroupIdentity(data as ReportEntity), id = analysisGroupIdentity({ Id: item.id })
    if (!identity || identity.typed || !id || BigInt(identity.id) !== BigInt(id.id)) return fail()
    const canonical = String(BigInt(id.id))
    if (seen.has(canonical)) return fail()
    seen.add(canonical)
    return { id: canonical, name: item.name, data: data as ReportEntity, hasChildren: item.hasChildren }
  })
  return { parentId, items, hasMore: page.hasMore }
}
