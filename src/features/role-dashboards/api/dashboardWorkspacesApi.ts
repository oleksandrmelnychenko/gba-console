import { apiRequest } from '../../../shared/api/apiClient'
import {
  dashboardWorkspaceKeys,
  type DashboardWorkspaceCatalog,
  type DashboardWorkspaceDescriptor,
  type DashboardWorkspaceKey,
  type DashboardWorkspaceMetric,
  type DashboardWorkspaceMetricTone,
  type DashboardWorkspacePeriod,
  type DashboardWorkspaceSummary,
} from '../types'

const workspaceKeySet = new Set<string>(dashboardWorkspaceKeys)

export async function getDashboardWorkspaceCatalog(signal?: AbortSignal): Promise<DashboardWorkspaceCatalog> {
  const payload = await apiRequest<unknown>('/dashboards/workspaces/catalog', signal ? { signal } : undefined)

  return normalizeDashboardWorkspaceCatalog(payload)
}

export async function getDashboardWorkspaceSummary(
  workspace: DashboardWorkspaceKey,
  period: DashboardWorkspacePeriod,
  signal?: AbortSignal,
): Promise<DashboardWorkspaceSummary> {
  const payload = await apiRequest<unknown>(`/dashboards/workspaces/${workspace}/summary`, {
    query: { from: period.from, to: period.toExclusive },
    ...(signal ? { signal } : {}),
  })

  return normalizeDashboardWorkspaceSummary(payload, workspace, period)
}

export function normalizeDashboardWorkspaceCatalog(payload: unknown): DashboardWorkspaceCatalog {
  const record = toRecord(payload)
  const rawWorkspaces = readArray(record.Workspaces ?? record.workspaces)
  const workspaces = rawWorkspaces
    .map(normalizeWorkspace)
    .filter((workspace): workspace is DashboardWorkspaceDescriptor => workspace !== null)
  const rawDefault = readString(record.DefaultWorkspace ?? record.defaultWorkspace)
  const defaultWorkspace = isWorkspaceKey(rawDefault) && workspaces.some((workspace) => workspace.key === rawDefault)
    ? rawDefault
    : workspaces[0]?.key ?? 'system'

  return {
    canSwitchWorkspace: readBoolean(record.CanSwitchWorkspace ?? record.canSwitchWorkspace),
    defaultWorkspace,
    workspaces,
  }
}

export function normalizeDashboardWorkspaceSummary(
  payload: unknown,
  fallbackWorkspace: DashboardWorkspaceKey,
  fallbackPeriod: DashboardWorkspacePeriod,
): DashboardWorkspaceSummary {
  const record = toRecord(payload)
  const workspace = readString(record.Workspace ?? record.workspace)

  return {
    from: readString(record.From ?? record.from) || fallbackPeriod.from,
    generatedAtUtc: readString(record.GeneratedAtUtc ?? record.generatedAtUtc),
    metrics: readArray(record.Metrics ?? record.metrics)
      .map(normalizeMetric)
      .filter((metric): metric is DashboardWorkspaceMetric => metric !== null),
    to: readString(record.To ?? record.to) || fallbackPeriod.toExclusive,
    workspace: isWorkspaceKey(workspace) ? workspace : fallbackWorkspace,
  }
}

function normalizeWorkspace(value: unknown): DashboardWorkspaceDescriptor | null {
  const record = toRecord(value)
  const key = readString(record.Key ?? record.key)

  if (!isWorkspaceKey(key)) {
    return null
  }

  return {
    group: readString(record.Group ?? record.group) || 'Інше',
    isAi: readBoolean(record.IsAi ?? record.isAi),
    key,
    name: readString(record.Name ?? record.name) || key,
  }
}

function normalizeMetric(value: unknown): DashboardWorkspaceMetric | null {
  const record = toRecord(value)
  const key = readString(record.Key ?? record.key)
  const label = readString(record.Label ?? record.label)

  if (!key || !label) {
    return null
  }

  return {
    key,
    label,
    route: readString(record.Route ?? record.route) || undefined,
    tone: readTone(record.Tone ?? record.tone),
    unit: readString(record.Unit ?? record.unit) || 'count',
    value: readNumber(record.Value ?? record.value),
  }
}

function isWorkspaceKey(value: string): value is DashboardWorkspaceKey {
  return workspaceKeySet.has(value)
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function readBoolean(value: unknown): boolean {
  return value === true
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value)
  }

  return 0
}

function readTone(value: unknown): DashboardWorkspaceMetricTone {
  const tone = readString(value)
  return tone === 'critical' || tone === 'positive' || tone === 'warning' ? tone : 'neutral'
}
