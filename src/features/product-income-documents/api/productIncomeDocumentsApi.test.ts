import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  exportProductIncomeDocument,
  getProductIncomeDocuments,
  getProductIncomeInfo,
  getProductIncomeInfoForRemainings,
  getProductIncomeRemainings,
  getSupplyOrderProductIncomeByNetId,
  getSupplyOrderUkraineProductIncomeByNetId,
} from './productIncomeDocumentsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('product income documents permission-scoped API', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    apiRequestMock.mockResolvedValue({})
  })

  it('loads the registry only through the page-scoped route', async () => {
    await getProductIncomeDocuments({
      from: '2026-08-01T00:00:00',
      limit: 20,
      offset: 0,
      to: '2026-08-19T23:59:59',
      value: ' PI-1 ',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/products/incomes/income-documents/page/registry', {
      query: {
        from: '2026-08-01T00:00:00',
        limit: 20,
        offset: 0,
        to: '2026-08-19T23:59:59',
        value: 'PI-1',
      },
    })
  })

  it('keeps details, remainings details, balances and export on independent routes', async () => {
    await getProductIncomeInfo('income-1')
    await getProductIncomeInfoForRemainings('income-1')
    await getProductIncomeRemainings('income-1')
    await exportProductIncomeDocument('income-1')

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/products/incomes/income-documents/page/details', {
      query: { netId: 'income-1' },
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/products/incomes/income-documents/page/remainings/details', {
      query: { netId: 'income-1' },
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(3, '/consignments/remaining/income-documents/page/remainings', {
      query: { netId: 'income-1' },
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(4, '/products/incomes/income-documents/page/document/export', {
      query: { netId: 'income-1' },
    })
  })

  it('loads source placement drawers only through their permission-scoped routes', async () => {
    await getSupplyOrderProductIncomeByNetId('income-1')
    await getSupplyOrderUkraineProductIncomeByNetId('income-2')

    expect(apiRequestMock).toHaveBeenNthCalledWith(
      1,
      '/products/incomes/income-documents/page/supply-order/details',
      { query: { netId: 'income-1' } },
    )
    expect(apiRequestMock).toHaveBeenNthCalledWith(
      2,
      '/products/incomes/orders/ukraine/product-income/details',
      { query: { netId: 'income-2' } },
    )
  })
})
