import { ApiError, apiRequest } from '../../../shared/api/apiClient'
import type {
  AiFleetHealthState,
  AiFleetServiceDefinition,
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
    location: '/basket-supply-ukraine-order/dashboard, /basket-supply-ukraine-order/cockpit',
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
  const [statuses, warmupStatuses] = await Promise.all([
    Promise.all(AI_FLEET_SERVICES.map((service) => getAiServiceStatus(service, signal))),
    getAiFleetWarmupStatuses(signal),
  ])

  if (warmupStatuses.size === 0) {
    return statuses
  }

  return statuses.map((status) => ({
    ...status,
    warmup: warmupStatuses.get(status.serviceId) ?? status.warmup,
  }))
}

export async function getAiFleetServiceStatus(
  serviceId: string,
  signal?: AbortSignal,
): Promise<AiFleetServiceStatus | null> {
  const service = AI_FLEET_SERVICES.find((item) => item.id === serviceId)

  if (!service) {
    return null
  }

  const [status, warmupStatuses] = await Promise.all([
    getAiServiceStatus(service, signal),
    getAiFleetWarmupStatuses(signal),
  ])

  return {
    ...status,
    warmup: warmupStatuses.get(status.serviceId) ?? status.warmup,
  }
}

async function getAiFleetWarmupStatuses(signal?: AbortSignal): Promise<Map<string, AiFleetWarmupState>> {
  try {
    const payload = await apiRequest<unknown>('/ai/fleet/status', { signal })
    const services = readArray(readProperty(payload, 'Services') ?? readProperty(payload, 'services'))
    const statuses = new Map<string, AiFleetWarmupState>()

    for (const service of services) {
      if (!service || typeof service !== 'object') {
        continue
      }

      const record = service as Record<string, unknown>
      const serviceId = readString(record.ServiceId ?? record.serviceId)

      if (!serviceId) {
        continue
      }

      statuses.set(serviceId, {
        message: readString(record.Message ?? record.message) || undefined,
        state: normalizeState(readString(record.State ?? record.state)),
      })
    }

    return statuses
  } catch {
    return new Map()
  }
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
