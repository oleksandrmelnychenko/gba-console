import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../shared/api/apiClient'
import { searchAdvancedReportPaymentRegisters } from './advanced-reports/api/advancedReportsApi'
import { searchCompanyCarsForAdvanceReportEdit, searchCompanyCarUsers } from './company-cars/api/companyCarsApi'
import { searchConsumableStorageUsers } from './consumable-storages/api/consumableStoragesApi'
import {
  getIncomeCashflowPaymentMovements,
  searchIncomeCashflowPaymentMovements,
  searchIncomeCashflowPaymentRegisters,
  searchIncomeCashflowUsers,
  type CashflowLookupScope,
} from './income-cashflows/api/incomeCashflowsApi'
import { getOutgoingCashflowPaymentMovements } from './outgoing-cashflows/api/outgoingCashflowsApi'
import { getPaymentAccountBanks } from './payment-accounts/api/paymentAccountsApi'
import { getSupplyServiceConsumableProducts } from './product-delivery-protocols/api/protocolDetailApi'
import { getReportProductGroups, searchReportProducts } from './reports/api/reportsApi'
import { getAllUkraineCartItemsForSad, searchOrganizationClients } from './sad/api/sadApi'
import { getOfferSubClients } from './sales-offers/api/salesOffersApi'
import { getSupplyServiceConsumableProducts as getPaymentProtocolSupplyServices } from './supply-ukraine-payment-protocols/api/paymentProtocolsApi'
import { getNonDefectiveStorages } from './warehouse-ukraine/api/orderPlacementsApi'

vi.mock('../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))

const apiRequestMock = vi.mocked(apiRequest)
const routes = () => apiRequestMock.mock.calls.map(([route]) => route)

/**
 * Form helper lookups must go through the facade gated by the key that admits the user into the form. The legacy
 * routes are gated by other pages' keys (users page, available payments, cash-flow articles, premises, ...), so a
 * role that legitimately holds the form key got 403 on them.
 */
describe('form-scoped lookup facades', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    apiRequestMock.mockResolvedValue([])
  })

  it('searches users through the facade of the form that asks for them', async () => {
    await searchCompanyCarUsers('ів', 'create')
    await searchCompanyCarUsers('ів', 'edit')
    await searchConsumableStorageUsers('ів', 'create')
    await searchConsumableStorageUsers('ів', 'edit')
    await searchConsumableStorageUsers('ів', 'write-off/create')
    await searchConsumableStorageUsers('ів', 'write-off/edit')
    await searchIncomeCashflowUsers('ів')

    expect(routes()).toEqual([
      '/usermanagement/profiles/company-cars/road-list/create/search',
      '/usermanagement/profiles/company-cars/road-list/edit/search',
      '/usermanagement/profiles/premises/create/search',
      '/usermanagement/profiles/premises/edit/search',
      '/usermanagement/profiles/premises/write-off/create/search',
      '/usermanagement/profiles/premises/write-off/edit/search',
      '/usermanagement/profiles/income-cashflows/colleague-return/search',
    ])
    expect(routes()).not.toContain('/usermanagement/profiles/search')
  })

  it.each<[CashflowLookupScope, string, string]>([
    ['income-form', '/payments/registers/income-cashflows/registry/search', '/payments/movements/income-cashflows/form/all'],
    ['income-client-payment', '/payments/registers/income-cashflows/client-payment/search', '/payments/movements/income-cashflows/client-payment/all'],
    ['outgoing-create', '/payments/registers/outgoing-cashflows/create/search', '/payments/movements/outgoing-cashflows/create/all'],
    ['sad-income', '/payments/registers/sad/accounting/income/search', '/payments/movements/sad/accounting/income/all'],
    ['sad-outcome', '/payments/registers/sad/accounting/outcome/search', '/payments/movements/sad/accounting/outcome/all'],
    ['tax-free-income', '/payments/registers/tax-free-documents/accounting/income/search', '/payments/movements/tax-free-documents/accounting/income/all'],
    ['tax-free-outcome', '/payments/registers/tax-free-documents/accounting/outcome/search', '/payments/movements/tax-free-documents/accounting/outcome/all'],
  ])('reads registers and cash-flow articles for %s through its own facades', async (scope, registers, movements) => {
    await searchIncomeCashflowPaymentRegisters('', scope)
    await getIncomeCashflowPaymentMovements(scope)
    await searchIncomeCashflowPaymentMovements('витрати', scope)

    expect(routes()).toEqual([registers, movements, `${movements}/search`])
  })

  it('routes the remaining page and form lookups to their own facades', async () => {
    await searchAdvancedReportPaymentRegisters('каса')
    await getOutgoingCashflowPaymentMovements()
    await searchCompanyCarsForAdvanceReportEdit('AA')
    await getPaymentAccountBanks()
    await getSupplyServiceConsumableProducts('', 'create')
    await getSupplyServiceConsumableProducts('', 'edit')
    await getPaymentProtocolSupplyServices('')
    await getReportProductGroups('гр')
    await searchReportProducts({ limit: 30, offset: 0, value: 'SEM' })
    await searchOrganizationClients('тов')
    await getAllUkraineCartItemsForSad()
    await getOfferSubClients('client-1')
    await getNonDefectiveStorages()

    expect(routes()).toEqual([
      '/payments/registers/advanced-reports/page/search',
      '/payments/movements/outgoing-cashflows/registry/all',
      '/consumables/company/cars/advanced-reports/report/edit/search',
      '/bank/payment-accounts/page/all',
      '/consumables/categories/product-delivery-protocols/unified-service/create/supply-services',
      '/consumables/categories/product-delivery-protocols/unified-service/edit/supply-services',
      '/consumables/categories/product-delivery-protocols/unified-service/create/supply-services',
      '/products/groups/reports/stocks/filtered',
      '/products/reports/stocks/search/advanced',
      '/clients/organizations/sad/edit/search',
      '/supplies/ukraine/order/cart/items/sad/edit/all',
      '/clients/sales-offers/create/subclients',
      '/storages/orders-ukraine/placement/nondefective',
    ])
  })
})
