import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getHeadCoaching, assignHeadTask, type CoachingRow } from './headCoachingApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const params = { bucket: 'workload' as const, status: 'all', offset: 0, limit: 20 }
const row: CoachingRow = { key: 'one', task_key: 'one', client_id: 1, client_name: 'Client', manager_id: 1, manager_name: 'Seller', title: 'Call', status: 'open', task_type: 'manual', due_at: null, updated_at: '2026-10-22T12:00:00Z', contact_at: null, assignment_history: [] }
const page = () => ({ as_of: '2026-10-22T12:00:00Z', requested_manager_id: null, bucket: 'workload', status: 'all', date_from: null, date_to: null, offset: 0, limit: 20, total: 1, count: 1, counts: { workload: 1, repeat_tasks: 0, overdue_promises: 0, without_next_contact: 0 }, rows: [row], managers: [{ id: 1, name: 'Seller' }] })
beforeEach(() => vi.mocked(apiRequest).mockReset())
it('validates a complete queue without replacing missing fields with zero', async () => {
  vi.mocked(apiRequest).mockResolvedValue(page())
  expect((await getHeadCoaching(params)).total).toBe(1)
})
it.each(['counts', 'rows', 'managers', 'as_of'])('rejects missing %s', async key => {
  const raw = { ...page() } as Record<string, unknown>; delete raw[key]
  vi.mocked(apiRequest).mockResolvedValue(raw)
  await expect(getHeadCoaching(params)).rejects.toThrow()
})
it('rejects stale manager scope', async () => {
  vi.mocked(apiRequest).mockResolvedValue(page())
  await expect(getHeadCoaching({ ...params, managerId: 2 })).rejects.toThrow()
})
it('rejects duplicate rows even if counts appear valid', async () => {
  vi.mocked(apiRequest).mockResolvedValue({ ...page(), total: 2, count: 2, counts: { ...page().counts, workload: 2 }, rows: [row, row] })
  await expect(getHeadCoaching(params)).rejects.toThrow()
})
it('rejects malformed assignment history', async () => {
  vi.mocked(apiRequest).mockResolvedValue({ ...page(), rows: [{ ...row, assignment_history: [null] }] })
  await expect(getHeadCoaching(params)).rejects.toThrow()
})
it('sends task version without changing client or sale ownership', async () => {
  vi.mocked(apiRequest).mockResolvedValue({})
  await assignHeadTask(row, 2, 'Call instead')
  expect(apiRequest).toHaveBeenCalledWith('/sales/cockpit/head/tasks/assign', { method: 'POST', body: { TaskKey: 'one', ExpectedManagerId: 1, ExpectedUpdatedAt: row.updated_at, ManagerId: 2, Clarification: 'Call instead' } })
})
