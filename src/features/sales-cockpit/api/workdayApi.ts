import { apiRequest } from '../../../shared/api/apiClient'
import { checkContactEvent } from './contactsApi'
import type { CockpitTask } from '../types'
import { WORKDAY_BUCKETS, type WorkdayBucket, type WorkdayPage, type WorkdayScope, type WorkdayTasksPage } from '../workdayTypes'

const contractError = () => new Error('Некоректна відповідь робочої черги. Оновіть дані або зверніться до адміністратора')
const positiveInteger = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0
const nonnegativeInteger = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const activeStatuses = new Set(['open', 'in_progress', 'snoozed'])
const terminalStatuses = new Set(['done', 'dismissed', 'orphaned'])
function checkPage(data: WorkdayPage | WorkdayTasksPage, rows: unknown[], offset: number) {
  if (!data || !positiveInteger(data.manager_id) || typeof data.manager_net_uid !== 'string' || !data.manager_net_uid.trim()
    || data.offset !== offset || data.limit !== 20 || !nonnegativeInteger(data.total) || !Array.isArray(rows)
    || data.count !== rows.length || rows.length !== Math.min(20, Math.max(0, data.total - offset))) throw contractError()
}
function checkTask(task: CockpitTask, managerId: number, key: string, scope: WorkdayScope) {
  if (!task || typeof task.task_key !== 'string' || !task.task_key.trim() || task.manager_id !== managerId
    || !(scope === 'active' ? activeStatuses : terminalStatuses).has(String(task.status))
    || (key.startsWith('client:') ? String(task.client_id) !== key.slice(7) : task.task_type !== 'manual' || (task.client_id != null && (!Number.isSafeInteger(task.client_id) || task.client_id > 0)) || key !== `task:${task.task_key}`)) throw contractError()
}
export async function getWorkday(bucket: WorkdayBucket, search: string, offset: number, signal?: AbortSignal): Promise<WorkdayPage> {
  const data = await apiRequest<WorkdayPage>('/sales/cockpit/workday', { query: { bucket, search, offset, limit: 20 }, signal })
  checkPage(data, data?.rows, offset)
  if (data.bucket !== bucket || data.search !== search || data.timezone !== 'Europe/Kyiv' || !/^\d{4}-\d{2}-\d{2}$/.test(data.as_of)
    || !data.counts || Object.keys(WORKDAY_BUCKETS).some((key) => !nonnegativeInteger(data.counts[key as WorkdayBucket]))
    || data.counts.all !== data.counts.overdue + data.counts.today + data.counts.in_progress + data.counts.upcoming + data.counts.unscheduled
    || data.total !== data.counts[bucket] || new Set(data.rows.map((row) => row.key)).size !== data.rows.length) throw contractError()
  for (const row of data.rows) {
    if (!row || row.manager_id !== data.manager_id || typeof row.manager_name !== 'string' || typeof row.client_name !== 'string'
      || typeof row.can_contact !== 'boolean' || typeof row.key !== 'string' || (row.client_id !== null && !positiveInteger(row.client_id))
      || (row.client_id !== null ? row.key !== `client:${row.client_id}` : !row.key.startsWith('task:') || row.can_contact)
      || String(row.bucket) === 'all' || !Object.hasOwn(WORKDAY_BUCKETS, row.bucket) || (bucket !== 'all' && row.bucket !== bucket)
      || !nonnegativeInteger(row.task_count) || !nonnegativeInteger(row.in_progress_count) || !nonnegativeInteger(row.manual_count)
      || row.in_progress_count > row.task_count || row.manual_count > row.task_count
      || (row.due_at !== null && (typeof row.due_at !== 'string' || !/(?:Z|[+-]00:00)$/.test(row.due_at) || !Number.isFinite(Date.parse(row.due_at))))
      || (row.task_count === 0 ? row.primary_task !== null : !row.primary_task)
      || (!row.primary_task && !row.latest_contact)) throw contractError()
    if (row.primary_task) checkTask(row.primary_task, data.manager_id, row.key, 'active')
    if (row.latest_contact) {
      checkContactEvent(row.latest_contact)
      if (row.latest_contact.client_id !== row.client_id) throw contractError()
    }
  }
  return data
}
export async function getWorkdayTasks(key: string, scope: WorkdayScope, offset: number, signal?: AbortSignal): Promise<WorkdayTasksPage> {
  const data = await apiRequest<WorkdayTasksPage>('/sales/cockpit/workday/tasks', { query: { key, scope, offset, limit: 20 }, signal })
  checkPage(data, data?.tasks, offset)
  if (data.key !== key || data.scope !== scope || new Set(data.tasks.map((task) => task.task_key)).size !== data.tasks.length) throw contractError()
  data.tasks.forEach((task) => checkTask(task, data.manager_id, key, scope))
  return data
}
