export type CockpitTaskType =
  | 'reorder_due'
  | 'debt_followup'
  | 'cross_sell'
  | 'churn_winback'
  | 'new_client_activation'

export type CockpitTaskStatus =
  | 'generated'
  | 'open'
  | 'in_progress'
  | 'done'
  | 'snoozed'
  | 'dismissed'

export type CockpitUrgency = 'critical' | 'high' | 'normal' | 'low'

export type Explanation = {
  factors?: string[]
  source_signal?: string
  confidence?: number
}

export type Contact = {
  phone?: string | null
  email?: string | null
  viber?: string | null
  preferred?: string | null
}

export type Note = {
  author_id?: number
  text?: string
  created_at?: string
}

export type CockpitTask = {
  task_key: string
  manager_id?: number
  client_id?: number
  client_name?: string | null
  task_type?: CockpitTaskType
  title?: string
  reason?: string
  priority?: number
  urgency?: CockpitUrgency
  status?: CockpitTaskStatus
  payload?: Record<string, unknown>
  signals?: Record<string, unknown>
  explanation?: Explanation
  contact?: Contact
  due_date?: string | null
  sla_breached?: boolean
  notes?: Note[]
  snooze_until?: string | null
  ab_variant?: string | null
  generated_at?: string | null
  updated_at?: string | null
  [key: string]: unknown
}

export type CockpitInbox = {
  manager_id?: number
  manager_net_uid?: string
  count: number
  tasks: CockpitTask[]
}

export type CockpitCountByUrgency = {
  critical: number
  high: number
  normal: number
  low: number
}

export type CockpitCount = {
  manager_id?: number
  active_count: number
  by_urgency: CockpitCountByUrgency
}

export type CockpitInboxParams = {
  limit?: number
  status?: string
}

export type CockpitStatusBody = {
  To: string
  Reason?: string
  Sold?: boolean
  Amount?: number
  SnoozeUntil?: string
}

export type CockpitNoteBody = {
  Text: string
}
