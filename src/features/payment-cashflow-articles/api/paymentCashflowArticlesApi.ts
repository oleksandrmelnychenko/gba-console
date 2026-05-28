import { apiRequest } from '../../../shared/api/apiClient'
import type { PaymentCashflowArticle, PaymentCashflowArticlePayload } from '../types'

export async function getPaymentCashflowArticles(): Promise<PaymentCashflowArticle[]> {
  const result = await apiRequest<unknown>('/payments/movements/all')

  return normalizeArticles(result)
}

export async function searchPaymentCashflowArticles(value: string): Promise<PaymentCashflowArticle[]> {
  const result = await apiRequest<unknown>('/payments/movements/all/search', {
    query: {
      value,
    },
  })

  return normalizeArticles(result)
}

export async function getPaymentCashflowArticle(netId: string): Promise<PaymentCashflowArticle | null> {
  const result = await apiRequest<unknown>('/payments/movements/get', {
    query: {
      netId,
    },
  })

  return normalizeArticle(result)
}

export async function createPaymentCashflowArticle(
  article: PaymentCashflowArticlePayload,
): Promise<PaymentCashflowArticle | null> {
  const result = await apiRequest<unknown>('/payments/movements/new', {
    method: 'POST',
    body: article,
  })

  return normalizeArticle(result)
}

export async function updatePaymentCashflowArticle(
  article: PaymentCashflowArticlePayload,
): Promise<PaymentCashflowArticle | null> {
  const result = await apiRequest<unknown>('/payments/movements/update', {
    method: 'POST',
    body: article,
  })

  return normalizeArticle(result)
}

export async function deletePaymentCashflowArticle(netId: string): Promise<void> {
  await apiRequest<unknown>('/payments/movements/delete', {
    method: 'DELETE',
    query: {
      netId,
    },
  })
}

function normalizeArticles(result: unknown): PaymentCashflowArticle[] {
  return Array.isArray(result) ? result.map(normalizeArticle).filter(isArticle) : []
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
