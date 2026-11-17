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
import { getPurchaseCockpitProductAnalytics } from './assortment/api/assortmentApi'
import { calculateAvailablePaymentConvertedAmount } from './available-payments/api/availablePaymentsApi'
import { getClientResourcePerfectClients } from './client-resources/api/clientResourcesApi'
import { getRootClientBySubClientNetId, getSalesWizardClientSubClients } from './clients/api/clientCabinetApi'
import { checkRegionCodeAvailability, getClientCardPerfectClients } from './clients/api/clientLookupsApi'
import { getClientSolvencyCharts, getClientSolvencyScore } from './clients/api/clientSolvencyApi'
import { searchMainClientCandidates } from './clients/api/clientsApi'
import { getClientCounterpartyGroup, getCounterpartyGroupTreeForClientCardEdit } from './clients/api/counterpartyGroupsApi'
import { getOutcomeOrdersByCompanyCar } from './company-cars/api/companyCarsApi'
import { getUnpaidConsumableOrdersByOrganization, searchConsumableProductsByVendorCode } from './consumable-orders/api/consumableOrdersApi'
import { getDashboardSyncStatus } from './header-actions/api/syncApi'
import { calculateIncomeCashflowExchange, getIncomeCashflowRetailClientAgreements } from './income-cashflows/api/incomeCashflowsApi'
import { getNonDefectiveStorages as getAssortmentUploadStorages } from './products/api/productsApi'
import { getClientDeliveryRecipients as getWizardDeliveryRecipients } from './sales-ukraine/components/new-sale-wizard/newSaleWizardApi'
import { getWizardClientStructure, getWizardClientStructureDebtTotal } from './sales-ukraine/components/new-sale-wizard/wizardSaleHeaderApi'
import { searchProductsByVendorCode as searchCapitalizationProducts } from './product-capitalizations/api/productCapitalizationsApi'
import { searchPlacementProducts } from './warehouse-ukraine/api/orderPlacementsApi'
import { getOffersClientAgreements, searchOffersProducts } from './sales-offers/api/salesOffersApi'
import { getOnlineShopReassignmentAgreements, getSaleClientAgreements, searchSaleProducts } from './sales-ukraine/api/salesUkraineApi'
import { getReportClientAgreements } from './reports/api/reportsApi'
import { getResaleClientAgreements } from './resales/api/resalesApi'
import { getClientAgreements as getSadClientAgreements, getSadPalletTypes, searchClients as searchSadClients } from './sad/api/sadApi'
import { getClientAgreements as getPackListClientAgreements, searchClients as searchPackListClients } from './tax-free-pack-lists/api/taxFreePackListsApi'
import { getIncomeCashflowClientAgreements } from './income-cashflows/api/incomeCashflowsApi'
import { getClientForAccountingCashFlow } from './clients/api/clientFormApi'

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

  it('splits agreements, vendor-code and client searches by the UI that asks for them', async () => {
    apiRequestMock.mockResolvedValue([])

    await searchCapitalizationProducts('A1').catch(() => null)
    await searchPlacementProducts('A1').catch(() => null)
    await searchOffersProducts('A1')
    await searchSaleProducts('A1', 'pricing')
    await searchSaleProducts('A1', 'sale-edit')
    await getOffersClientAgreements('c-1')
    await getSaleClientAgreements('c-1', 'pricing')
    await getSaleClientAgreements('c-1', 'online-shop-sales')
    await getSaleClientAgreements('c-1', 'create')
    await getSaleClientAgreements('c-1', 'edit')
    await getSaleClientAgreements('c-1', 'client-card')
    await getOnlineShopReassignmentAgreements('c-1')
    await getReportClientAgreements('c-1')
    await getResaleClientAgreements('c-1')
    await getSadClientAgreements('c-1')
    await searchSadClients('ab')
    await getSadPalletTypes()
    await getPackListClientAgreements('c-1')
    await searchPackListClients('ab').catch(() => null)
    for (const scope of ['income-form', 'outgoing-create', 'sad-income', 'sad-outcome', 'tax-free-income', 'tax-free-outcome'] as const) {
      await getIncomeCashflowClientAgreements('c-1', scope)
    }
    await getClientForAccountingCashFlow('c-1')

    expect(routes()).toEqual([
      '/products/capitalization/create/search/vendorcode',
      '/products/orders-ukraine/placement/search/vendorcode',
      '/products/sales-offers/create/search/vendorcode',
      '/products/pricing/page/search/vendorcode',
      '/products/sales-ukraine/edit/search/vendorcode',
      '/agreements/sales-offers/create/client/all',
      '/agreements/pricing/page/client/all',
      '/agreements/online-shop-sales/page/client/all',
      '/agreements/sales-ukraine/create/client/all',
      '/agreements/sales-ukraine/edit/client/all',
      '/agreements/clients-card/details/client/all',
      '/agreements/sales-ukraine/reassign/client/all',
      '/agreements/reports/stocks/client/all',
      '/agreements/resales/page/client/all',
      '/agreements/sad/open-details/client/all',
      '/clients/sad/open-details/search',
      '/supplies/ukraine/order/packlists/sad/pallet/types/sad/open-details/all',
      '/agreements/tax-free-pack-lists/open-details/client/all',
      '/clients/tax-free-pack-lists/open-details/search',
      '/agreements/income-cashflows/form/client/all',
      '/agreements/outgoing-cashflows/create/client/all',
      '/agreements/sad/accounting/income/client/all',
      '/agreements/sad/accounting/outcome/client/all',
      '/agreements/tax-free-documents/accounting/income/client/all',
      '/agreements/tax-free-documents/accounting/outcome/client/all',
      '/clients/accounting-cash-flow/details',
    ])
  })

  it('reads same-context and embedded lookups through the key that admits the user into the UI', async () => {
    apiRequestMock.mockResolvedValue(null)
    const exchange = { amount: 10, exchangeRate: 2, fromCurrencyId: 1, toCurrencyId: 2 }

    await searchConsumableProductsByVendorCode('A1', 'consumable-order')
    await searchConsumableProductsByVendorCode('A1', 'advanced-report-edit')
    await getOutcomeOrdersByCompanyCar('car-1', 'create')
    await getOutcomeOrdersByCompanyCar('car-1', 'edit')
    await getIncomeCashflowRetailClientAgreements('retail-1')
    await calculateIncomeCashflowExchange(exchange, 'income-form')
    await calculateIncomeCashflowExchange(exchange, 'income-client-payment')
    await calculateAvailablePaymentConvertedAmount(exchange).catch(() => null)
    await getClientSolvencyScore('11111111-1111-4111-8111-111111111111').catch(() => null)
    await getClientSolvencyCharts(42).catch(() => null)
    await getClientCounterpartyGroup('client-1').catch(() => null)
    await getCounterpartyGroupTreeForClientCardEdit().catch(() => null)
    await getRootClientBySubClientNetId('client-1', 'client-card')
    await getRootClientBySubClientNetId('client-1', 'sale-reassign')
    await searchMainClientCandidates('clients', { value: 'ab', limit: 20, offset: 0 })
    await searchMainClientCandidates('suppliers', { value: 'ab', limit: 20, offset: 0 })
    await getClientCardPerfectClients(3, 'details')
    await getClientCardPerfectClients(3, 'create')
    await getClientResourcePerfectClients(3)
    await checkRegionCodeAvailability('region-1', '001')
    await getUnpaidConsumableOrdersByOrganization('org-1')
    await getSalesWizardClientSubClients('client-1', 'create')
    await getWizardDeliveryRecipients('client-1', 'edit')
    await getWizardClientStructure('client-1', 'reassign')
    await getWizardClientStructureDebtTotal('client-1', 'create')
    await getPurchaseCockpitProductAnalytics(7).catch(() => null)
    await getAssortmentUploadStorages()
    await getDashboardSyncStatus()

    expect(routes()).toEqual([
      '/consumables/products/consumable-orders/page/search/vendorcode',
      '/consumables/products/advanced-reports/report/edit/search/vendorcode',
      '/payments/orders/outcome/company-cars/road-list/create/all',
      '/payments/orders/outcome/company-cars/road-list/edit/all',
      '/agreements/income-cashflows/client-payment/retail/all',
      '/payments/orders/income/income-cashflows/form/exchange/calculate',
      '/payments/orders/income/income-cashflows/client-payment/exchange/calculate',
      '/payments/orders/income/available-payments/page/exchange/calculate',
      '/solvency/clients-card/get',
      '/solvency/clients-card/charts',
      '/clients/counterparty-groups/clients-card/client',
      '/clients/counterparty-groups/clients-card/edit/tree',
      '/clients/clients-card/details/subclient',
      '/clients/sales-ukraine/reassign/subclient',
      '/clients/clients-card/edit/main-client/clients',
      '/clients/clients-card/edit/main-client/suppliers',
      '/clients/perfect/clients-card/details/role',
      '/clients/perfect/clients-card/create/role',
      '/clients/perfect/client-resources/page/role',
      '/regions/codes/clients/create/availability/check',
      '/consumables/orders/outgoing-cashflows/create/unpaid',
      '/clients/sales-ukraine/create/subclients',
      '/deliveries/recipients/sales-ukraine/edit/client',
      '/clients/sales-ukraine/reassign/structure',
      '/clients/sales-ukraine/create/structure/debt-total',
      '/procurement/cockpit/product/7/analytics',
      '/storages/products-assortment/upload/nondefective',
      '/data/sync/dashboard/status',
    ])
  })
})
