import { apiRequest } from '../../../shared/api/apiClient'
import type { WorkspaceQueue, WorkspaceQueueRequest, WorkspaceQueueRow } from '../queueTypes'

const invalid = () => new Error('Не вдалося перевірити точну чергу робочого простору')
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {}
const field = (row: Record<string, unknown>, name: string) => Object.hasOwn(row, name) ? row[name] : row[name[0].toUpperCase() + name.slice(1)]
const text = (row: Record<string, unknown>, name: string) => {
  const value = field(row, name)
  if (typeof value !== 'string') throw invalid()
  return value
}
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const timestamp = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))
const nullableNumber = (value: unknown): value is number | null => value === null || typeof value === 'number' && Number.isFinite(value)
const nullableText = (value: unknown): value is string | null => value === null || typeof value === 'string'

export async function getDashboardQueue(request: WorkspaceQueueRequest, signal?: AbortSignal): Promise<WorkspaceQueue> {
  const { workspace, key, ...query } = request
  const payload = await apiRequest<unknown>(`/dashboards/workspaces/${workspace}/queues/${encodeURIComponent(key)}`, { query, signal })
  return normalizeDashboardQueue(payload, request)
}

export function normalizeDashboardQueue(payload: unknown, request: WorkspaceQueueRequest): WorkspaceQueue {
  const data = record(payload)
  const total = field(data, 'total'), aggregateValue = field(data, 'aggregateValue')
  const rawRows = field(data, 'rows'), timeBasis = field(data, 'timeBasis')
  if (field(data, 'workspace') !== request.workspace || field(data, 'key') !== request.key
    || text(data, 'from').slice(0, 10) !== request.from || text(data, 'to').slice(0, 10) !== request.to
    || field(data, 'offset') !== request.offset || field(data, 'limit') !== request.limit
    || !timestamp(field(data, 'asOfUtc')) || Date.parse(text(data, 'asOfUtc')) !== Date.parse(request.asOf)
    || !timestamp(field(data, 'readAtUtc')) || !integer(total) || !nullableNumber(aggregateValue)
    || !['current', 'period'].includes(String(timeBasis)) || !Array.isArray(rawRows)
    || rawRows.length !== Math.min(request.limit, Math.max(0, total - request.offset))) throw invalid()
  const rows: WorkspaceQueueRow[] = rawRows.map(value => {
    const row = record(value), id = field(row, 'id'), quantity = field(row, 'quantity')
    const documentDate = field(row, 'documentDate'), netUid = field(row, 'netUid'), route = field(row, 'route')
    if (!integer(id) || id === 0 || !nullableNumber(quantity) || !nullableText(netUid) || !nullableText(route)
      || documentDate !== null && !timestamp(documentDate)
      || typeof route === 'string' && (!route.startsWith('/') || route.startsWith('//') || route.includes('\\'))) throw invalid()
    return { id, netUid, documentDate, number: text(row, 'number'), description: text(row, 'description'), quantity, route }
  })
  if (new Set(rows.map(row => row.id)).size !== rows.length) throw invalid()
  return {
    ...request, label: text(data, 'label'), unit: text(data, 'unit'), timeBasis: timeBasis as 'current' | 'period',
    formula: text(data, 'formula'), source: text(data, 'source'), grain: text(data, 'grain'), scope: text(data, 'scope'),
    asOfUtc: text(data, 'asOfUtc'), readAtUtc: text(data, 'readAtUtc'), total, aggregateValue, rows,
  }
}
