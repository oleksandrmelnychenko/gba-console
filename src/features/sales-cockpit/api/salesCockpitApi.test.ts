import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { addTaskNote, createHeadTask, getCockpitClients, getCockpitCount, getCockpitInbox, getCockpitTarget, getDashboard, getEscalated, getHeadClients, getHeadDashboard, getHeadDismissals, getHeadTasks, getHeadTeam, regenerateCockpit, SalesCockpitContractError, setTaskStatus } from './salesCockpitApi'
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

  it('creates a head task with the PascalCase body and returns the created doc', async () => {
    apiRequestMock.mockResolvedValueOnce({ task_key: 'manual|7|abc', task_type: 'manual', status: 'open' })

    await expect(createHeadTask({
      ManagerId: 7,
      ClientId: 10,
      Title: 'Зустрітись',
      Description: 'Деталі',
      Urgency: 'high',
      DueDate: '2026-08-01T15:00:00Z',
    })).resolves.toEqual({ task_key: 'manual|7|abc', task_type: 'manual', status: 'open' })
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/cockpit/head/tasks/new', {
      method: 'POST',
      body: {
        ManagerId: 7,
        ClientId: 10,
        Title: 'Зустрітись',
        Description: 'Деталі',
        Urgency: 'high',
        DueDate: '2026-08-01T15:00:00Z',
      },
    })
  })

  it('loads head clients and drops malformed rows', async () => {
    apiRequestMock.mockResolvedValueOnce({
      is_head: true,
      manager_id: 7,
      count: 3,
      clients: [{ client_id: 10, full_name: 'ТОВ Акме' }, { broken: true }, null],
    })

    const result = await getHeadClients(7)

    expect(result.is_head).toBe(true)
    expect(result.clients).toEqual([{ client_id: 10, full_name: 'ТОВ Акме' }])
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/cockpit/head/clients', {
      query: { managerId: 7 },
    })
  })

  it('loads dismissal analytics and drops malformed rows', async () => {
    apiRequestMock.mockResolvedValueOnce({
      is_head: true,
      window_days: 30,
      total_dismissed: 3,
      managers: [
        {
          manager_id: 7,
          manager_name: 'Іван',
          dismissed: 3,
          manual: 1,
          no_reason: 1,
          reasons: [{ reason: 'Ціна зависока', count: 2 }, { broken: true }, null],
        },
        { broken: true },
        null,
      ],
      top_reasons: [{ reason: 'Ціна зависока', count: 2, managers: 1 }, null],
    })

    const result = await getHeadDismissals({ windowDays: 30, managerId: 7 })

    expect(result.is_head).toBe(true)
    expect(result.total_dismissed).toBe(3)
    expect(result.managers).toEqual([
      {
        manager_id: 7,
        manager_name: 'Іван',
        dismissed: 3,
        manual: 1,
        no_reason: 1,
        reasons: [{ reason: 'Ціна зависока', count: 2 }],
      },
    ])
    expect(result.top_reasons).toEqual([{ reason: 'Ціна зависока', count: 2, managers: 1 }])
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/cockpit/head/dismissals', {
      query: { windowDays: 30, managerId: 7 },
    })
  })

  it('normalizes the cockpit client book and coerces numbers', async () => {
    apiRequestMock.mockResolvedValueOnce({
      manager_id: 7,
      count: 2,
      clients: [
        {
          client_id: 10,
          client_net_uid: 'aaa',
          name: 'Акме',
          orders_cnt: 4,
          turnover_eur: 1234.5,
          overdue_eur: 10,
          max_days_past_terms: 3,
        },
        { client_id: 11 }, // no net uid -> dropped
        null,
      ],
    })

    const result = await getCockpitClients()

    expect(result.clients).toHaveLength(1)
    expect(result.clients[0]).toMatchObject({
      client_id: 10,
      client_net_uid: 'aaa',
      orders_cnt: 4,
      turnover_eur: 1234.5,
      overdue_eur: 10,
      max_days_past_terms: 3,
    })
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/cockpit/clients')
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
      requested_manager_net_uid: '11111111-1111-1111-1111-111111111111',
      as_of: '2026-06-08',
      ...history('2025-06-08'),
      expected_manager_count: 1,
      returned_manager_count: 1,
      team: [
        {
          manager_id: 7,
          manager_name: 'Олена',
          target: {
            shipped: { target: 1000, mtd: 600, expected_to_date: 650, attainment_pct: 60, pace_status: 'behind' },
            paid: { target: 800, mtd: 800, expected_to_date: 520, attainment_pct: 100, pace_status: 'ahead' },
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

    await expect(getHeadTeam()).resolves.toEqual({
      is_head: true,
      requested_manager_net_uid: '11111111-1111-1111-1111-111111111111',
      as_of: '2026-06-08',
      ...history('2025-06-08'),
      expected_manager_count: 1,
      returned_manager_count: 1,
      team: [
        {
          manager_id: 7,
          manager_name: 'Олена',
          target: {
            shipped: { target: 1000, mtd: 600, expected_to_date: 650, attainment_pct: 60, pace_status: 'behind' },
            paid: { target: 800, mtd: 800, expected_to_date: 520, attainment_pct: 100, pace_status: 'ahead' },
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
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/cockpit/head/team')
  })

  it('defaults the head team to a non-head empty shape on a non-object response', async () => {
    apiRequestMock.mockResolvedValueOnce(null)

    await expect(getHeadTeam()).resolves.toEqual({
      is_head: false,
      requested_manager_net_uid: undefined,
      as_of: null,
      expected_manager_count: 0,
      returned_manager_count: 0,
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
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/cockpit/head/team')
  })

  it('loads head tasks with combined ready statuses and normalizes the live board payload', async () => {
    apiRequestMock.mockResolvedValueOnce({
      IsHead: true,
      RequestedManagerNetUid: '11111111-1111-1111-1111-111111111111',
      RequestedStatuses: ['open', 'in_progress'],
      RequestedManagerId: 7,
      RequestedUrgency: 'high',
      Skip: 50,
      Limit: 50,
      ReturnedCount: 1,
      Total: 2,
      Tasks: [
        {
          TaskKey: 'manager|client|reorder_due|week',
          ManagerId: 7,
          ManagerName: 'Олена',
          ClientId: null,
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
      IsHead: true,
      RequestedManagerNetUid: '11111111-1111-1111-1111-111111111111',
      RequestedStatuses: ['open', 'in_progress'],
      RequestedManagerId: 7,
      RequestedUrgency: 'high',
      RequestedTaskType: null,
      Skip: 50,
      Limit: 50,
      ReturnedCount: 1,
      Total: 2,
      Tasks: [
        {
          TaskKey: 'manager|client|reorder_due|week',
          ManagerId: 7,
          ManagerName: 'Олена',
          ClientId: null,
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
          Origin: null,
          CreatedBy: null,
          DueDate: null,
          Reason: null,
          ResolutionReason: null,
          Outcome: null,
          Notes: [],
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
        taskType: undefined,
        skip: 50,
        limit: 50,
      },
    })
  })

  it('fails closed when the head-task returned-count proof does not match the page', async () => {
    apiRequestMock.mockResolvedValueOnce({
      IsHead: true,
      RequestedManagerNetUid: '11111111-1111-1111-1111-111111111111',
      RequestedStatuses: ['open'],
      RequestedManagerId: null,
      RequestedUrgency: null,
      Skip: 0,
      Limit: 50,
      ReturnedCount: 1,
      Total: 1,
      Tasks: [],
      ByStatus: { Open: 1, InProgress: 0, Done: 0, Snoozed: 0, Dismissed: 0 },
      Managers: [],
    })

    await expect(getHeadTasks()).rejects.toBeInstanceOf(SalesCockpitContractError)
  })

  it('loads the manager target with the as-of date query and normalizes both metrics', async () => {
    apiRequestMock.mockResolvedValueOnce({
      manager_id: 7,
      manager_net_uid: '11111111-1111-1111-1111-111111111111',
      manager_name: 'Олена',
      month: '2026-06',
      as_of: '2026-06-08',
      ...history('2026-03-01'),
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
      manager_net_uid: '11111111-1111-1111-1111-111111111111',
      manager_name: 'Олена',
      month: '2026-06',
      as_of: '2026-06-08',
      ...history('2026-03-01'),
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

  it('fails closed when the manager target omits its history proof', async () => {
    apiRequestMock.mockResolvedValueOnce(null)

    await expect(getCockpitTarget()).rejects.toBeInstanceOf(SalesCockpitContractError)
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/cockpit/target', {
      query: {
        asOfDate: undefined,
      },
    })
  })

  it('loads escalated tasks with the limit query and normalizes the head payload', async () => {
    const task: CockpitTask = { task_key: 'mgr|client|debt_followup|w1', title: 'Контроль боргу' }

    apiRequestMock.mockResolvedValueOnce({
      is_head: true,
      requested_manager_net_uid: '11111111-1111-1111-1111-111111111111',
      requested_limit: 20,
      count: 1,
      tasks: [task, null, 'noise'],
    })

    await expect(getEscalated(20)).resolves.toEqual({
      is_head: true,
      requested_manager_net_uid: '11111111-1111-1111-1111-111111111111',
      requested_limit: 20,
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
      requested_manager_net_uid: undefined,
      requested_limit: 0,
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
      manager_net_uid: '11111111-1111-1111-1111-111111111111',
      as_of: '2026-06-08',
      ...history('2025-06-08'),
      task_type_mix: [{ type: 'debt_followup', count: 3 }, null, { type: 12, count: 1 }],
      urgency_mix: [{ urgency: 'critical', count: 2 }, { urgency: 'bogus', count: 9 }],
      value_at_risk_eur: 4200.5,
      debt_aging: [{ bucket: '0-30', amount_eur: 1000, count: 2 }, 'noise'],
      completed_vs_open: [{ status: 'open', count: 4 }, { status: 'done', count: 1 }],
    })

    await expect(getDashboard()).resolves.toEqual({
      manager_id: 7,
      manager_net_uid: '11111111-1111-1111-1111-111111111111',
      as_of: '2026-06-08',
      ...history('2025-06-08'),
      task_type_mix: [{ type: 'debt_followup', count: 3 }],
      urgency_mix: [{ urgency: 'critical', count: 2 }],
      value_at_risk_eur: 4200.5,
      debt_aging: [{ bucket: '0-30', amount_eur: 1000, count: 2 }],
      completed_vs_open: [{ status: 'open', count: 4 }, { status: 'done', count: 1 }],
    })
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/cockpit/dashboard')
  })

  it('fails closed when the manager dashboard omits its history proof', async () => {
    apiRequestMock.mockResolvedValueOnce(null)

    await expect(getDashboard()).rejects.toBeInstanceOf(SalesCockpitContractError)
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/cockpit/dashboard')
  })

  it('loads the head dashboard and normalizes the team rows', async () => {
    apiRequestMock.mockResolvedValueOnce({
      is_head: true,
      requested_manager_net_uid: '11111111-1111-1111-1111-111111111111',
      as_of: '2026-06-08',
      ...history('2025-06-08'),
      teams: [{ manager_id: 7, open_tasks: 4, critical: 1, value_at_risk_eur: 1200 }, null],
      escalated_count: 2,
      total_value_at_risk_eur: 9800.25,
    })

    await expect(getHeadDashboard()).resolves.toEqual({
      is_head: true,
      requested_manager_net_uid: '11111111-1111-1111-1111-111111111111',
      as_of: '2026-06-08',
      ...history('2025-06-08'),
      teams: [{ manager_id: 7, open_tasks: 4, critical: 1, value_at_risk_eur: 1200 }],
      escalated_count: 2,
      total_value_at_risk_eur: 9800.25,
    })
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/cockpit/head/dashboard')
  })

  it('defaults the head dashboard to a non-head empty shape on a non-object response', async () => {
    apiRequestMock.mockResolvedValueOnce(null)

    await expect(getHeadDashboard()).resolves.toEqual({
      is_head: false,
      requested_manager_net_uid: undefined,
      as_of: null,
      teams: [],
      escalated_count: 0,
      total_value_at_risk_eur: 0,
    })
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/cockpit/head/dashboard')
  })

  it('regenerates the cockpit with the optional as-of date and an empty body', async () => {
    apiRequestMock.mockResolvedValueOnce({
      manager_id: 7,
      manager_net_uid: '11111111-1111-1111-1111-111111111111',
      requested_as_of: '2026-06-06',
      as_of: '2026-06-06',
      ...history('2025-06-06'),
      candidates: 10,
      generators_total: 4,
      generators_failed: 0,
      by_type: { reorder_due: 5 },
      persisted: 5,
      skipped_muted: 1,
      skipped_capped: 2,
      refreshed: 2,
      crit_debt_reserved: 1,
    })

    await expect(regenerateCockpit('2026-06-06')).resolves.toEqual({
      manager_id: 7,
      manager_net_uid: '11111111-1111-1111-1111-111111111111',
      requested_as_of: '2026-06-06',
      as_of: '2026-06-06',
      ...history('2025-06-06'),
      candidates: 10,
      generators_total: 4,
      generators_failed: 0,
      by_type: { reorder_due: 5 },
      persisted: 5,
      skipped_muted: 1,
      skipped_capped: 2,
      refreshed: 2,
      crit_debt_reserved: 1,
    })
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/cockpit/generate', {
      method: 'POST',
      query: {
        asOfDate: '2026-06-06',
      },
      body: {},
    })
  })
})

function history(effectiveStart: string) {
  return {
    source_history_start: '2025-01-01',
    effective_start: effectiveStart,
    history_complete: true,
  }
}
