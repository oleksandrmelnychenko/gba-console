import { apiRequest } from '../../../shared/api/apiClient'
import { toDateTimeQuery } from '../../../shared/date/dateTime'
import type {
  AdvancePayment,
  AdvancePaymentMutationPayload,
  AdvancePaymentsSearchParams,
  AdvancePaymentSource,
} from '../types'

export async function getAdvancePayments(params: AdvancePaymentsSearchParams): Promise<AdvancePayment[]> {
  const result = await apiRequest<unknown>('/payments/advance/all', {
    query: {
      from: toDateTimeQuery(params.from, 'start'),
      limit: params.limit,
      offset: params.offset,
      to: toDateTimeQuery(params.to, 'end'),
    },
  })

  return readArrayPayload(result, ['Items', 'AdvancePayments', 'Collection', 'Data'])
    .filter((item): item is AdvancePayment => Boolean(item && typeof item === 'object'))
}

export async function getAdvancePayment(netId: string): Promise<AdvancePayment | null> {
  const result = await apiRequest<unknown>('/payments/advance/get', {
    query: {
      netId,
    },
  })

  return normalizeAdvancePayment(result)
}

export async function createAdvancePayment(
  source: AdvancePaymentSource,
  advancePayment: AdvancePaymentMutationPayload,
): Promise<AdvancePayment | null> {
  const result = await apiRequest<unknown>('/payments/advance/new', {
    method: 'POST',
    query: 'taxFreeNetId' in source
      ? { taxFreeNetId: source.taxFreeNetId }
      : { sadNetId: source.sadNetId },
    body: advancePayment,
  })

  return normalizeAdvancePayment(result)
}

export async function updateAdvancePayment(
  advancePayment: AdvancePaymentMutationPayload & Pick<AdvancePayment, 'Id' | 'NetUid'>,
): Promise<AdvancePayment | null> {
  const result = await apiRequest<unknown>('/payments/advance/update', {
    method: 'POST',
    body: advancePayment,
  })

  return normalizeAdvancePayment(result)
}

function normalizeAdvancePayment(result: unknown): AdvancePayment | null {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return null
  }

  return result as AdvancePayment
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
