import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { addTaskNote, getCockpitCount, getCockpitInbox, getCockpitTarget, getDashboard, getEscalated, getHeadDashboard, getHeadTasks, getHeadTeam, regenerateCockpit, setTaskStatus } from './salesCockpitApi'
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

  it('loads the head team with the as-of date query and normalizes the payload', async () => {
    apiRequestMock.mockResolvedValueOnce({
      is_head: true,
      as_of: '2026-06-08',
      team: [
        {
          manager_id: 7,
          manager_name: 'Олена',
          target: {
            shipped: { target: 1000, mtd: 600, attainment_pct: 60, pace_status: 'behind' },
            paid: { target: 800, mtd: 800, attainment_pct: 100, pace_status: 'ahead' },
          },
          tasks: { active: 3, generated_month: 8, done_month: 5, sold_month: 2, dismissed_month: 1, revenue_month: 4200, close_rate: 0.83, conversion_rate: 0.4 },
        },
        null,
      ],
      totals: {
        shipped_target: 1000,
        shipped_mtd: 600,
        paid_target: 800,
        paid_mtd: 800,
        generated_month: 8,
        done_month: 5,
        sold_month: 2,
        dismissed_month: 1,
        revenue_month: 4200,
        close_rate: 0.83,
        conversion_rate: 0.4,
      },
    })

    await expect(getHeadTeam('2026-06-08')).resolves.toEqual({
      is_head: true,
      as_of: '2026-06-08',
      team: [
        {
          manager_id: 7,
          manager_name: 'Олена',
          target: {
            shipped: { target: 1000, mtd: 600, attainment_pct: 60, pace_status: 'behind' },
            paid: { target: 800, mtd: 800, attainment_pct: 100, pace_status: 'ahead' },
          },
          tasks: { active: 3, generated_month: 8, done_month: 5, sold_month: 2, dismissed_month: 1, revenue_month: 4200, close_rate: 0.83, conversion_rate: 0.4 },
        },
      ],
      totals: {
        shipped_target: 1000,
        shipped_mtd: 600,
        paid_target: 800,
        paid_mtd: 800,
        generated_month: 8,
        done_month: 5,
        sold_month: 2,
        dismissed_month: 1,
        revenue_month: 4200,
        close_rate: 0.83,
        conversion_rate: 0.4,
      },
    })
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/cockpit/head/team', {
      query: {
        asOfDate: '2026-06-08',
      },
    })
  })

  it('defaults the head team to a non-head empty shape on a non-object response', async () => {
    apiRequestMock.mockResolvedValueOnce(null)

    await expect(getHeadTeam()).resolves.toEqual({
      is_head: false,
      as_of: null,
      team: [],
      totals: {
        shipped_target: 0,
        shipped_mtd: 0,
        paid_target: 0,
        paid_mtd: 0,
        generated_month: 0,
        done_month: 0,
        sold_month: 0,
        dismissed_month: 0,
        revenue_month: 0,
        close_rate: 0,
        conversion_rate: 0,
      },
    })
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/cockpit/head/team', {
      query: {
        asOfDate: undefined,
      },
    })
  })

  it('loads head tasks with combined ready statuses and normalizes the live board payload', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Total: 2,
      Tasks: [
        {
          TaskKey: 'manager|client|reorder_due|week',
          ManagerId: 7,
          ManagerName: 'Олена',
          ClientId: 42,
          ClientName: 'Тест клієнт',
          TaskType: 'reorder_due',
          Title: 'Повторити продаж',
          Status: 'open',
          Urgency: 'high',
          Priority: 90,
          POutcome: 0.7,
          ExpectedValue: 1200,
          EvScore: 840,
          InProgressSince: null,
          GeneratedAt: '2026-07-08T08:00:00',
          UpdatedAt: '2026-07-08T09:00:00',
          SlaBreached: false,
        },
        null,
      ],
      ByStatus: { Open: 1, InProgress: 1, Done: 3, Snoozed: 2, Dismissed: 1 },
      Managers: [{ ManagerId: 7, Name: 'Олена' }, null],
    })

    await expect(getHeadTasks({ statuses: 'open,in_progress', managerId: 7, urgency: 'high', skip: 50, limit: 50 })).resolves.toEqual({
      Total: 2,
      Tasks: [
        {
          TaskKey: 'manager|client|reorder_due|week',
          ManagerId: 7,
          ManagerName: 'Олена',
          ClientId: 42,
          ClientName: 'Тест клієнт',
          TaskType: 'reorder_due',
          Title: 'Повторити продаж',
          Status: 'open',
          Urgency: 'high',
          Priority: 90,
          POutcome: 0.7,
          ExpectedValue: 1200,
          EvScore: 840,
          InProgressSince: null,
          GeneratedAt: '2026-07-08T08:00:00',
          UpdatedAt: '2026-07-08T09:00:00',
          SlaBreached: false,
        },
      ],
      ByStatus: { Open: 1, InProgress: 1, Done: 3, Snoozed: 2, Dismissed: 1 },
      Managers: [{ ManagerId: 7, Name: 'Олена' }],
    })
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/cockpit/head/tasks', {
      query: {
        statuses: 'open,in_progress',
        managerId: 7,
        urgency: 'high',
        skip: 50,
        limit: 50,
      },
    })
  })

  it('loads the manager target with the as-of date query and normalizes both metrics', async () => {
    apiRequestMock.mockResolvedValueOnce({
      manager_id: 7,
      manager_name: 'Олена',
      month: '2026-06',
      as_of: '2026-06-08',
      working_days: 21,
      working_days_elapsed: 6,
      shipped: {
        target: 1000,
        mtd: 600,
        daily_pace: 100,
        expected_to_date: 285,
        gap: -315,
        today_needed: 0,
        attainment_pct: 60,
        pace_status: 'ahead',
      },
      paid: {
        target: 800,
        mtd: 200,
        daily_pace: 33,
        expected_to_date: 228,
        gap: 28,
        today_needed: 40,
        attainment_pct: 25,
        pace_status: 'behind',
      },
    })

    await expect(getCockpitTarget('2026-06-08')).resolves.toEqual({
      manager_id: 7,
      manager_name: 'Олена',
      month: '2026-06',
      as_of: '2026-06-08',
      working_days: 21,
      working_days_elapsed: 6,
      shipped: {
        target: 1000,
        mtd: 600,
        daily_pace: 100,
        expected_to_date: 285,
        gap: -315,
        today_needed: 0,
        attainment_pct: 60,
        pace_status: 'ahead',
      },
      paid: {
        target: 800,
        mtd: 200,
        daily_pace: 33,
        expected_to_date: 228,
        gap: 28,
        today_needed: 40,
        attainment_pct: 25,
        pace_status: 'behind',
      },
    })
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/cockpit/target', {
      query: {
        asOfDate: '2026-06-08',
      },
    })
  })

  it('defaults the manager target to a no-target shape on a non-object response', async () => {
    apiRequestMock.mockResolvedValueOnce(null)

    await expect(getCockpitTarget()).resolves.toEqual({
      manager_id: 0,
      manager_name: null,
      month: null,
      as_of: null,
      working_days: 0,
      working_days_elapsed: 0,
      shipped: {
        target: 0,
        mtd: 0,
        daily_pace: 0,
        expected_to_date: 0,
        gap: 0,
        today_needed: 0,
        attainment_pct: 0,
        pace_status: 'no_target',
      },
      paid: {
        target: 0,
        mtd: 0,
        daily_pace: 0,
        expected_to_date: 0,
        gap: 0,
        today_needed: 0,
        attainment_pct: 0,
        pace_status: 'no_target',
      },
    })
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/cockpit/target', {
      query: {
        asOfDate: undefined,
      },
    })
  })

  it('loads escalated tasks with the limit query and normalizes the head payload', async () => {
    const task: CockpitTask = { task_key: 'mgr|client|debt_followup|w1', title: 'Контроль боргу' }

    apiRequestMock.mockResolvedValueOnce({ is_head: true, count: 1, tasks: [task, null, 'noise'] })

    await expect(getEscalated(20)).resolves.toEqual({
      is_head: true,
      count: 1,
      tasks: [task],
    })
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/cockpit/head/escalated', {
      query: {
        limit: 20,
      },
    })
  })

  it('defaults escalated tasks to a non-head empty shape on a non-object response', async () => {
    apiRequestMock.mockResolvedValueOnce(null)

    await expect(getEscalated()).resolves.toEqual({
      is_head: false,
      count: 0,
      tasks: [],
    })
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/cockpit/head/escalated', {
      query: {
        limit: undefined,
      },
    })
  })

  it('loads the manager dashboard and normalizes the chart mixes', async () => {
    apiRequestMock.mockResolvedValueOnce({
      manager_id: 7,
      as_of: '2026-06-08',
      task_type_mix: [{ type: 'debt_followup', count: 3 }, null, { type: 12, count: 1 }],
      urgency_mix: [{ urgency: 'critical', count: 2 }, { urgency: 'bogus', count: 9 }],
      value_at_risk_eur: 4200.5,
      debt_aging: [{ bucket: '0-30', amount_eur: 1000, count: 2 }, 'noise'],
      completed_vs_open: [{ status: 'open', count: 4 }, { status: 'done', count: 1 }],
    })

    await expect(getDashboard('2026-06-08')).resolves.toEqual({
      manager_id: 7,
      as_of: '2026-06-08',
      task_type_mix: [{ type: 'debt_followup', count: 3 }],
      urgency_mix: [{ urgency: 'critical', count: 2 }],
      value_at_risk_eur: 4200.5,
      debt_aging: [{ bucket: '0-30', amount_eur: 1000, count: 2 }],
      completed_vs_open: [{ status: 'open', count: 4 }, { status: 'done', count: 1 }],
    })
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/cockpit/dashboard', {
      query: {
        asOfDate: '2026-06-08',
      },
    })
  })

  it('defaults the manager dashboard to an empty shape on a non-object response', async () => {
    apiRequestMock.mockResolvedValueOnce(null)

    await expect(getDashboard()).resolves.toEqual({
      manager_id: 0,
      as_of: null,
      task_type_mix: [],
      urgency_mix: [],
      value_at_risk_eur: 0,
      debt_aging: [],
      completed_vs_open: [],
    })
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/cockpit/dashboard', {
      query: {
        asOfDate: undefined,
      },
    })
  })

  it('loads the head dashboard and normalizes the team rows', async () => {
    apiRequestMock.mockResolvedValueOnce({
      is_head: true,
      as_of: '2026-06-08',
      teams: [{ manager_id: 7, open_tasks: 4, critical: 1, value_at_risk_eur: 1200 }, null],
      escalated_count: 2,
      total_value_at_risk_eur: 9800.25,
    })

    await expect(getHeadDashboard('2026-06-08')).resolves.toEqual({
      is_head: true,
      as_of: '2026-06-08',
      teams: [{ manager_id: 7, open_tasks: 4, critical: 1, value_at_risk_eur: 1200 }],
      escalated_count: 2,
      total_value_at_risk_eur: 9800.25,
    })
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/cockpit/head/dashboard', {
      query: {
        asOfDate: '2026-06-08',
      },
    })
  })

  it('defaults the head dashboard to a non-head empty shape on a non-object response', async () => {
    apiRequestMock.mockResolvedValueOnce(null)

    await expect(getHeadDashboard()).resolves.toEqual({
      is_head: false,
      as_of: null,
      teams: [],
      escalated_count: 0,
      total_value_at_risk_eur: 0,
    })
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/cockpit/head/dashboard', {
      query: {
        asOfDate: undefined,
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
