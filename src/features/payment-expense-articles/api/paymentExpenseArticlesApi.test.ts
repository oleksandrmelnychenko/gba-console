import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  createPaymentExpenseArticle,
  deletePaymentExpenseArticle,
  getPaymentExpenseArticle,
  getPaymentExpenseArticles,
  searchPaymentExpenseArticles,
  updatePaymentExpenseArticle,
} from './paymentExpenseArticlesApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('payment expense article API contract', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('loads and searches the expense-article directory used by article autocomplete', async () => {
    apiRequestMock
      .mockResolvedValueOnce({
        PaymentCostMovements: [
          {
            NetUid: 'article-1',
            OperationName: 'Оренда',
            PaymentCostMovementOperations: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        Items: [
          {
            NetUid: 'article-2',
            OperationName: 'Пальне',
            PaymentCostMovementOperations: [],
          },
        ],
      })

    await expect(getPaymentExpenseArticles()).resolves.toEqual([
      {
        NetUid: 'article-1',
        OperationName: 'Оренда',
        PaymentCostMovementOperations: [],
      },
    ])
    await expect(searchPaymentExpenseArticles('пальне')).resolves.toEqual([
      {
        NetUid: 'article-2',
        OperationName: 'Пальне',
        PaymentCostMovementOperations: [],
      },
    ])

    expect(apiRequestMock).toHaveBeenNthCalledWith(
      1,
      '/payments/costs/movements/accounting/all',
    )
    expect(apiRequestMock).toHaveBeenNthCalledWith(
      2,
      '/payments/costs/movements/accounting/all/search',
      {
        query: {
          value: 'пальне',
        },
      },
    )
  })

  it('loads, creates, and updates only the article payload without posting money', async () => {
    apiRequestMock
      .mockResolvedValueOnce({
        NetUid: 'article-1',
        OperationName: 'Оренда',
      })
      .mockResolvedValueOnce({
        NetUid: 'article-2',
        OperationName: 'Пальне',
      })
      .mockResolvedValueOnce({
        NetUid: 'article-2',
        OperationName: 'Пальне та мастила',
      })

    await expect(
      getPaymentExpenseArticle('article-1'),
    ).resolves.toMatchObject({
      NetUid: 'article-1',
      OperationName: 'Оренда',
      PaymentCostMovementOperations: [],
    })
    await expect(
      createPaymentExpenseArticle({
        OperationName: 'Пальне',
      }),
    ).resolves.toMatchObject({
      NetUid: 'article-2',
      OperationName: 'Пальне',
      PaymentCostMovementOperations: [],
    })
    await expect(
      updatePaymentExpenseArticle({
        NetUid: 'article-2',
        OperationName: 'Пальне та мастила',
      }),
    ).resolves.toMatchObject({
      NetUid: 'article-2',
      OperationName: 'Пальне та мастила',
      PaymentCostMovementOperations: [],
    })

    expect(apiRequestMock).toHaveBeenNthCalledWith(
      1,
      '/payments/costs/movements/accounting/get',
      {
        query: {
          netId: 'article-1',
        },
      },
    )
    expect(apiRequestMock).toHaveBeenNthCalledWith(
      2,
      '/payments/costs/movements/accounting/new',
      {
        body: {
          OperationName: 'Пальне',
        },
        method: 'POST',
      },
    )
    expect(apiRequestMock).toHaveBeenNthCalledWith(
      3,
      '/payments/costs/movements/accounting/update',
      {
        body: {
          NetUid: 'article-2',
          OperationName: 'Пальне та мастила',
        },
        method: 'POST',
      },
    )
  })

  it('deletes the article directory row by its immutable NetUid', async () => {
    apiRequestMock.mockResolvedValueOnce(undefined)

    await deletePaymentExpenseArticle('article-1')

    expect(apiRequestMock).toHaveBeenCalledWith(
      '/payments/costs/movements/accounting/delete',
      {
        method: 'DELETE',
        query: {
          netId: 'article-1',
        },
      },
    )
  })
})
