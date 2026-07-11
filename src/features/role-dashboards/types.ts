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
  key: string
  label: string
  route?: string
  tone: DashboardWorkspaceMetricTone
  unit: string
  value: number
}

export type DashboardWorkspaceSummary = {
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
