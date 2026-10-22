export const dashboardWorkspaceKeys = [
  'gba',
  'sales-manager',
  'sales-head',
  'buyer',
  'buyer-head',
  'logistics',
  'warehouse',
  'accounting',
  'finance',
  'executive',
  'system',
  'driver',
  'client',
] as const

export type DashboardWorkspaceKey = (typeof dashboardWorkspaceKeys)[number]

export type DashboardWorkspaceDescriptor = {
  group: string
  isAi: boolean
  key: DashboardWorkspaceKey
  name: string
}

export type DashboardWorkspaceCatalog = {
  canSwitchWorkspace: boolean
  defaultWorkspace: DashboardWorkspaceKey
  workspaces: DashboardWorkspaceDescriptor[]
}

export type DashboardWorkspaceMetricTone = 'critical' | 'neutral' | 'positive' | 'warning'

export type DashboardWorkspaceMetric = {
  coveragePercent: number | null
  formula?: string
  source?: string
  grain?: string
  scope?: string
  owner?: string
  unknownReason?: string
  sourceWatermarkUtc?: string
  asOfUtc?: string
  queueKey?: string
  hasData: boolean
  key: string
  label: string
  route?: string
  timeBasis?: 'current' | 'period' | 'unknown'
  tone: DashboardWorkspaceMetricTone
  unit: string
  value: number
}

export type DashboardWorkspaceSummary = {
  cacheTtlSeconds: number
  dataFreshness: string
  from: string
  generatedAtUtc: string
  metrics: DashboardWorkspaceMetric[]
  to: string
  workspace: DashboardWorkspaceKey
}

export type DashboardWorkspacePeriod = {
  from: string
  toExclusive: string
}
