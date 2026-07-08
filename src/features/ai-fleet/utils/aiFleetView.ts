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
