import { apiRequest } from '../../../shared/api/apiClient'
import type { PaymentExpenseArticle, PaymentExpenseArticlePayload } from '../types'

export async function getPaymentExpenseArticles(): Promise<PaymentExpenseArticle[]> {
  const result = await apiRequest<unknown>('/payments/costs/movements/all')

  return normalizeArticles(result)
}

export async function searchPaymentExpenseArticles(value: string): Promise<PaymentExpenseArticle[]> {
  const result = await apiRequest<unknown>('/payments/costs/movements/all/search', {
    query: {
      value,
    },
  })

  return normalizeArticles(result)
}

export async function getPaymentExpenseArticle(netId: string): Promise<PaymentExpenseArticle | null> {
  const result = await apiRequest<unknown>('/payments/costs/movements/get', {
    query: {
      netId,
    },
  })

  return normalizeArticle(result)
}

export async function createPaymentExpenseArticle(
  article: PaymentExpenseArticlePayload,
): Promise<PaymentExpenseArticle | null> {
  const result = await apiRequest<unknown>('/payments/costs/movements/new', {
    method: 'POST',
    body: article,
  })

  return normalizeArticle(result)
}

export async function updatePaymentExpenseArticle(
  article: PaymentExpenseArticlePayload,
): Promise<PaymentExpenseArticle | null> {
  const result = await apiRequest<unknown>('/payments/costs/movements/update', {
    method: 'POST',
    body: article,
  })

  return normalizeArticle(result)
}

export async function deletePaymentExpenseArticle(netId: string): Promise<void> {
  await apiRequest<unknown>('/payments/costs/movements/delete', {
    method: 'DELETE',
    query: {
      netId,
    },
  })
}

function normalizeArticles(result: unknown): PaymentExpenseArticle[] {
  return readArrayPayload(result, ['Items', 'PaymentCostMovements', 'PaymentExpenseArticles', 'Data'])
    .map(normalizeArticle)
    .filter((article): article is PaymentExpenseArticle => Boolean(article))
}

function normalizeArticle(result: unknown): PaymentExpenseArticle | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const article = result as PaymentExpenseArticle

  return {
    ...article,
    PaymentCostMovementOperations: Array.isArray(article.PaymentCostMovementOperations)
      ? article.PaymentCostMovementOperations
      : [],
  }
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
