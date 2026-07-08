import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { IncomeCounterpartySearchType } from '../types'
import { getIncomeCashflowByNetId, searchIncomeCashflowCounterparties } from './incomeCashflowsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('income cashflow API lookup contracts', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('searches client counterparties through the targeted clients endpoint', async () => {
    apiRequestMock.mockResolvedValueOnce([{ NetUid: 'client-1' }])

    await expect(searchIncomeCashflowCounterparties(' конкорд ', IncomeCounterpartySearchType.Client)).resolves.toEqual([{ NetUid: 'client-1' }])

    expect(apiRequestMock).toHaveBeenCalledWith('/clients/all/filtered', {
      query: {
        filterSql: 'RegionCode.Value/Client.FullName',
        limit: 20,
        offset: 0,
        typeRoleFilter: '',
        value: 'конкорд',
      },
    })
  })

  it('searches manufacturer counterparties through the targeted suppliers endpoint', async () => {
    apiRequestMock.mockResolvedValueOnce([{ NetUid: 'manufacturer-1' }])

    await expect(searchIncomeCashflowCounterparties(' sem ', IncomeCounterpartySearchType.Manufacturer)).resolves.toEqual([{ NetUid: 'manufacturer-1' }])

    expect(apiRequestMock).toHaveBeenCalledWith('/clients/suppliers/all/filtered', {
      query: {
        filterSql: 'RegionCode.Value/Client.FullName',
        limit: 20,
        offset: 0,
        typeRoleFilter: String(IncomeCounterpartySearchType.Manufacturer),
        value: 'sem',
      },
    })
  })

  it('searches supply organization counterparties through the supply organizations endpoint', async () => {
    apiRequestMock.mockResolvedValueOnce({ Items: [{ NetUid: 'supplier-1' }] })

    await expect(searchIncomeCashflowCounterparties(' dhl ', IncomeCounterpartySearchType.Supplier)).resolves.toEqual([{ NetUid: 'supplier-1' }])

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/organizations/all/search', {
      query: {
        limit: 20,
        offset: 0,
        value: 'dhl',
      },
    })
  })

  it('loads a focused income payment order by NetUid for cash-flow drilldown', async () => {
    apiRequestMock.mockResolvedValueOnce({
      AssignedPaymentOrders: null,
      NetUid: 'income-order-1',
      Number: 'ПКО-1',
    })

    await expect(getIncomeCashflowByNetId('income-order-1')).resolves.toEqual({
      AssignedPaymentOrders: [],
      NetUid: 'income-order-1',
      Number: 'ПКО-1',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/payments/orders/income/get', {
      query: {
        netId: 'income-order-1',
      },
    })
  })
})
