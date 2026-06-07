import { apiRequest } from '../../../shared/api/apiClient'
import type {
  ActProvidingService,
  ActProvidingServicesResponse,
  ActProvidingServicesSearchParams,
} from '../types'

export async function getActProvidingServices(
  params: ActProvidingServicesSearchParams,
): Promise<ActProvidingServicesResponse> {
  const responseLimit = params.limit
  const requestLimit = responseLimit + 1

  const result = await apiRequest<unknown>('/act/providing/services/all', {
    query: {
      from: params.from,
      isFiltered: params.isFiltered,
      limit: requestLimit,
      offset: params.offset,
      to: params.to,
    },
  })

  return normalizeActProvidingServicesResponse(result, responseLimit)
}

export async function getActProvidingService(netId: string): Promise<ActProvidingService | null> {
  const result = await apiRequest<unknown>('/act/providing/services/get/', {
    query: {
      netId,
    },
  })

  return normalizeActProvidingService(result)
}

export async function updateActProvidingService(act: ActProvidingService): Promise<ActProvidingService | null> {
  const result = await apiRequest<unknown>('/act/providing/services/update', {
    method: 'POST',
    body: act,
  })

  return normalizeActProvidingService(result)
}

function normalizeActProvidingServicesResponse(result: unknown, limit: number): ActProvidingServicesResponse {
  const receivedItems = readArrayPayload(result, ['Items', 'ActProvidingServices', 'Collection', 'Data']).map((item) =>
    normalizeActProvidingService(item),
  ).filter((item): item is ActProvidingService => Boolean(item))
  const payload = result && typeof result === 'object' ? (result as Record<string, unknown>) : {}
  const total = readNumber(payload.Total, readNumber(payload.TotalRowQty, readNumber(payload.TotalRowsQty)))

  return {
    HasMore: typeof total === 'number' ? undefined : receivedItems.length > limit,
    Items: receivedItems.slice(0, limit),
    Total: total,
  }
}

function normalizeActProvidingService(result: unknown): ActProvidingService | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  return result as ActProvidingService
}

function readArrayPayload(result: unknown, keys: string[]): unknown[] {
  if (Array.isArray(result)) {
    return result
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>

  for (const key of keys) {
    if (Array.isArray(payload[key])) {
      return payload[key] as unknown[]
    }
  }

  return []
}

function readNumber(value: unknown, fallback?: number): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsedValue = Number(value)

    if (Number.isFinite(parsedValue)) {
      return parsedValue
    }
  }

  return fallback
}
