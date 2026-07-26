import { apiRequest } from '../../../shared/api/apiClient'
import {
  executeAccountingMutation,
  type AccountingMutationOperationOptions,
} from '../../../shared/api/accountingMutationOperation'
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
  operation?: AccountingMutationOperationOptions,
): Promise<AdvancePayment | null> {
  const result = await executeAccountingMutation({
    identity: advancePayment,
    kind: 'advance-payment:add',
    operation,
    payload: {
      advancePayment,
      source,
    },
    request: (payload, context) => apiRequest<unknown>('/payments/advance/new', {
      body: payload.advancePayment,
      dedupe: false,
      headers: context.headers,
      method: 'POST',
      query: {
        ...('taxFreeNetId' in payload.source
          ? { taxFreeNetId: payload.source.taxFreeNetId }
          : { sadNetId: payload.source.sadNetId }),
        operationNetUid: context.operationId,
      },
      ...(context.signal ? { signal: context.signal } : {}),
    }),
  })

  return normalizeAdvancePayment(result)
}

export async function updateAdvancePayment(
  advancePayment: AdvancePaymentMutationPayload & Pick<AdvancePayment, 'Id' | 'NetUid'>,
  operation?: AccountingMutationOperationOptions,
): Promise<AdvancePayment | null> {
  const result = await executeAccountingMutation({
    identity: advancePayment,
    kind: 'advance-payment:update',
    operation,
    payload: advancePayment,
    request: (payload, context) => apiRequest<unknown>('/payments/advance/update', {
      body: payload,
      dedupe: false,
      headers: context.headers,
      method: 'POST',
      query: {
        operationNetUid: context.operationId,
      },
      ...(context.signal ? { signal: context.signal } : {}),
    }),
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
