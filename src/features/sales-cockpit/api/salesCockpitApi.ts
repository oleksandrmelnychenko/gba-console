import { apiRequest } from '../../../shared/api/apiClient'
import type {
  CockpitCount,
  CockpitCountByUrgency,
  CockpitInbox,
  CockpitInboxParams,
  CockpitNoteBody,
  CockpitStatusBody,
  CockpitTarget,
  CockpitTargetMetric,
  CockpitTask,
  EscalatedResponse,
  EscalatedTask,
  HeadPaceStatus,
  HeadRowTarget,
  HeadRowTasks,
  HeadTargetMetric,
  HeadTeam,
  HeadTeamRow,
  HeadTeamTotals,
} from '../types'

const PACE_STATUSES: HeadPaceStatus[] = ['ahead', 'on', 'behind', 'no_target']

export async function getCockpitInbox(params: CockpitInboxParams = {}): Promise<CockpitInbox> {
  const result = await apiRequest<unknown>('/sales/cockpit/inbox', {
    query: {
      limit: params.limit,
      status: params.status,
    },
  })

  return normalizeInbox(result)
}

export async function getCockpitCount(): Promise<CockpitCount> {
  const result = await apiRequest<unknown>('/sales/cockpit/count')

  return normalizeCount(result)
}

export async function setTaskStatus(taskKey: string, body: CockpitStatusBody): Promise<CockpitTask | null> {
  const result = await apiRequest<unknown>('/sales/cockpit/tasks/status', {
    method: 'POST',
    query: {
      taskKey,
    },
    body,
  })

  return normalizeTask(result)
}

export async function addTaskNote(taskKey: string, body: CockpitNoteBody): Promise<CockpitTask | null> {
  const result = await apiRequest<unknown>('/sales/cockpit/tasks/notes', {
    method: 'POST',
    query: {
      taskKey,
    },
    body,
  })

  return normalizeTask(result)
}

export async function getHeadTeam(asOfDate?: string): Promise<HeadTeam> {
  const result = await apiRequest<unknown>('/sales/cockpit/head/team', {
    query: {
      asOfDate,
    },
  })

  return normalizeHeadTeam(result)
}

export async function getCockpitTarget(asOfDate?: string): Promise<CockpitTarget> {
  const result = await apiRequest<unknown>('/sales/cockpit/target', {
    query: {
      asOfDate,
    },
  })

  return normalizeCockpitTarget(result)
}

export async function getEscalated(limit?: number): Promise<EscalatedResponse> {
  const result = await apiRequest<unknown>('/sales/cockpit/head/escalated', {
    query: {
      limit,
    },
  })

  return normalizeEscalated(result)
}

export async function regenerateCockpit(asOfDate?: string): Promise<Record<string, unknown>> {
  const result = await apiRequest<unknown>('/sales/cockpit/generate', {
    method: 'POST',
    query: {
      asOfDate,
    },
    body: {},
  })

  return result && typeof result === 'object' ? (result as Record<string, unknown>) : {}
}

function normalizeInbox(result: unknown): CockpitInbox {
  const payload = result && typeof result === 'object' ? (result as Partial<CockpitInbox>) : {}
  const tasks = Array.isArray(payload.tasks)
    ? payload.tasks.reduce<CockpitTask[]>((acc, value) => {
        const task = normalizeTask(value)
        if (isTask(task)) acc.push(task)
        return acc
      }, [])
    : []

  return {
    ...payload,
    count: typeof payload.count === 'number' ? payload.count : tasks.length,
    tasks,
  }
}

function normalizeCount(result: unknown): CockpitCount {
  const payload = result && typeof result === 'object' ? (result as Partial<CockpitCount>) : {}
  const byUrgency = payload.by_urgency && typeof payload.by_urgency === 'object' ? payload.by_urgency : {}

  return {
    ...payload,
    active_count: typeof payload.active_count === 'number' ? payload.active_count : 0,
    by_urgency: normalizeByUrgency(byUrgency),
  }
}

function normalizeByUrgency(value: Partial<CockpitCountByUrgency>): CockpitCountByUrgency {
  return {
    critical: typeof value.critical === 'number' ? value.critical : 0,
    high: typeof value.high === 'number' ? value.high : 0,
    normal: typeof value.normal === 'number' ? value.normal : 0,
    low: typeof value.low === 'number' ? value.low : 0,
  }
}

function normalizeHeadTeam(result: unknown): HeadTeam {
  const payload = result && typeof result === 'object' ? (result as Partial<HeadTeam>) : {}
  const team = Array.isArray(payload.team)
    ? payload.team.reduce<HeadTeamRow[]>((acc, value) => {
        const row = normalizeHeadRow(value)
        if (row) acc.push(row)
        return acc
      }, [])
    : []

  return {
    is_head: payload.is_head === true,
    as_of: typeof payload.as_of === 'string' ? payload.as_of : null,
    team,
    totals: normalizeHeadTotals(payload.totals),
  }
}

function normalizeHeadRow(value: unknown): HeadTeamRow | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const row = value as Partial<HeadTeamRow>

  return {
    manager_id: typeof row.manager_id === 'number' ? row.manager_id : 0,
    manager_name: typeof row.manager_name === 'string' ? row.manager_name : null,
    target: normalizeHeadTarget(row.target),
    tasks: normalizeHeadTasks(row.tasks),
  }
}

function normalizeHeadTarget(value: unknown): HeadRowTarget {
  const target = value && typeof value === 'object' ? (value as Partial<HeadRowTarget>) : {}

  return {
    shipped: normalizeHeadMetric(target.shipped),
    paid: normalizeHeadMetric(target.paid),
  }
}

function normalizeHeadMetric(value: unknown): HeadTargetMetric {
  const metric = value && typeof value === 'object' ? (value as Partial<HeadTargetMetric>) : {}

  return {
    target: toNumber(metric.target),
    mtd: toNumber(metric.mtd),
    attainment_pct: toNumber(metric.attainment_pct),
    pace_status: PACE_STATUSES.includes(metric.pace_status as HeadPaceStatus)
      ? (metric.pace_status as HeadPaceStatus)
      : 'on',
  }
}

function normalizeHeadTasks(value: unknown): HeadRowTasks {
  const tasks = value && typeof value === 'object' ? (value as Partial<HeadRowTasks>) : {}

  return {
    active: toNumber(tasks.active),
    generated_month: toNumber(tasks.generated_month),
    done_month: toNumber(tasks.done_month),
    sold_month: toNumber(tasks.sold_month),
    dismissed_month: toNumber(tasks.dismissed_month),
    revenue_month: toNumber(tasks.revenue_month),
    close_rate: toNumber(tasks.close_rate),
    conversion_rate: toNumber(tasks.conversion_rate),
  }
}

function normalizeHeadTotals(value: unknown): HeadTeamTotals {
  const totals = value && typeof value === 'object' ? (value as Partial<HeadTeamTotals>) : {}

  return {
    shipped_target: toNumber(totals.shipped_target),
    shipped_mtd: toNumber(totals.shipped_mtd),
    paid_target: toNumber(totals.paid_target),
    paid_mtd: toNumber(totals.paid_mtd),
    generated_month: toNumber(totals.generated_month),
    done_month: toNumber(totals.done_month),
    sold_month: toNumber(totals.sold_month),
    dismissed_month: toNumber(totals.dismissed_month),
    revenue_month: toNumber(totals.revenue_month),
    close_rate: toNumber(totals.close_rate),
    conversion_rate: toNumber(totals.conversion_rate),
  }
}

function normalizeCockpitTarget(result: unknown): CockpitTarget {
  const payload = result && typeof result === 'object' ? (result as Partial<CockpitTarget>) : {}

  return {
    manager_id: typeof payload.manager_id === 'number' ? payload.manager_id : 0,
    manager_name: typeof payload.manager_name === 'string' ? payload.manager_name : null,
    month: typeof payload.month === 'string' ? payload.month : null,
    as_of: typeof payload.as_of === 'string' ? payload.as_of : null,
    working_days: toNumber(payload.working_days),
    working_days_elapsed: toNumber(payload.working_days_elapsed),
    shipped: normalizeCockpitMetric(payload.shipped),
    paid: normalizeCockpitMetric(payload.paid),
  }
}

function normalizeCockpitMetric(value: unknown): CockpitTargetMetric {
  const metric = value && typeof value === 'object' ? (value as Partial<CockpitTargetMetric>) : {}

  return {
    target: toNumber(metric.target),
    mtd: toNumber(metric.mtd),
    daily_pace: toNumber(metric.daily_pace),
    expected_to_date: toNumber(metric.expected_to_date),
    gap: toNumber(metric.gap),
    today_needed: toNumber(metric.today_needed),
    attainment_pct: toNumber(metric.attainment_pct),
    pace_status: PACE_STATUSES.includes(metric.pace_status as HeadPaceStatus)
      ? (metric.pace_status as HeadPaceStatus)
      : 'no_target',
  }
}

function normalizeEscalated(result: unknown): EscalatedResponse {
  const payload = result && typeof result === 'object' ? (result as Partial<EscalatedResponse>) : {}
  const tasks = Array.isArray(payload.tasks)
    ? payload.tasks.reduce<EscalatedTask[]>((acc, value) => {
        const task = normalizeTask(value)
        if (isTask(task)) acc.push(task)
        return acc
      }, [])
    : []

  return {
    is_head: payload.is_head === true,
    count: typeof payload.count === 'number' ? payload.count : tasks.length,
    tasks,
  }
}

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function normalizeTask(value: unknown): CockpitTask | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  return value as CockpitTask
}

function isTask(value: CockpitTask | null): value is CockpitTask {
  return value !== null
}
