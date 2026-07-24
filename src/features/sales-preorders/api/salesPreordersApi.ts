import { apiRequest } from '../../../shared/api/apiClient'
import {
  getSalesMutationOperationHeaders,
  SalesMutationPreflightValidationError,
  type SalesMutationOperationOptions,
} from '../../sales-ukraine/salesMutationOperation'
import {
  requirePersistedGuid,
  requirePositiveFiniteQuantity,
} from '../../sales-ukraine/salesPayloadGuards'
import type { CreatePreorderRequest, PreOrder, PreOrdersFilters } from '../types'

const MAX_PREORDER_COMMENT_LENGTH = 250
const MAX_PREORDER_QUANTITY = 1_000_000_000

export async function getPreorders(filters: PreOrdersFilters): Promise<PreOrder[]> {
  const result = await apiRequest<unknown>('/preorders/all/filtered', {
    query: {
      limit: filters.limit,
      offset: filters.offset,
    },
  })

  return normalizeArray(result) as PreOrder[]
}

export async function createPreorder(
  request: CreatePreorderRequest,
  operation: SalesMutationOperationOptions,
): Promise<string> {
  const productNetId = requirePersistedGuid(
    request.productNetId,
    'Оберіть коректний товар',
  )
  const clientAgreementNetId = requirePersistedGuid(
    request.clientAgreementNetId,
    'Оберіть коректний договір клієнта',
  )
  const qty = requirePositiveFiniteQuantity(
    request.qty,
    'Кількість має бути більшою за нуль',
  )
  const comment = request.comment.trim()

  if (qty > MAX_PREORDER_QUANTITY) {
    throw new SalesMutationPreflightValidationError(
      `Кількість не може перевищувати ${MAX_PREORDER_QUANTITY}`,
    )
  }

  if (comment.length > MAX_PREORDER_COMMENT_LENGTH) {
    throw new SalesMutationPreflightValidationError(
      `Коментар не може перевищувати ${MAX_PREORDER_COMMENT_LENGTH} символів`,
    )
  }

  const result = await apiRequest<unknown>('/preorders/new', {
    body: {
      ClientAgreementNetId: clientAgreementNetId,
      Comment: comment || null,
      ProductNetId: productNetId,
      Qty: qty,
    },
    headers: getSalesMutationOperationHeaders(operation.operationId),
    method: 'POST',
    ...(operation.signal ? { signal: operation.signal } : {}),
  })

  if (typeof result === 'string') {
    return result
  }

  if (result && typeof result === 'object') {
    const message = (result as Record<string, unknown>).Message

    return typeof message === 'string' ? message : ''
  }

  return ''
}

function normalizeArray(result: unknown): unknown[] {
  const parsed = typeof result === 'string' ? safeParse(result) : result

  if (Array.isArray(parsed)) {
    return parsed
  }

  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>

    for (const key of ['PreOrders', 'Items', 'Data', 'Collection']) {
      if (Array.isArray(record[key])) {
        return record[key] as unknown[]
      }
    }
  }

  return []
}

function safeParse(value: string): unknown {
  const normalized = value.trim()

  if (!normalized) {
    return null
  }

  try {
    return JSON.parse(normalized) as unknown
  } catch {
    return null
  }
}
