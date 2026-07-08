import type {
  AiFleetOperationState,
  AiFleetServiceDefinition,
  AiFleetServiceStatus,
  AiFleetState,
} from '../types'

export type AiFleetServiceView = {
  healthState: AiFleetState
  isProblem: boolean
  primaryRoute: string | null
  service: AiFleetServiceDefinition
  status?: AiFleetServiceStatus
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

export type AiFleetReadinessRow = {
  healthState: AiFleetState
  isStaleWarmup: boolean
  readinessPercent: number
  serviceId: string
  serviceName: string
  source: string
  warmupAgeHours: number | null
  warmupState: AiFleetState
}

export type AiFleetNextAction = {
  message: string
  serviceId: string
  serviceName: string
  severity: 'danger' | 'warning'
}

export type AiFleetAnalytics = {
  healthDistribution: AiFleetStateDistribution
  nextActions: AiFleetNextAction[]
  operationAgeHours: number | null
  operationDurationMinutes: number | null
  readinessRows: AiFleetReadinessRow[]
  staleWarmupCount: number
  totalReadinessPercent: number
  warmupDistribution: AiFleetStateDistribution
}

const WARMUP_STALE_HOURS = 30

export function buildAiFleetServiceViews(
  services: AiFleetServiceDefinition[],
  statuses: AiFleetServiceStatus[],
): AiFleetServiceView[] {
  const statusByService = new Map(statuses.map((status) => [status.serviceId, status]))

  return services.map((service) => {
    const status = statusByService.get(service.id)
    const healthState = status?.health.state ?? 'unknown'
    const warmupState = status?.warmup.state ?? 'unknown'

    return {
      healthState,
      isProblem: healthState !== 'healthy' || warmupState !== 'healthy',
      primaryRoute: getAiFleetPrimaryRoute(service.location),
      service,
      status,
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
    if (row.warmupState === 'healthy') {
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
  const warmupDistribution = buildStateDistribution(rows, (row) => row.warmupState)
  const readinessRows = rows
    .map((row) => buildReadinessRow(row, nowMs))
    .toSorted((left, right) => {
      if (left.readinessPercent !== right.readinessPercent) {
        return left.readinessPercent - right.readinessPercent
      }

      return (right.warmupAgeHours ?? -1) - (left.warmupAgeHours ?? -1)
    })
  const staleWarmupCount = readinessRows.filter((row) => row.isStaleWarmup).length
  const totalReadinessPercent =
    readinessRows.length === 0
      ? 0
      : Math.round(readinessRows.reduce((sum, row) => sum + row.readinessPercent, 0) / readinessRows.length)

  return {
    healthDistribution,
    nextActions: buildNextActions(readinessRows),
    operationAgeHours: diffHours(operation?.lastFinishedAtUtc, undefined, nowMs),
    operationDurationMinutes: diffMinutes(operation?.lastStartedAtUtc, operation?.lastFinishedAtUtc),
    readinessRows,
    staleWarmupCount,
    totalReadinessPercent,
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
  const isStaleWarmup = warmupAgeHours !== null && warmupAgeHours > WARMUP_STALE_HOURS
  const healthyChecks = Number(row.healthState === 'healthy') + Number(row.warmupState === 'healthy' && !isStaleWarmup)

  return {
    healthState: row.healthState,
    isStaleWarmup,
    readinessPercent: healthyChecks * 50,
    serviceId: row.service.id,
    serviceName: row.service.name,
    source: row.service.source,
    warmupAgeHours,
    warmupState: row.warmupState,
  }
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

    if (row.healthState === 'unknown' || row.warmupState === 'unknown') {
      actions.push({
        message: 'Немає повного статусу. Дотягнути health/warmup telemetry для сервісу.',
        serviceId: row.serviceId,
        serviceName: row.serviceName,
        severity: 'warning',
      })
    }
  }

  return actions.slice(0, 5)
}

function diffMinutes(start: string | undefined, end: string | undefined): number | null {
  const startMs = parseDateMs(start)
  const endMs = parseDateMs(end)

  if (startMs === null || endMs === null || endMs < startMs) {
    return null
  }

  return Math.round((endMs - startMs) / 60_000)
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
