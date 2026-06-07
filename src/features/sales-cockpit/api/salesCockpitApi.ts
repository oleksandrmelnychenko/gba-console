import { apiRequest } from '../../../shared/api/apiClient'
import type {
  CockpitCount,
  CockpitCountByUrgency,
  CockpitInbox,
  CockpitInboxParams,
  CockpitNoteBody,
  CockpitStatusBody,
  CockpitTask,
} from '../types'

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

function normalizeTask(value: unknown): CockpitTask | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  return value as CockpitTask
}

function isTask(value: CockpitTask | null): value is CockpitTask {
  return value !== null
}
