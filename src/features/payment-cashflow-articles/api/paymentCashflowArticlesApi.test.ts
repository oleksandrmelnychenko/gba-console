import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  createPaymentCashflowArticle,
  deletePaymentCashflowArticle,
  getPaymentCashflowArticle,
  getPaymentCashflowArticles,
  searchPaymentCashflowArticles,
  updatePaymentCashflowArticle,
} from './paymentCashflowArticlesApi'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))

const apiRequestMock = vi.mocked(apiRequest)

describe('cashflow articles permission-scoped API', () => {
  beforeEach(() => apiRequestMock.mockReset())

  it('uses scoped page read boundaries', async () => {
    apiRequestMock.mockResolvedValue([])
    await getPaymentCashflowArticles()
    await searchPaymentCashflowArticles('fuel')
    await getPaymentCashflowArticle('article-1')
    expect(apiRequestMock.mock.calls.map(([route]) => route)).toEqual([
      '/payments/movements/accounting/all',
      '/payments/movements/accounting/all/search',
      '/payments/movements/accounting/get',
    ])
  })

  it('uses separate create, save and delete boundaries', async () => {
    apiRequestMock.mockResolvedValue({})
    await createPaymentCashflowArticle({} as never)
    await updatePaymentCashflowArticle({} as never)
    await deletePaymentCashflowArticle('article-1')
    expect(apiRequestMock.mock.calls.map(([route]) => route)).toEqual([
      '/payments/movements/accounting/new',
      '/payments/movements/accounting/update',
      '/payments/movements/accounting/delete',
    ])
  })
})
