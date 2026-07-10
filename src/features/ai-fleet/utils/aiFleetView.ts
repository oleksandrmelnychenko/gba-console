import type {
  AiFleetOperationState,
  AiFleetServiceDefinition,
  AiFleetServiceStatus,
  AiFleetState,
} from '../types'

export type AiFleetServiceView = {
  healthState: AiFleetState
  isProblem: boolean
  isStaleWarmup: boolean
  primaryRoute: string | null
  service: AiFleetServiceDefinition
  status?: AiFleetServiceStatus
  warmupAgeHours: number | null
  warmupState: AiFleetState
}

export type AiFleetSummary = {
  checked: number
  healthDown: number
  healthHealthy: number
  problemCount: number
  total: number
  warmupDown: number
  warmupHealthy: number
}

export type AiFleetStateDistribution = {
  down: number
  healthy: number
  unknown: number
}

export type AiFleetEffectiveState = 'fail' | 'pass' | 'unknown' | 'warning'

export type AiFleetCheckBreakdown = Record<AiFleetEffectiveState, number> & {
  total: number
}

export type AiFleetReadinessRow = {
  healthCheckState: AiFleetEffectiveState
  healthState: AiFleetState
  isStaleWarmup: boolean
  readinessPercent: number
  serviceId: string
  serviceName: string
  source: string
  warmupAgeHours: number | null
  warmupCheckState: AiFleetEffectiveState
  warmupState: AiFleetState
}

export type AiFleetNextAction = {
  message: string
  serviceId: string
  serviceName: string
  severity: 'danger' | 'warning'
}

export type AiFleetAnalytics = {
  apiBreakdown: AiFleetCheckBreakdown
  healthDistribution: AiFleetStateDistribution
  nextActions: AiFleetNextAction[]
  operationAgeHours: number | null
  operationAgeState: AiFleetEffectiveState
  operationDurationMinutes: number | null
  operationDurationState: AiFleetEffectiveState
  readinessRows: AiFleetReadinessRow[]
  staleWarmupCount: number
  passedCheckCount: number
  totalCheckCount: number
  totalReadinessPercent: number
  warmupBreakdown: AiFleetCheckBreakdown
  warmupDistribution: AiFleetStateDistribution
}

export const AI_FLEET_WARMUP_STALE_HOURS = 30
export const AI_FLEET_WARMUP_DURATION_TARGET_MINUTES = 30

export function buildAiFleetServiceViews(
  services: AiFleetServiceDefinition[],
  statuses: AiFleetServiceStatus[],
  nowMs = Date.now(),
): AiFleetServiceView[] {
  const statusByService = new Map(statuses.map((status) => [status.serviceId, status]))

  return services.map((service) => {
    const status = statusByService.get(service.id)
    const healthState = status?.health.state ?? 'unknown'
    const warmupState = status?.warmup.state ?? 'unknown'
    const warmupAgeHours = diffHours(status?.warmup.lastFinishedAtUtc, undefined, nowMs)
    const isStaleWarmup = isOlderThanHours(
      status?.warmup.lastFinishedAtUtc,
      AI_FLEET_WARMUP_STALE_HOURS,
      nowMs,
    )
    const hasCurrentWarmup = warmupState === 'healthy' && warmupAgeHours !== null && !isStaleWarmup

    return {
      healthState,
      isProblem: healthState !== 'healthy' || !hasCurrentWarmup,
      isStaleWarmup,
      primaryRoute: getAiFleetPrimaryRoute(service.location),
      service,
      status,
      warmupAgeHours,
      warmupState,
    }
  })
}

export function buildAiFleetSummary(rows: AiFleetServiceView[]): AiFleetSummary {
  let checked = 0
  let healthDown = 0
  let healthHealthy = 0
  let problemCount = 0
  let warmupDown = 0
  let warmupHealthy = 0

  for (const row of rows) {
    if (row.status) {
      checked += 1
    }
    if (row.healthState === 'healthy') {
      healthHealthy += 1
    }
    if (row.healthState === 'down') {
      healthDown += 1
    }
    if (row.warmupState === 'healthy' && row.warmupAgeHours !== null && !row.isStaleWarmup) {
      warmupHealthy += 1
    }
    if (row.warmupState === 'down') {
      warmupDown += 1
    }
    if (row.isProblem) {
      problemCount += 1
    }
  }

  return {
    checked,
    healthDown,
    healthHealthy,
    problemCount,
    total: rows.length,
    warmupDown,
    warmupHealthy,
  }
}

export function buildAiFleetAnalytics(
  rows: AiFleetServiceView[],
  operation?: AiFleetOperationState,
  nowMs = Date.now(),
): AiFleetAnalytics {
  const healthDistribution = buildStateDistribution(rows, (row) => row.healthState)
  const readinessRows = rows
    .map((row) => buildReadinessRow(row, nowMs))
    .toSorted((left, right) => {
      if (left.readinessPercent !== right.readinessPercent) {
        return left.readinessPercent - right.readinessPercent
      }

      return (right.warmupAgeHours ?? -1) - (left.warmupAgeHours ?? -1)
    })
  const apiBreakdown = buildCheckBreakdown(readinessRows.map((row) => row.healthCheckState))
  const warmupBreakdown = buildCheckBreakdown(readinessRows.map((row) => row.warmupCheckState))
  const warmupDistribution = buildEffectiveWarmupDistribution(readinessRows)
  const staleWarmupCount = readinessRows.filter((row) => row.isStaleWarmup).length
  const passedCheckCount = apiBreakdown.pass + warmupBreakdown.pass
  const totalCheckCount = apiBreakdown.total + warmupBreakdown.total
  const totalReadinessPercent =
    totalCheckCount === 0
      ? 0
      : Math.round((passedCheckCount / totalCheckCount) * 100)

  return {
    apiBreakdown,
    healthDistribution,
    nextActions: buildNextActions(readinessRows),
    operationAgeHours: diffHours(operation?.lastFinishedAtUtc, undefined, nowMs),
    operationAgeState: classifyOperationAge(operation?.lastFinishedAtUtc, nowMs),
    operationDurationMinutes: diffMinutes(operation?.lastStartedAtUtc, operation?.lastFinishedAtUtc),
    operationDurationState: classifyOperationDuration(
      operation?.lastStartedAtUtc,
      operation?.lastFinishedAtUtc,
    ),
    passedCheckCount,
    readinessRows,
    staleWarmupCount,
    totalCheckCount,
    totalReadinessPercent,
    warmupBreakdown,
    warmupDistribution,
  }
}

export function getAiFleetPrimaryRoute(location: string): string | null {
  const route = location
    .split(',')
    .map((part) => part.trim())
    .find((part) => part.startsWith('/'))

  return route ?? null
}

export function buildAiFleetDiagnosticText(
  row: AiFleetServiceView,
  operation?: AiFleetOperationState,
): string {
  const { service, status } = row
  const lines = [
    `AI service: ${service.name}`,
    `Source: ${service.source}`,
    `Location: ${service.location}`,
    `Health: ${row.healthState}`,
    status?.health.message ? `Health message: ${status.health.message}` : undefined,
    `05:00 warmup: ${row.warmupState}`,
    row.warmupAgeHours !== null ? `05:00 age hours: ${row.warmupAgeHours}` : undefined,
    row.isStaleWarmup ? '05:00 freshness: stale' : undefined,
    status?.warmup.message ? `05:00 message: ${status.warmup.message}` : undefined,
    status?.warmup.lastStartedAtUtc ? `05:00 started: ${status.warmup.lastStartedAtUtc}` : undefined,
    status?.warmup.lastFinishedAtUtc ? `05:00 finished: ${status.warmup.lastFinishedAtUtc}` : undefined,
    operation?.state ? `Fleet job state: ${operation.state}` : undefined,
    operation?.lastStartedAtUtc ? `Fleet job started: ${operation.lastStartedAtUtc}` : undefined,
    operation?.lastFinishedAtUtc ? `Fleet job finished: ${operation.lastFinishedAtUtc}` : undefined,
    operation?.logFilePath ? `Log: ${operation.logFilePath}` : undefined,
    `Description: ${service.description}`,
  ].filter((line): line is string => Boolean(line))

  return lines.join('\n')
}

function buildStateDistribution(
  rows: AiFleetServiceView[],
  readState: (row: AiFleetServiceView) => AiFleetState,
): AiFleetStateDistribution {
  const distribution: AiFleetStateDistribution = {
    down: 0,
    healthy: 0,
    unknown: 0,
  }

  for (const row of rows) {
    distribution[readState(row)] += 1
  }

  return distribution
}

function buildReadinessRow(row: AiFleetServiceView, nowMs: number): AiFleetReadinessRow {
  const warmupAgeHours = diffHours(row.status?.warmup.lastFinishedAtUtc, undefined, nowMs)
  const isStaleWarmup = isOlderThanHours(
    row.status?.warmup.lastFinishedAtUtc,
    AI_FLEET_WARMUP_STALE_HOURS,
    nowMs,
  )
  const healthCheckState = toHealthCheckState(row.healthState)
  const warmupCheckState = toWarmupCheckState(row.warmupState, warmupAgeHours, isStaleWarmup)
  const passedChecks = Number(healthCheckState === 'pass') + Number(warmupCheckState === 'pass')

  return {
    healthCheckState,
    healthState: row.healthState,
    isStaleWarmup,
    readinessPercent: passedChecks * 50,
    serviceId: row.service.id,
    serviceName: row.service.name,
    source: row.service.source,
    warmupAgeHours,
    warmupCheckState,
    warmupState: row.warmupState,
  }
}

function toHealthCheckState(state: AiFleetState): AiFleetEffectiveState {
  if (state === 'healthy') {
    return 'pass'
  }

  if (state === 'down') {
    return 'fail'
  }

  return 'unknown'
}

function toWarmupCheckState(
  state: AiFleetState,
  ageHours: number | null,
  isStale: boolean,
): AiFleetEffectiveState {
  if (state === 'down') {
    return 'fail'
  }

  if (state !== 'healthy' || ageHours === null) {
    return 'unknown'
  }

  return isStale ? 'warning' : 'pass'
}

function buildCheckBreakdown(states: AiFleetEffectiveState[]): AiFleetCheckBreakdown {
  const breakdown: AiFleetCheckBreakdown = {
    fail: 0,
    pass: 0,
    total: states.length,
    unknown: 0,
    warning: 0,
  }

  for (const state of states) {
    breakdown[state] += 1
  }

  return breakdown
}

function buildEffectiveWarmupDistribution(rows: AiFleetReadinessRow[]): AiFleetStateDistribution {
  const distribution: AiFleetStateDistribution = { down: 0, healthy: 0, unknown: 0 }

  for (const row of rows) {
    if (row.warmupCheckState === 'pass') {
      distribution.healthy += 1
    } else if (row.warmupCheckState === 'fail') {
      distribution.down += 1
    } else {
      distribution.unknown += 1
    }
  }

  return distribution
}

function buildNextActions(rows: AiFleetReadinessRow[]): AiFleetNextAction[] {
  const actions: AiFleetNextAction[] = []

  for (const row of rows) {
    if (row.healthState === 'down') {
      actions.push({
        message: 'Health check не проходить. Перевірити проксі, ключі та upstream сервіс.',
        serviceId: row.serviceId,
        serviceName: row.serviceName,
        severity: 'danger',
      })
      continue
    }

    if (row.warmupState === 'down') {
      actions.push({
        message: '05:00 warmup завершився помилкою. Відкрити лог і перезапустити warmup.',
        serviceId: row.serviceId,
        serviceName: row.serviceName,
        severity: 'danger',
      })
      continue
    }

    if (row.isStaleWarmup) {
      actions.push({
        message: 'Статус 05:00 застарів. Перевірити scheduler або вручну запустити warmup.',
        serviceId: row.serviceId,
        serviceName: row.serviceName,
        severity: 'warning',
      })
      continue
    }

    if (row.warmupState === 'healthy' && row.warmupAgeHours === null) {
      actions.push({
        message: '05:00 статус не має часу завершення. Перевірити формат warmup telemetry.',
        serviceId: row.serviceId,
        serviceName: row.serviceName,
        severity: 'warning',
      })
      continue
    }

    if (row.healthState === 'unknown' || row.warmupState === 'unknown') {
      actions.push({
        message: 'Немає повного статусу. Дотягнути health/warmup telemetry для сервісу.',
        serviceId: row.serviceId,
        serviceName: row.serviceName,
        severity: 'warning',
      })
    }
  }

  return actions
}

function diffMinutes(start: string | undefined, end: string | undefined): number | null {
  const startMs = parseDateMs(start)
  const endMs = parseDateMs(end)

  if (startMs === null || endMs === null || endMs < startMs) {
    return null
  }

  return Math.round((endMs - startMs) / 60_000)
}

function classifyOperationDuration(
  start: string | undefined,
  end: string | undefined,
): AiFleetEffectiveState {
  const startMs = parseDateMs(start)
  const endMs = parseDateMs(end)

  if (startMs === null || endMs === null || endMs < startMs) {
    return 'unknown'
  }

  return endMs - startMs > AI_FLEET_WARMUP_DURATION_TARGET_MINUTES * 60_000
    ? 'fail'
    : 'pass'
}

function classifyOperationAge(value: string | undefined, nowMs: number): AiFleetEffectiveState {
  const valueMs = parseDateMs(value)

  if (valueMs === null || nowMs < valueMs) {
    return 'unknown'
  }

  return nowMs - valueMs > AI_FLEET_WARMUP_STALE_HOURS * 3_600_000
    ? 'warning'
    : 'pass'
}

function diffHours(start: string | undefined, end: string | undefined, nowMs: number): number | null {
  const startMs = parseDateMs(start)
  const endMs = end ? parseDateMs(end) : nowMs

  if (startMs === null || endMs === null || endMs < startMs) {
    return null
  }

  return Math.round(((endMs - startMs) / 3_600_000) * 10) / 10
}

function parseDateMs(value: string | undefined): number | null {
  if (!value) {
    return null
  }

  const ms = new Date(value).getTime()

  return Number.isNaN(ms) ? null : ms
}

function isOlderThanHours(value: string | undefined, hours: number, nowMs: number): boolean {
  const valueMs = parseDateMs(value)

  return valueMs !== null && nowMs >= valueMs && nowMs - valueMs > hours * 3_600_000
}
