import { apiRequest } from '../../../shared/api/apiClient'
import type { PaymentCashflowArticle, PaymentCashflowArticlePayload } from '../types'

export async function getPaymentCashflowArticles(): Promise<PaymentCashflowArticle[]> {
  const result = await apiRequest<unknown>('/payments/movements/accounting/all')

  return normalizeArticles(result)
}

export async function searchPaymentCashflowArticles(value: string): Promise<PaymentCashflowArticle[]> {
  const result = await apiRequest<unknown>('/payments/movements/accounting/all/search', {
    query: {
      value,
    },
  })

  return normalizeArticles(result)
}

export async function getPaymentCashflowArticle(netId: string): Promise<PaymentCashflowArticle | null> {
  const result = await apiRequest<unknown>('/payments/movements/accounting/get', {
    query: {
      netId,
    },
  })

  return normalizeArticle(result)
}

export async function createPaymentCashflowArticle(
  article: PaymentCashflowArticlePayload,
): Promise<PaymentCashflowArticle | null> {
  const result = await apiRequest<unknown>('/payments/movements/accounting/new', {
    method: 'POST',
    body: article,
  })

  return normalizeArticle(result)
}

export async function updatePaymentCashflowArticle(
  article: PaymentCashflowArticlePayload,
): Promise<PaymentCashflowArticle | null> {
  const result = await apiRequest<unknown>('/payments/movements/accounting/update', {
    method: 'POST',
    body: article,
  })

  return normalizeArticle(result)
}

export async function deletePaymentCashflowArticle(netId: string): Promise<void> {
  await apiRequest<unknown>('/payments/movements/accounting/delete', {
    method: 'DELETE',
    query: {
      netId,
    },
  })
}

function normalizeArticles(result: unknown): PaymentCashflowArticle[] {
  return readArrayPayload(result, ['Items', 'PaymentMovements', 'Data', 'Collection']).reduce<
    PaymentCashflowArticle[]
  >((acc, item) => {
    const article = normalizeArticle(item)
    if (isArticle(article)) {
      acc.push(article)
    }
    return acc
  }, [])
}

function normalizeArticle(result: unknown): PaymentCashflowArticle | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const article = result as PaymentCashflowArticle

  return {
    ...article,
    PaymentMovementOperations: Array.isArray(article.PaymentMovementOperations) ? article.PaymentMovementOperations : [],
  }
}

function isArticle(article: PaymentCashflowArticle | null): article is PaymentCashflowArticle {
  return Boolean(article)
}

function readArrayPayload(result: unknown, keys: string[]): unknown[] {
  if (Array.isArray(result)) {
    return result
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>
  const wrappedItems = keys.map((key) => payload[key]).find(Array.isArray)

  return wrappedItems || []
}
