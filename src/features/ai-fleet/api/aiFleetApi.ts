import { ApiError, apiRequest } from '../../../shared/api/apiClient'
import type {
  AiFleetHealthState,
  AiFleetOperationState,
  AiFleetServiceDefinition,
  AiFleetServicesSnapshot,
  AiFleetServiceStatus,
  AiFleetWarmupState,
} from '../types'

export const AI_FLEET_SERVICES: AiFleetServiceDefinition[] = [
  {
    description: 'Рейтинги асортименту, стан товарних позицій, залишки, маржа, повернення та повна картка товару.',
    healthPath: '/products/intelligence/health',
    id: 'products',
    location: '/products/assortment',
    name: 'gba-products',
    source: 'ProductsApi',
  },
  {
    description: 'Прогноз продажів за клієнтом і товаром, графіки очікуваного попиту.',
    healthPath: '/sales/prediction/health',
    id: 'forecast',
    location: '/sales/ukraine/prediction',
    name: 'gba-forecast',
    source: 'ForecastApi',
  },
  {
    description: 'Завдання для відділу продажів, пріоритети менеджерів та панель керівника.',
    healthPath: '/sales/cockpit/health',
    id: 'nba',
    location: '/sales/cockpit, /sales/cockpit/head',
    name: 'gba-nba',
    source: 'GbaNbaApi',
  },
  {
    description: 'Робоче місце закупівельника, план закупівель, графіки попиту та бюджетний кошик.',
    healthPath: '/procurement/health',
    id: 'procurement',
    location: '/basket-supply-ukraine-order/dashboard, /basket-supply-ukraine-order/cockpit, /basket-supply-ukraine-order/budget-cart',
    name: 'gba-procure',
    source: 'ProcurementApi',
  },
  {
    description: 'Оцінка платоспроможності клієнта та сигнали ризику в його картці.',
    healthPath: '/solvency/health',
    id: 'solvency',
    location: 'Картка клієнта -> Платоспроможність',
    name: 'gba-solvency',
    source: 'SolvencyApi',
  },
  {
    description: 'Рекомендації щодо переміщення на Україну та доповнення кошика.',
    healthPath: '/recommendations/health',
    id: 'recommendations',
    location: '/basket-supply-ukraine-order/recommendations',
    name: 'gba-reco',
    source: 'RecommendationApi',
  },
  {
    description: 'Рекомендації цін та підказки з ціноутворення для клієнтських сценаріїв.',
    healthPath: '/pricing/health',
    id: 'pricing',
    location: 'Прайси / підказки ціноутворення',
    name: 'gba-pricing',
    source: 'PricingApi',
  },
]

export async function getAiFleetServicesStatus(signal?: AbortSignal): Promise<AiFleetServiceStatus[]> {
  const snapshot = await getAiFleetServicesSnapshot(signal)
  return snapshot.statuses
}

export async function getAiFleetServicesSnapshot(signal?: AbortSignal): Promise<AiFleetServicesSnapshot> {
  const [statuses, warmupSnapshot] = await Promise.all([
    Promise.all(AI_FLEET_SERVICES.map((service) => getAiServiceStatus(service, signal))),
    getAiFleetWarmupSnapshot(signal),
  ])

  if (warmupSnapshot.statuses.size === 0 && !warmupSnapshot.operation) {
    return {
      statuses: statuses.map((status) => ({
        ...status,
        warmup: warmupSnapshot.error
          ? { message: warmupSnapshot.error, state: 'unknown' }
          : status.warmup,
      })),
      telemetryError: warmupSnapshot.error,
    }
  }

  return {
    statuses: statuses.map((status) => ({
      ...status,
      operation: warmupSnapshot.operation,
      warmup: warmupSnapshot.statuses.get(status.serviceId)
        ?? (warmupSnapshot.error ? { message: warmupSnapshot.error, state: 'unknown' } : status.warmup),
    })),
    telemetryError: warmupSnapshot.error,
  }
}

export async function getAiFleetServiceStatus(
  serviceId: string,
  signal?: AbortSignal,
): Promise<AiFleetServiceStatus | null> {
  const service = AI_FLEET_SERVICES.find((item) => item.id === serviceId)

  if (!service) {
    return null
  }

  const [status, warmupSnapshot] = await Promise.all([
    getAiServiceStatus(service, signal),
    getAiFleetWarmupSnapshot(signal),
  ])

  return {
    ...status,
    operation: warmupSnapshot.operation,
    warmup: warmupSnapshot.statuses.get(status.serviceId)
      ?? (warmupSnapshot.error ? { message: warmupSnapshot.error, state: 'unknown' } : status.warmup),
  }
}

export async function triggerAiFleetWarmup(): Promise<void> {
  await apiRequest<unknown>('/tasks/scheduler/ai/warmup')
}

async function getAiFleetWarmupSnapshot(signal?: AbortSignal): Promise<{
  error?: string
  operation?: AiFleetOperationState
  statuses: Map<string, AiFleetWarmupState>
}> {
  try {
    const payload = await apiRequest<unknown>('/ai/fleet/status', { signal })
    const rawServices = readProperty(payload, 'Services') ?? readProperty(payload, 'services')
    const services = readArray(rawServices)
    const statuses = new Map<string, AiFleetWarmupState>()
    const invalidServiceIds = new Set<string>()
    const operation = normalizeOperation(payload)

    for (const service of services) {
      if (!service || typeof service !== 'object') {
        continue
      }

      const record = service as Record<string, unknown>
      const serviceId = readString(record.ServiceId ?? record.serviceId)

      if (!serviceId) {
        continue
      }

      const rawState = readString(record.State ?? record.state)

      if (!rawState) {
        invalidServiceIds.add(serviceId)
      }

      statuses.set(serviceId, {
        lastFinishedAtUtc: readDateString(record.LastFinishedAtUtc ?? record.lastFinishedAtUtc),
        lastStartedAtUtc: readDateString(record.LastStartedAtUtc ?? record.lastStartedAtUtc),
        message: readString(record.Message ?? record.message) || undefined,
        source: readString(record.Source ?? record.source) || undefined,
        state: normalizeState(rawState),
      })
    }

    return {
      error: validateWarmupSnapshot(payload, rawServices, statuses, invalidServiceIds),
      operation,
      statuses,
    }
  } catch (error) {
    const reason = error instanceof Error && error.message.trim()
      ? error.message.trim()
      : 'Не вдалося отримати агрегований статус AI warmup.'

    return {
      error: `Статус 05:00 недоступний: ${reason}`,
      statuses: new Map(),
    }
  }
}

function validateWarmupSnapshot(
  payload: unknown,
  rawServices: unknown,
  statuses: Map<string, AiFleetWarmupState>,
  invalidServiceIds: Set<string>,
): string | undefined {
  if (!payload || typeof payload !== 'object' || !Array.isArray(rawServices)) {
    return 'Статус 05:00 повернув некоректну відповідь.'
  }

  const record = payload as Record<string, unknown>
  const operationState = readString(record.OperationState ?? record.operationState)
  const missingServiceIds = AI_FLEET_SERVICES
    .map((service) => service.id)
    .filter((serviceId) => !statuses.has(serviceId))

  if (!operationState || missingServiceIds.length > 0 || invalidServiceIds.size > 0) {
    const details = [
      !operationState ? 'немає стану операції' : undefined,
      missingServiceIds.length > 0 ? `немає сервісів: ${missingServiceIds.join(', ')}` : undefined,
      invalidServiceIds.size > 0 ? `немає стану сервісів: ${Array.from(invalidServiceIds).join(', ')}` : undefined,
    ].filter((detail): detail is string => Boolean(detail))

    return `Статус 05:00 повернув неповні дані (${details.join('; ')}).`
  }

  return undefined
}

async function getAiServiceStatus(
  service: AiFleetServiceDefinition,
  signal?: AbortSignal,
): Promise<AiFleetServiceStatus> {
  const warmup: AiFleetWarmupState = {
    message: 'Сервер поки не публікує агрегований статус 05:00 warmup у API.',
    state: 'unknown',
  }

  if (!service.healthPath) {
    return {
      health: {
        message: 'Health endpoint у gba-server для цього проксі ще не підключений.',
        state: 'unknown',
      },
      serviceId: service.id,
      warmup,
    }
  }

  try {
    const payload = await apiRequest<unknown>(service.healthPath, {
      signal,
      errorMessages: {
        network: 'Не вдалося отримати health AI-сервісу.',
      },
    })

    return {
      health: normalizeHealth(payload),
      serviceId: service.id,
      warmup,
    }
  } catch (error) {
    return {
      health: {
        message: error instanceof ApiError || error instanceof Error ? error.message : 'Health check не пройшов.',
        state: 'down',
      },
      serviceId: service.id,
      warmup,
    }
  }
}

function normalizeHealth(payload: unknown): AiFleetHealthState {
  if (typeof payload === 'boolean') {
    return { state: payload ? 'healthy' : 'down' }
  }

  if (!payload || typeof payload !== 'object') {
    return { message: 'Health endpoint повернув неочікувану відповідь.', state: 'unknown' }
  }

  const record = payload as Record<string, unknown>
  const healthy = record.healthy ?? record.Healthy
  const status = String(record.status ?? record.Status ?? '').toLowerCase()

  if (healthy === true || status === 'healthy' || status === 'ok') {
    return { state: 'healthy' }
  }

  if (healthy === false || status === 'unhealthy' || status === 'down' || status === 'degraded') {
    return {
      message: readMessage(record) || 'Health endpoint повернув негативний статус.',
      state: 'down',
    }
  }

  return {
    message: readMessage(record) || 'Health endpoint не містить явного healthy/status.',
    state: 'unknown',
  }
}

function normalizeOperation(payload: unknown): AiFleetOperationState | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined
  }

  const record = payload as Record<string, unknown>
  const state = normalizeState(readString(record.OperationState ?? record.operationState))

  return {
    generatedAtUtc: readDateString(record.GeneratedAtUtc ?? record.generatedAtUtc),
    lastFinishedAtUtc: readDateString(record.LastFinishedAtUtc ?? record.lastFinishedAtUtc),
    lastStartedAtUtc: readDateString(record.LastStartedAtUtc ?? record.lastStartedAtUtc),
    logFilePath: readString(record.LogFilePath ?? record.logFilePath) || undefined,
    state,
  }
}

function normalizeState(value: string): AiFleetWarmupState['state'] {
  const normalized = value.toLowerCase()

  if (normalized === 'healthy' || normalized === 'ok' || normalized === 'success') {
    return 'healthy'
  }

  if (normalized === 'down' || normalized === 'failed' || normalized === 'unhealthy') {
    return 'down'
  }

  return 'unknown'
}

function readMessage(record: Record<string, unknown>): string | undefined {
  const message = record.message ?? record.Message ?? record.error ?? record.Error

  return typeof message === 'string' && message.trim() ? message : undefined
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function readProperty(payload: unknown, key: string): unknown {
  if (!payload || typeof payload !== 'object') {
    return undefined
  }

  return (payload as Record<string, unknown>)[key]
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readDateString(value: unknown): string | undefined {
  const date = readString(value)
  return date ? date : undefined
}
