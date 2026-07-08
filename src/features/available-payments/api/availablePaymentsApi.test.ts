import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getGroupedPaymentTasks } from './availablePaymentsApi'
import { AccountingTypeValue } from '../types'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('availablePaymentsApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('loads all grouped payment tasks for the accounting available-payments screen', async () => {
    apiRequestMock.mockResolvedValueOnce({
      GroupedPaymentTasks: [],
      PriceTotals: [],
      TotalGrossPrice: 0,
    })

    await getGroupedPaymentTasks({
      from: '2026-07-01',
      limit: 10,
      offset: 0,
      onlyAvailableForPayment: false,
      to: '2026-07-08',
      typePaymentTask: AccountingTypeValue.All,
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/payments/tasks/grouped/all/filtered', {
      query: {
        from: '2026-07-01',
        limit: 10,
        offset: 0,
        organizationNetId: undefined,
        to: '2026-07-08',
        typePaymentTask: AccountingTypeValue.All,
      },
    })
  })

  it('loads only available grouped payment tasks for outcome-payment mode', async () => {
    apiRequestMock.mockResolvedValueOnce({
      GroupedPaymentTasks: [],
      PriceTotals: [],
      TotalGrossPrice: 0,
    })

    await getGroupedPaymentTasks({
      from: '2026-07-01',
      limit: 20,
      offset: 20,
      onlyAvailableForPayment: true,
      organizationNetId: 'organization-1',
      to: '2026-07-08',
      typePaymentTask: AccountingTypeValue.Accounting,
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/payments/tasks/grouped/all/available/filtered', {
      query: {
        from: '2026-07-01',
        limit: 20,
        offset: 20,
        organizationNetId: 'organization-1',
        to: '2026-07-08',
        typePaymentTask: AccountingTypeValue.Accounting,
      },
    })
  })
})
