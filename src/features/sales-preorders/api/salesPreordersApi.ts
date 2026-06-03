import { apiRequest } from '../../../shared/api/apiClient'
import type { CreatePreorderRequest, PreOrder, PreOrdersFilters } from '../types'

export async function getPreorders(filters: PreOrdersFilters): Promise<PreOrder[]> {
  const result = await apiRequest<unknown>('/preorders/all/filtered', {
    query: {
      limit: filters.limit,
      offset: filters.offset,
    },
  })

  return normalizeArray(result) as PreOrder[]
}

export async function createPreorder(request: CreatePreorderRequest): Promise<string> {
  const result = await apiRequest<unknown>('/preorders/new', {
    query: {
      productNetId: request.productNetId,
      clientAgreementNetId: request.clientAgreementNetId,
      qty: request.qty,
      comment: request.comment,
    },
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
