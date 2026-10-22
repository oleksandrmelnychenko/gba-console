import { apiRequest } from '../../../shared/api/apiClient'

export type CoachingBucket = 'workload' | 'overdue_promises' | 'without_next_contact' | 'repeat_tasks'
export type AssignmentHistory = { id?: string; from: number; to: number; by?: number; at: string; clarification?: string; source: string }
export type CoachingRow = { key: string; task_key: string | null; client_id: number | null; client_name: string; manager_id: number; manager_name: string; title: string; status: string | null; task_type: string | null; due_at: string | null; updated_at: string | null; contact_at: string | null; assignment_history: AssignmentHistory[] }
export type CoachingParams = { managerId?: number; bucket: CoachingBucket; status: string; dateFrom?: string; dateTo?: string; offset: number; limit: number }
export type CoachingPage = { as_of: string; requested_manager_id: number | null; bucket: CoachingBucket; status: string; date_from: string | null; date_to: string | null; offset: number; limit: number; total: number; count: number; counts: Record<CoachingBucket, number>; rows: CoachingRow[]; managers: { id: number; name: string }[] }
const buckets: CoachingBucket[] = ['workload', 'overdue_promises', 'without_next_contact', 'repeat_tasks']
const integer = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const date = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v))
export async function getHeadCoaching(params: CoachingParams, signal?: AbortSignal): Promise<CoachingPage> {
  const raw = await apiRequest<CoachingPage>('/sales/cockpit/head/coaching', { query: params, signal })
  if (!raw || raw.requested_manager_id !== (params.managerId ?? null) || raw.bucket !== params.bucket || raw.status !== params.status
    || (raw.date_from ?? '') !== (params.dateFrom ?? '') || (raw.date_to ?? '') !== (params.dateTo ?? '')
    || raw.offset !== params.offset || raw.limit !== params.limit || !integer(raw.total) || !date(raw.as_of)
    || !Array.isArray(raw.rows) || raw.rows.length !== raw.count || raw.count !== Math.min(params.limit, Math.max(0, raw.total - params.offset))
    || !raw.counts || buckets.some(b => !integer(raw.counts[b])) || raw.counts[params.bucket] !== raw.total
    || new Set(raw.rows.map(row => row?.key)).size !== raw.rows.length
    || !Array.isArray(raw.managers) || raw.managers.some(m => !integer(m.id) || m.id === 0 || typeof m.name !== 'string')
    || raw.rows.some(row => !row || typeof row.key !== 'string' || !row.key || !integer(row.manager_id) || row.manager_id === 0
      || (params.managerId !== undefined && row.manager_id !== params.managerId)
      || typeof row.title !== 'string' || typeof row.client_name !== 'string' || typeof row.manager_name !== 'string'
      || (row.due_at !== null && !date(row.due_at)) || (row.updated_at !== null && !date(row.updated_at))
      || (row.contact_at !== null && !date(row.contact_at)) || !Array.isArray(row.assignment_history)
      || row.assignment_history.some(entry => !entry || !date(entry.at) || !integer(entry.from) || !integer(entry.to)
        || typeof entry.source !== 'string' || (entry.clarification !== undefined && typeof entry.clarification !== 'string')))) {
    throw new Error('Некоректна або неповна черга керівника. Оновіть дані.')
  }
  return raw
}
export async function assignHeadTask(row: CoachingRow, managerId: number, clarification: string) {
  return apiRequest('/sales/cockpit/head/tasks/assign', { method: 'POST', body: {
    TaskKey: row.task_key, ExpectedManagerId: row.manager_id, ExpectedUpdatedAt: row.updated_at,
    ManagerId: managerId, Clarification: clarification,
  } })
}
