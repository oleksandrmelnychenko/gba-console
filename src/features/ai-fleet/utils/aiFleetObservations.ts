import type {
  AiFleetAnalytics,
  AiFleetEffectiveState,
} from './aiFleetView'

export type AiFleetObservedService = {
  health: AiFleetEffectiveState
  serviceId: string
  warmup: AiFleetEffectiveState
}

export type AiFleetObservation = {
  capturedAtMs: number
  services: AiFleetObservedService[]
}

export type AiFleetSessionPoint = {
  capturedAtMs: number
  fail: number | null
  pass: number | null
  total: number | null
  unknown: number | null
  warning: number | null
}

export const AI_FLEET_OBSERVATION_BUCKET_MS = 30_000
export const AI_FLEET_MAX_OBSERVATIONS = 120
export const AI_FLEET_GAP_MS = 75_000

export function buildAiFleetObservation(
  analytics: AiFleetAnalytics,
  capturedAtMs: number,
): AiFleetObservation {
  return {
    capturedAtMs,
    services: analytics.readinessRows.map((row) => ({
      health: row.healthCheckState,
      serviceId: row.serviceId,
      warmup: row.warmupCheckState,
    })),
  }
}

export function appendAiFleetObservation(
  history: AiFleetObservation[],
  observation: AiFleetObservation,
  bucketMs = AI_FLEET_OBSERVATION_BUCKET_MS,
  maxPoints = AI_FLEET_MAX_OBSERVATIONS,
): AiFleetObservation[] {
  if (!Number.isFinite(observation.capturedAtMs) || observation.services.length === 0) {
    return history
  }

  const last = history.at(-1)

  if (last && observation.capturedAtMs < last.capturedAtMs) {
    return history
  }

  const nextBucket = Math.floor(observation.capturedAtMs / bucketMs)
  const lastBucket = last ? Math.floor(last.capturedAtMs / bucketMs) : null
  const next = lastBucket === nextBucket
    ? [...history.slice(0, -1), observation]
    : [...history, observation]

  return next.slice(-Math.max(1, maxPoints))
}

export function buildAiFleetSessionSeries(
  history: AiFleetObservation[],
  gapMs = AI_FLEET_GAP_MS,
): AiFleetSessionPoint[] {
  const points: AiFleetSessionPoint[] = []
  let previousCapturedAt: number | null = null

  for (const observation of history) {
    if (previousCapturedAt !== null && observation.capturedAtMs - previousCapturedAt > gapMs) {
      points.push({
        capturedAtMs: previousCapturedAt + Math.floor((observation.capturedAtMs - previousCapturedAt) / 2),
        fail: null,
        pass: null,
        total: null,
        unknown: null,
        warning: null,
      })
    }

    points.push(summarizeObservation(observation))
    previousCapturedAt = observation.capturedAtMs
  }

  return points
}

function summarizeObservation(observation: AiFleetObservation): AiFleetSessionPoint {
  const counts: Record<AiFleetEffectiveState, number> = {
    fail: 0,
    pass: 0,
    unknown: 0,
    warning: 0,
  }

  for (const service of observation.services) {
    counts[service.health] += 1
    counts[service.warmup] += 1
  }

  return {
    capturedAtMs: observation.capturedAtMs,
    fail: counts.fail,
    pass: counts.pass,
    total: observation.services.length * 2,
    unknown: counts.unknown,
    warning: counts.warning,
  }
}
