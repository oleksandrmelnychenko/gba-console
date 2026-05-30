import { apiRequest } from '../../../shared/api/apiClient'
import type { VatReport, VatReportsSearchParams } from '../types'

export async function getVatReports(params: VatReportsSearchParams): Promise<VatReport[]> {
  const result = await apiRequest<unknown>('/vats/info/get/filtered', {
    query: {
      from: params.from,
      limit: params.limit,
      offset: params.offset,
      to: params.to,
    },
  })

  return readArrayPayload(result, ['Items', 'VatInfos', 'Collection', 'Data'])
    .filter((item): item is VatReport => Boolean(item && typeof item === 'object'))
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
