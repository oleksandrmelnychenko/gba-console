import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { addTaskNote, getCockpitCount, getCockpitInbox, regenerateCockpit, setTaskStatus } from './salesCockpitApi'
import type { CockpitTask } from '../types'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('salesCockpitApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('loads the inbox with limit and status query params and normalizes tasks', async () => {
    const task: CockpitTask = { task_key: 'mgr|client|reorder_due|w1', title: 'Поповнити склад' }

    apiRequestMock.mockResolvedValueOnce({ manager_id: 7, count: 1, tasks: [task, null, 'noise'] })

    await expect(getCockpitInbox({ limit: 50, status: 'open,in_progress,snoozed' })).resolves.toEqual({
      manager_id: 7,
      count: 1,
      tasks: [task],
    })
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/cockpit/inbox', {
      query: {
        limit: 50,
        status: 'open,in_progress,snoozed',
      },
    })
  })

  it('defaults inbox count to the task length and tolerates a non-object response', async () => {
    apiRequestMock.mockResolvedValueOnce(null)

    await expect(getCockpitInbox()).resolves.toEqual({ count: 0, tasks: [] })
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/cockpit/inbox', {
      query: {
        limit: undefined,
        status: undefined,
      },
    })
  })

  it('loads the active count and normalizes the urgency breakdown', async () => {
    apiRequestMock.mockResolvedValueOnce({ manager_id: 7, active_count: 4, by_urgency: { critical: 1, high: 3 } })

    await expect(getCockpitCount()).resolves.toEqual({
      manager_id: 7,
      active_count: 4,
      by_urgency: { critical: 1, high: 3, normal: 0, low: 0 },
    })
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/cockpit/count')
  })

  it('posts a status change with the task key query and PascalCase body', async () => {
    const task: CockpitTask = { task_key: 'task-1', status: 'done' }

    apiRequestMock.mockResolvedValueOnce(task)

    await expect(
      setTaskStatus('task-1', { To: 'done', Sold: true, Amount: 1200 }),
    ).resolves.toEqual(task)
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/cockpit/tasks/status', {
      method: 'POST',
      query: {
        taskKey: 'task-1',
      },
      body: {
        To: 'done',
        Sold: true,
        Amount: 1200,
      },
    })
  })

  it('posts a snooze status change with the snooze timestamp body', async () => {
    apiRequestMock.mockResolvedValueOnce(null)

    await expect(
      setTaskStatus('task-2', { To: 'snoozed', SnoozeUntil: '2026-06-10T09:00:00' }),
    ).resolves.toBeNull()
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/cockpit/tasks/status', {
      method: 'POST',
      query: {
        taskKey: 'task-2',
      },
      body: {
        To: 'snoozed',
        SnoozeUntil: '2026-06-10T09:00:00',
      },
    })
  })

  it('posts a note with the task key query and Text body', async () => {
    const task: CockpitTask = { task_key: 'task-3' }

    apiRequestMock.mockResolvedValueOnce(task)

    await expect(addTaskNote('task-3', { Text: 'Передзвонити завтра' })).resolves.toEqual(task)
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/cockpit/tasks/notes', {
      method: 'POST',
      query: {
        taskKey: 'task-3',
      },
      body: {
        Text: 'Передзвонити завтра',
      },
    })
  })

  it('regenerates the cockpit with the optional as-of date and an empty body', async () => {
    apiRequestMock.mockResolvedValueOnce({ created: 5, updated: 2 })

    await expect(regenerateCockpit('2026-06-06')).resolves.toEqual({ created: 5, updated: 2 })
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/cockpit/generate', {
      method: 'POST',
      query: {
        asOfDate: '2026-06-06',
      },
      body: {},
    })
  })
})
