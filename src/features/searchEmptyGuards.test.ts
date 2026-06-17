import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../shared/api/apiClient'
import { searchClientProductMovementClients } from './client-product-movement/api/clientProductMovementApi'
import { searchSupplyOrganizations as searchConsumableOrderSupplyOrganizations } from './consumable-orders/api/consumableOrdersApi'
import {
  searchIncomeCashflowClientPayers,
  searchIncomeCashflowCounterparties,
} from './income-cashflows/api/incomeCashflowsApi'
import { IncomeCounterpartySearchType } from './income-cashflows/types'
import { getProductRemainSuppliers } from './product-remains/api/productRemainsApi'
import { searchReportClients, searchReportUsers } from './reports/api/reportsApi'
import { searchSalesReturnClients } from './sales-returns/api/salesReturnsApi'
import { searchSupplyOrganizations as searchPaymentProtocolSupplyOrganizations } from './supply-ukraine-payment-protocols/api/paymentProtocolsApi'

vi.mock('../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('lookup search empty value guards', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it.each([
    ['client product movement clients', () => searchClientProductMovementClients('  ')],
    [
      'income cashflow counterparties',
      () => searchIncomeCashflowCounterparties('  ', IncomeCounterpartySearchType.Client),
    ],
    ['income cashflow client payers', () => searchIncomeCashflowClientPayers('  ')],
    ['product remain suppliers', () => getProductRemainSuppliers({ limit: 20, offset: 0, value: '  ' })],
    ['report clients', () => searchReportClients({ limit: 20, offset: 0, value: '  ' })],
    ['report users', () => searchReportUsers({ limit: 20, offset: 0, value: '  ' })],
    ['sales return clients', () => searchSalesReturnClients('  ')],
    ['consumable order supply organizations', () => searchConsumableOrderSupplyOrganizations('  ')],
    ['payment protocol supply organizations', () => searchPaymentProtocolSupplyOrganizations('  ')],
  ])('does not call lookup endpoints for blank %s lookup values', async (_label, request) => {
    await expect(request()).resolves.toEqual([])

    expect(apiRequestMock).not.toHaveBeenCalled()
  })
})
