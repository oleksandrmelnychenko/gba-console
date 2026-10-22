import type { ContactEvent } from './contactTypes'
import type { CockpitTask } from './types'

export const WORKDAY_BUCKETS = {
  all: 'Усі', overdue: 'Прострочені', today: 'Сьогодні', in_progress: 'У роботі', upcoming: 'Заплановані', unscheduled: 'Без дати',
} as const
export type WorkdayBucket = keyof typeof WORKDAY_BUCKETS
export type WorkdayScope = 'active' | 'history'
export type WorkdayRow = {
  key: string; client_id: number | null; client_name: string; can_contact: boolean
  manager_id: number; manager_name: string; bucket: Exclude<WorkdayBucket, 'all'>; due_at: string | null
  task_count: number; in_progress_count: number; manual_count: number
  latest_contact: ContactEvent | null; primary_task: CockpitTask | null
}
type WorkdayPageBase = {
  manager_id: number; manager_net_uid: string; offset: number; limit: number; count: number; total: number
}
export type WorkdayPage = WorkdayPageBase & {
  as_of: string; timezone: 'Europe/Kyiv'; bucket: WorkdayBucket; search: string
  counts: Record<WorkdayBucket, number>; rows: WorkdayRow[]
}
export type WorkdayTasksPage = WorkdayPageBase & { key: string; scope: WorkdayScope; tasks: CockpitTask[] }
