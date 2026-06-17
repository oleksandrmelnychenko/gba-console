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

export type HeadPaceStatus = 'ahead' | 'on' | 'behind' | 'no_target'

export type CockpitTargetMetric = {
  target: number
  mtd: number
  daily_pace: number
  expected_to_date: number
  gap: number
  today_needed: number
  attainment_pct: number
  pace_status: HeadPaceStatus
}

export type CockpitTarget = {
  manager_id?: number
  manager_name?: string | null
  month?: string | null
  as_of?: string | null
  working_days: number
  working_days_elapsed: number
  shipped: CockpitTargetMetric
  paid: CockpitTargetMetric
}

export type EscalatedTask = CockpitTask

export type EscalatedResponse = {
  is_head: boolean
  count: number
  tasks: EscalatedTask[]
}

export type HeadTargetMetric = {
  target: number
  mtd: number
  attainment_pct: number
  pace_status: HeadPaceStatus
}

export type HeadRowTarget = {
  shipped: HeadTargetMetric
  paid: HeadTargetMetric
}

export type HeadRowTasks = {
  active: number
  generated_month: number
  done_month: number
  sold_month: number
  dismissed_month: number
  revenue_month: number
  close_rate: number
  conversion_rate: number
}

export type HeadTeamRow = {
  manager_id: number
  manager_name?: string | null
  target: HeadRowTarget
  tasks: HeadRowTasks
}

export type HeadTeamTotals = {
  shipped_target: number
  shipped_mtd: number
  paid_target: number
  paid_mtd: number
  generated_month: number
  done_month: number
  sold_month: number
  dismissed_month: number
  revenue_month: number
  close_rate: number
  conversion_rate: number
}

export type HeadTeam = {
  is_head: boolean
  as_of?: string | null
  team: HeadTeamRow[]
  totals: HeadTeamTotals
}

export type CockpitTaskTypeMix = {
  type: string
  count: number
}

export type CockpitUrgencyMix = {
  urgency: CockpitUrgency
  count: number
}

export type CockpitDebtAging = {
  bucket: string
  amount_eur: number
  count: number
}

export type CockpitCompletedVsOpen = {
  status: string
  count: number
}

export type CockpitDashboard = {
  manager_id: number
  as_of?: string | null
  task_type_mix: CockpitTaskTypeMix[]
  urgency_mix: CockpitUrgencyMix[]
  value_at_risk_eur: number
  debt_aging: CockpitDebtAging[]
  completed_vs_open: CockpitCompletedVsOpen[]
}

export type HeadDashboardTeam = {
  manager_id: number
  open_tasks: number
  critical: number
  value_at_risk_eur: number
}

export type HeadDashboard = {
  is_head: boolean
  as_of?: string | null
  teams: HeadDashboardTeam[]
  escalated_count: number
  total_value_at_risk_eur: number
}
