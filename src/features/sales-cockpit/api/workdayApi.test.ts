import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import queue from './__fixtures__/workday-queue.json'
import active from './__fixtures__/workday-tasks-active.json'
import history from './__fixtures__/workday-tasks-history.json'
import { getWorkday, getWorkdayTasks } from './workdayApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
describe('workday API boundary', () => {
  beforeEach(() => vi.clearAllMocks())
  it('accepts actual NBA aggregation fixture with grouped tasks, contact-only and standalone manual work', async () => {
    vi.mocked(apiRequest).mockResolvedValue(queue)
    const signal = new AbortController().signal
    expect(await getWorkday('all', '', 0, signal)).toEqual(queue)
    expect(apiRequest).toHaveBeenCalledWith('/sales/cockpit/workday', { query: { bucket: 'all', search: '', offset: 0, limit: 20 }, signal })
    expect(queue.rows[0].latest_contact?.manager_id).not.toBe(queue.manager_id)
  })
  it('accepts standalone manual work with empty display name', async () => {
    const data = { ...queue, rows: queue.rows.map((row) => row.client_id === null ? { ...row, client_name: '', primary_task: { ...row.primary_task, client_name: '', client_id: -1 } } : row) }
    vi.mocked(apiRequest).mockResolvedValue(data)
    expect((await getWorkday('all', '', 0)).rows[1].client_name).toBe('')
  })
  it.each(['active', 'history'] as const)('accepts real %s tasks fixture', async (scope) => {
    vi.mocked(apiRequest).mockResolvedValue(scope === 'active' ? active : history)
    expect((await getWorkdayTasks('client:1', scope, 0)).scope).toBe(scope)
  })
  it('accepts superseded advice only in history and retains source evidence', async () => {
    const evidence = { kind: 'debt_settled', debts: { 123: '0' }, observed_at: '2026-10-22T09:00:00Z' }
    const tasks = history.tasks.map((task) => ({ ...task, status: 'superseded', source_evidence: evidence }))
    vi.mocked(apiRequest).mockResolvedValue({ ...history, tasks })
    expect((await getWorkdayTasks('client:1', 'history', 0)).tasks[0].source_evidence).toEqual(evidence)
    vi.mocked(apiRequest).mockResolvedValue({ ...active, tasks: active.tasks.map((task) => ({ ...task, status: 'superseded' })) })
    await expect(getWorkdayTasks('client:1', 'active', 0)).rejects.toThrow('Некоректна відповідь')
  })
  it.each([
    { ...queue, total: 999 },
    { ...queue, manager_id: 999 },
    { ...queue, offset: 20 },
    { ...queue, timezone: 'UTC' },
    { ...queue, counts: { ...queue.counts, all: 99 } },
    { ...queue, rows: [queue.rows[0], queue.rows[0], queue.rows[2]] },
    { ...queue, rows: [{ ...queue.rows[0], task_count: 0 }, ...queue.rows.slice(1)] },
    { ...queue, rows: [{ ...queue.rows[0], due_at: '2026-10-22T10:00:00' }, ...queue.rows.slice(1)] },
    { ...queue, rows: [{ ...queue.rows[0], primary_task: { ...queue.rows[0].primary_task, manager_id: 999 } }, ...queue.rows.slice(1)] },
  ])('rejects inconsistent pages instead of showing incomplete queue %#', async (data) => {
    vi.mocked(apiRequest).mockResolvedValue(data)
    await expect(getWorkday('all', '', 0)).rejects.toThrow('Некоректна відповідь')
  })
  it('sends server search, bucket and offset without downloading previous pages', async () => {
    const data = { ...queue, bucket: 'today', search: 'A.*[', offset: 200, count: 0, total: 1, rows: [] }
    vi.mocked(apiRequest).mockResolvedValue(data)
    expect((await getWorkday('today', 'A.*[', 200)).rows).toEqual([])
    expect(apiRequest).toHaveBeenCalledTimes(1)
    expect(apiRequest).toHaveBeenLastCalledWith('/sales/cockpit/workday', expect.objectContaining({ query: { bucket: 'today', search: 'A.*[', offset: 200, limit: 20 } }))
  })
  it.each([
    { ...active, key: 'client:999' }, { ...active, scope: 'history' },
    { ...active, tasks: active.tasks.map((task) => ({ ...task, manager_id: 999 })) },
    { ...active, tasks: active.tasks.map((task) => ({ ...task, client_id: 999 })) },
    { ...active, tasks: active.tasks.map((task) => ({ ...task, status: 'done' })) },
    { ...active, tasks: [active.tasks[0], active.tasks[0]] },
  ])('rejects another manager/client/scope or duplicated task page %#', async (data) => {
    vi.mocked(apiRequest).mockResolvedValue(data)
    await expect(getWorkdayTasks('client:1', 'active', 0)).rejects.toThrow('Некоректна відповідь')
  })
})
