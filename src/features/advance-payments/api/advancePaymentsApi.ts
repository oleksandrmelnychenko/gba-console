import { apiRequest } from '../../../shared/api/apiClient'
import { toDateTimeQuery } from '../../../shared/date/dateTime'
import type { AdvancePayment, AdvancePaymentsSearchParams } from '../types'

export async function getAdvancePayments(params: AdvancePaymentsSearchParams): Promise<AdvancePayment[]> {
  const result = await apiRequest<unknown>('/payments/advance/all', {
    query: {
      from: toDateTimeQuery(params.from, 'start'),
      to: toDateTimeQuery(params.to, 'end'),
    },
  })

  return readArrayPayload(result, ['Items', 'AdvancePayments', 'Collection', 'Data'])
    .filter((item): item is AdvancePayment => Boolean(item && typeof item === 'object'))
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
