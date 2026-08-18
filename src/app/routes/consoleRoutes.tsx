import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import {
  PermissionKeys,
  type PermissionKey,
} from '../../shared/auth/permissionKeys'
import { PaymentArticlesPage } from '../../features/payment-articles/PaymentArticlesPage'
import {
  AccountableExpensesPage,
  ActProvidingServiceDetailPage,
  ActProvidingServicesPage,
  AccountingBanksPage,
  AdvancePaymentsPage,
  AdvancedReportsPage,
  AllSadsPage,
  BasketSupplyUkraineOrderPage,
  ClientAccountingCashFlowPage,
  ClientEditPage,
  ClientNewPage,
  ClientResourcesPage,
  ClientsPage,
  ClientsStructureTreePage,
  ConsumableOrderFormPage,
  ConsumableOrderPayPage,
  ConsumableOrdersPage,
  ConsumableProductsPage,
  ConsumableStorageFormPage,
  ConsumableStoragesPage,
  DashboardPage,
  EditSadPage,
  EditSaleSadPage,
  EditTaxFreePackListPage,
  EditTirSadPage,
  IncomeCashflowClientFormPage,
  IncomeCashflowConversionFormPage,
  IncomeCashflowShopFormPage,
  IncomeCashflowUserFormPage,
  IncomeCashflowsPage,
  IncompleteSalesOnlineShopPage,
  NewEcommerceClientsPage,
  OnlineShopCitiesPage,
  OnlineShopClientsPage,
  OnlineShopSeoPage,
  OrganizationClientEditPage,
  OrganizationClientNewPage,
  OrganizationClientsPage,
  OrganisationServicesPage,
  OutgoingCashflowsPage,
  PaymentAccountFormPage,
  PaymentAccountsPage,
  PaymentCashflowArticleFormPage,
  DepreciatedOrdersPage,
  ProductDeliveryProtocolsPage,
  ProductDeliveryProtocolLogisticPathPage,
  ProductDeliveryProtocolSpecificationPage,
  ProductDeliveryProtocolIncomePage,
  PaymentExpenseArticleFormPage,
  ProductAvailabilitiesPage,
  ProductCapitalizationsPage,
  ProductSpecificationCodesPage,
  SupplyReturnsPage,
  SupplyUkraineDirectOrderCreatePage,
  SupplyUkraineDirectOrderDetailPage,
  SupplyUkraineDirectOrderInvoicesPage,
  SupplyUkraineDirectOrderProductIncomePage,
  SupplyUkraineDirectOrderSpecificationsPage,
  SupplyUkraineOrderOverviewPage,
  SupplyUkraineOrdersPage,
  SupplyUkraineToUkraineOrderCreatePage,
  ProductGroupDetailPage,
  ProductGroupsPage,
  ProductGroupsTreePage,
  ProductHistoryPage,
  ProductIncomeDocumentsPage,
  ProductIncomeUkrainePage,
  ProductPlacementsPage,
  ProductRemainsPage,
  ProductStoragesPage,
  ProductTransfersPage,
  ProductsPage,
  PricingPage,
  NewResalePage,
  NewUkraineSaleReturnPage,
  ReportsSalePage,
  ReportsStocksPage,
  ResalePage,
  ResalesPage,
  SadSpecificationsPage,
  SalesCockpitPage,
  HeadDashboardPage,
  SalesGeographyPage,
  AssortmentDashboardPage,
  RetailClientSalesPage,
  RetailIncompleteSalePage,
  SalesOnlineShopPage,
  SalesUkrainePage,
  SalesDebtorsPage,
  SalesPreordersInterestPage,
  ShoppingCartReservePage,
  ClientProductMovementPage,
  OffersPage,
  SalesPredictionPage,
  SalesChartsPage,
  SupplyOrderProductPlacementPage,
  SupplyOrderUkraineProductPlacementPage,
  SupplierAccountingCashFlowPage,
  SupplierOrganizationCashFlowPage,
  SupplierOrganizationEditPage,
  SupplierOrganizationsPage,
  TaxFreeDocumentsPage,
  TaxFreeCarriersPage,
  TaxFreeCarrierFormPage,
  ActReconciliationsPage,
  ActReconciliationViewPage,
  SupplyUkrainePaymentProtocolsPage,
  TaxFreePackListsPage,
  SuppliersPage,
  TransportersPage,
  WarehouseUkrainePage,
  WarehouseUkraineOrderPlacementsPage,
  CompanyCarsPage,
  CompanyCarFormPage,
  CompanyCarRoadListsPage,
  CurrencyConvertorsPage,
  CurrencyConvertorFormPage,
  PaymentOnlineShopPage,
  BalancesPage,
  AvailablePaymentsPage,
  OutgoingCashflowCreatePage,
  AdvanceReportViewPage,
  UserEditPage,
  UserNewPage,
  UserRolesPage,
  UsersPage,
  VehicleRegistryPage,
} from './lazyConsolePages'
import { lazyRoute } from './lazyRoute'
import { ProductCarouselDeepLinkRedirect } from './ProductCarouselDeepLinkRedirect'
import { SalesDashboardShell } from '../../shared/ui/SalesDashboardShell'

export type ConsoleRoute = {
  path: string
  element: ReactNode
  permissionKey?: PermissionKey
}

const migratedConsoleRoutes: ConsoleRoute[] = [
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  {
    path: '/dashboard',
    element: lazyRoute(<DashboardPage />),
    permissionKey: PermissionKeys.SystemPages.Dashboard.View,
  },
  { path: '/products', element: lazyRoute(<ProductsPage />) },
  {
    path: '/products/consignments/availabilities',
    element: lazyRoute(<ProductAvailabilitiesPage />),
    permissionKey: PermissionKeys.SystemPages.ProductAvailabilities.View,
  },
  {
    path: '/products/income/documents',
    element: lazyRoute(<ProductIncomeDocumentsPage />),
  },
  {
    path: '/products/income/ukraine',
    element: lazyRoute(<ProductIncomeUkrainePage />),
  },
  {
    path: '/products/placements',
    element: lazyRoute(<ProductPlacementsPage />),
  },
  { path: '/products/storages', element: lazyRoute(<ProductStoragesPage />) },
  {
    path: '/products/storages/incomes',
    element: lazyRoute(<ProductRemainsPage />),
  },
  {
    path: '/products/storages/incomes/:tab',
    element: lazyRoute(<ProductRemainsPage />),
  },
  { path: '/products/transfers', element: lazyRoute(<ProductTransfersPage />) },
  {
    path: '/products/capitalization',
    element: lazyRoute(<ProductCapitalizationsPage />),
    permissionKey: PermissionKeys.WarehouseAccounting.Capitalization.Page.View,
  },
  {
    path: '/products/assortment',
    element: lazyRoute(<AssortmentDashboardPage />),
  },
  {
    path: '/accounting/specification-codes',
    element: lazyRoute(<ProductSpecificationCodesPage />),
  },
  {
    path: '/accounting/specification-codes/uk',
    element: lazyRoute(<ProductSpecificationCodesPage />),
  },
  { path: '/supplies/returns', element: lazyRoute(<SupplyReturnsPage />) },
  {
    path: '/orders/ukraine/all',
    element: lazyRoute(<SupplyUkraineOrdersPage />),
  },
  {
    path: '/orders/ukraine/all/new',
    element: lazyRoute(<SupplyUkraineDirectOrderCreatePage />),
  },
  {
    path: '/orders/ukraine/to-ukraine/new',
    element: lazyRoute(<SupplyUkraineToUkraineOrderCreatePage />),
  },
  {
    path: '/orders/ukraine/view/:id',
    element: lazyRoute(<SupplyUkraineOrderOverviewPage />),
  },
  {
    path: '/orders/ukraine/placement/:id',
    element: lazyRoute(<WarehouseUkraineOrderPlacementsPage />),
  },
  {
    path: '/orders/ukraine/all/edit/:id/supply-invoices',
    element: lazyRoute(<SupplyUkraineDirectOrderInvoicesPage />),
  },
  {
    path: '/orders/ukraine/all/edit/:id/specifications',
    element: lazyRoute(<SupplyUkraineDirectOrderSpecificationsPage />),
  },
  {
    path: '/orders/develop/all/edit/:id/specifications',
    element: lazyRoute(<SupplyUkraineDirectOrderSpecificationsPage />),
  },
  {
    path: '/orders/ukraine/all/edit/:id/product-income',
    element: lazyRoute(<SupplyUkraineDirectOrderProductIncomePage />),
  },
  {
    path: '/orders/ukraine/all/edit/:id/new',
    element: lazyRoute(<SupplyUkraineDirectOrderDetailPage />),
  },
  {
    path: '/orders/ukraine/all/edit/:id',
    element: lazyRoute(<SupplyUkraineDirectOrderDetailPage />),
  },
  {
    path: '/orders/ukraine/:id/product-income',
    element: lazyRoute(<SupplyOrderUkraineProductPlacementPage />),
  },
  {
    path: '/orders/ukraine/protocols/:netid',
    element: lazyRoute(<SupplyUkrainePaymentProtocolsPage />),
  },
  {
    path: '/supply-orders/product-placement/:id',
    element: lazyRoute(<SupplyOrderProductPlacementPage />),
  },
  {
    path: '/orders/depreciated',
    element: lazyRoute(<DepreciatedOrdersPage />),
  },
  {
    path: '/product-delivery-protocols',
    element: lazyRoute(<ProductDeliveryProtocolsPage />),
  },
  {
    path: '/product-delivery-protocols/:id',
    element: lazyRoute(<ProductDeliveryProtocolLogisticPathPage />),
  },
  {
    path: '/product-delivery-protocols/:id/specifications',
    element: lazyRoute(<ProductDeliveryProtocolSpecificationPage />),
  },
  {
    path: '/product-delivery-protocols/:id/product-income',
    element: lazyRoute(<ProductDeliveryProtocolIncomePage />),
  },
  { path: '/products/history', element: lazyRoute(<ProductHistoryPage />) },
  { path: '/products/:netId', element: <ProductCarouselDeepLinkRedirect /> },
  { path: '/product-groups', element: lazyRoute(<ProductGroupsPage />) },
  {
    path: '/product-groups/tree',
    element: lazyRoute(<ProductGroupsTreePage />),
  },
  {
    path: '/product-groups/:id',
    element: lazyRoute(<ProductGroupDetailPage />),
  },
  { path: '/transporters', element: lazyRoute(<TransportersPage />) },
  { path: '/warehouse/ukraine', element: lazyRoute(<WarehouseUkrainePage />) },
  {
    path: '/warehouse/ukraine/orders/:id/placements',
    element: lazyRoute(<WarehouseUkraineOrderPlacementsPage />),
  },
  { path: '/sales/cockpit', element: lazyRoute(<SalesCockpitPage />) },
  { path: '/sales/cockpit/head', element: lazyRoute(<HeadDashboardPage />) },
  { path: '/sales/geography', element: lazyRoute(<SalesGeographyPage />) },
]

const clientMigrationRoutes: ConsoleRoute[] = [
  { path: '/clients', element: lazyRoute(<ClientsPage />) },
  {
    path: '/clients/structure',
    element: lazyRoute(<ClientsStructureTreePage />),
  },
  { path: '/clients/new/:step', element: lazyRoute(<ClientNewPage />), permissionKey: PermissionKeys.Clients.Client.Create },
  { path: '/clients/new', element: lazyRoute(<ClientNewPage />), permissionKey: PermissionKeys.Clients.Client.Create },
  {
    path: '/clients/edit/:netid/:step/:productNetId',
    element: lazyRoute(<ClientEditPage />),
    permissionKey: PermissionKeys.Clients.Details.Open,
  },
  {
    path: '/clients/edit/:netid/:step',
    element: lazyRoute(<ClientEditPage />),
    permissionKey: PermissionKeys.Clients.Details.Open,
  },
  {
    path: '/clients/edit/:netid',
    element: lazyRoute(<ClientEditPage />),
    permissionKey: PermissionKeys.Clients.Details.Open,
  },
  {
    path: '/clients/resources/:step',
    element: lazyRoute(<ClientResourcesPage />),
  },
  { path: '/clients/resources', element: lazyRoute(<ClientResourcesPage />) },
  {
    path: '/clients/accounting-cash-flow/:id',
    element: lazyRoute(<ClientAccountingCashFlowPage />),
    permissionKey: PermissionKeys.Clients.AccountingCashFlow.Open,
  },
  {
    path: '/new-clients-from-ecommerce',
    element: lazyRoute(<NewEcommerceClientsPage />),
    permissionKey: PermissionKeys.NewEcommerceClients.Page.View,
  },
  {
    path: '/clients-online-shop/client/:netUid',
    element: lazyRoute(<RetailClientSalesPage />),
    permissionKey: PermissionKeys.OnlineShopClients.Sales.Open,
  },
  {
    path: '/clients-online-shop/incomplete-sale/:netUid',
    element: lazyRoute(<RetailIncompleteSalePage />),
    permissionKey: PermissionKeys.OnlineShopClients.Page.View,
  },
  {
    path: '/clients-online-shop',
    element: lazyRoute(<OnlineShopClientsPage />),
    permissionKey: PermissionKeys.OnlineShopClients.Page.View,
  },
  { path: '/sales-online-shop', element: lazyRoute(<SalesOnlineShopPage />) },
  {
    path: '/incomplete-sales-online-shop',
    element: lazyRoute(<IncompleteSalesOnlineShopPage />),
    permissionKey: PermissionKeys.IncompleteSalesOnlineShop.Page.View,
  },
  {
    path: '/online-shop-cities',
    element: lazyRoute(<OnlineShopCitiesPage />),
    permissionKey: PermissionKeys.OnlineShopCities.Page.View,
  },
  { path: '/online-shop-seo', element: lazyRoute(<OnlineShopSeoPage />) },
  { path: '/online-shop-seo/:tab', element: lazyRoute(<OnlineShopSeoPage />) },
  { path: '/suppliers', element: lazyRoute(<SuppliersPage />), permissionKey: PermissionKeys.Suppliers.Page.View },
  {
    path: '/suppliers/edit/:netid/:step/:productNetId',
    element: lazyRoute(<ClientEditPage />),
    permissionKey: PermissionKeys.Clients.Details.Open,
  },
  {
    path: '/suppliers/edit/:netid/:step',
    element: lazyRoute(<ClientEditPage />),
    permissionKey: PermissionKeys.Clients.Details.Open,
  },
  { path: '/suppliers/edit/:netid', element: lazyRoute(<ClientEditPage />), permissionKey: PermissionKeys.Clients.Details.Open },
  {
    path: '/suppliers/accounting-cash-flow/:id',
    element: lazyRoute(<SupplierAccountingCashFlowPage />),
    permissionKey: PermissionKeys.Clients.AccountingCashFlow.Open,
  },
  {
    path: '/organization-clients',
    element: lazyRoute(<OrganizationClientsPage />),
    permissionKey: PermissionKeys.OrganizationClients.Page.View,
  },
  {
    path: '/organization-clients/new',
    element: lazyRoute(<OrganizationClientNewPage />),
    permissionKey: PermissionKeys.OrganizationClients.Client.Create,
  },
  {
    path: '/organization-clients/edit/:netId',
    element: lazyRoute(<OrganizationClientEditPage />),
    permissionKey: PermissionKeys.OrganizationClients.Client.OpenDetails,
  },
]

const userMigrationRoutes: ConsoleRoute[] = [
  {
    path: '/users',
    element: lazyRoute(<UsersPage />),
    permissionKey: PermissionKeys.SystemPages.Users.View,
  },
  {
    path: '/users/new',
    element: lazyRoute(<UserNewPage />),
    permissionKey: PermissionKeys.Users.User.Create,
  },
  {
    path: '/users/edit/:netid',
    element: lazyRoute(<UserEditPage />),
    permissionKey: PermissionKeys.Users.User.OpenDetails,
  },
  {
    path: '/users/roles',
    element: lazyRoute(<UserRolesPage />),
    permissionKey: PermissionKeys.SystemPages.Roles.View,
  },
  {
    path: '/administration/vehicle-registry',
    element: lazyRoute(<VehicleRegistryPage />),
    permissionKey: PermissionKeys.SystemPages.VehicleRegistry.View,
  },
]

const accountingMigrationRoutes: ConsoleRoute[] = [
  {
    path: '/accounting/consumable-product',
    element: lazyRoute(<ConsumableProductsPage />),
    permissionKey: PermissionKeys.ConsumableProducts.Page.View,
  },
  {
    path: '/accounting/advanced-reports',
    element: lazyRoute(<AdvancedReportsPage />),
    permissionKey: PermissionKeys.SystemPages.AdvancedReports.View,
  },
  {
    path: '/accounting/consumable-services',
    element: lazyRoute(<AccountableExpensesPage />),
    permissionKey: PermissionKeys.AccountableExpenses.Page.View,
  },
  {
    path: '/accounting/consumable-orders',
    element: lazyRoute(<ConsumableOrdersPage />),
    permissionKey: PermissionKeys.ConsumableOrders.Page.View,
  },
  {
    path: '/accounting/consumable-orders/new',
    element: lazyRoute(<ConsumableOrderFormPage />),
    permissionKey: PermissionKeys.ConsumableOrders.Order.Create,
  },
  {
    path: '/accounting/consumable-orders/edit/:id',
    element: lazyRoute(<ConsumableOrderFormPage />),
    permissionKey: PermissionKeys.ConsumableOrders.Page.View,
  },
  {
    path: '/accounting/consumable-orders/pay/:id',
    element: lazyRoute(<ConsumableOrderPayPage />),
    permissionKey: PermissionKeys.ConsumableOrders.Order.Pay,
  },
  {
    path: '/accounting/outgoing-cashflow',
    element: lazyRoute(<OutgoingCashflowsPage />),
    permissionKey: PermissionKeys.SystemPages.OutgoingCashflows.View,
  },
  {
    path: '/accounting/outgoing-cashflow/new',
    element: lazyRoute(<OutgoingCashflowCreatePage />),
    permissionKey: PermissionKeys.OutgoingCashflows.Order.Create,
  },
  {
    path: '/accounting/outgoing-cashflow/new/simple',
    element: lazyRoute(<OutgoingCashflowCreatePage />),
    permissionKey: PermissionKeys.OutgoingCashflows.Order.Create,
  },
  {
    path: '/accounting/outgoing-cashflow/new/group',
    element: lazyRoute(<OutgoingCashflowCreatePage />),
    permissionKey: PermissionKeys.OutgoingCashflows.Order.Create,
  },
  {
    path: '/accounting/outgoing-cashflow/:id/advanced-report/view',
    element: lazyRoute(<AdvanceReportViewPage />),
    permissionKey: PermissionKeys.AdvancedReports.Report.Open,
  },
  {
    path: '/accounting/storages',
    element: lazyRoute(<ConsumableStoragesPage />),
    permissionKey: PermissionKeys.Warehouses.Premises.Page.View,
  },
  {
    path: '/accounting/storages/new',
    element: lazyRoute(<ConsumableStorageFormPage />),
    permissionKey: PermissionKeys.Warehouses.Premises.Premise.Create,
  },
  {
    path: '/accounting/storages/edit/:id',
    element: lazyRoute(<ConsumableStorageFormPage />),
    permissionKey: PermissionKeys.Warehouses.Premises.Premise.Edit,
  },
  {
    path: '/accounting/supplier-organizations',
    element: lazyRoute(<SupplierOrganizationsPage />),
  },
  {
    path: '/accounting/supplier-organizations/new',
    element: lazyRoute(<SupplierOrganizationEditPage />),
  },
  {
    path: '/accounting/supplier-organizations/edit/:id',
    element: lazyRoute(<SupplierOrganizationEditPage />),
  },
  {
    path: '/accounting/supplier-organizations/cash-flow/:id',
    element: lazyRoute(<SupplierOrganizationCashFlowPage />),
  },
  {
    path: '/accounting/payment-cashflow-articles',
    element: <PaymentArticlesPage />,
  },
  {
    path: '/accounting/payment-cashflow-articles/new',
    element: lazyRoute(<PaymentCashflowArticleFormPage />),
  },
  {
    path: '/accounting/payment-cashflow-articles/edit/:id',
    element: lazyRoute(<PaymentCashflowArticleFormPage />),
  },
  {
    path: '/accounting/income-cashflows',
    element: lazyRoute(<IncomeCashflowsPage />),
  },
  {
    path: '/accounting/income-cashflows/new',
    element: (
      <Navigate
        to="/accounting/income-cashflows/new/conversion?type=0"
        replace
      />
    ),
  },
  {
    path: '/accounting/income-cashflows/new/client',
    element: lazyRoute(<IncomeCashflowClientFormPage />),
  },
  {
    path: '/accounting/income-cashflows/new/conversion',
    element: lazyRoute(<IncomeCashflowConversionFormPage />),
  },
  {
    path: '/accounting/income-cashflows/new/shop',
    element: lazyRoute(<IncomeCashflowShopFormPage />),
  },
  {
    path: '/accounting/income-cashflows/new/user',
    element: lazyRoute(<IncomeCashflowUserFormPage />),
  },
  {
    path: '/accounting/income-cashflows/new/:step',
    element: <Navigate to="/accounting/income-cashflows" replace />,
  },
  {
    path: '/accounting/payment-expense-articles',
    element: <PaymentArticlesPage />,
    permissionKey: PermissionKeys.SystemPages.ExpenseArticles.View,
  },
  {
    path: '/accounting/payment-expense-articles/new',
    element: lazyRoute(<PaymentExpenseArticleFormPage />),
    permissionKey: PermissionKeys.SystemPages.ExpenseArticles.View,
  },
  {
    path: '/accounting/payment-expense-articles/edit/:id',
    element: lazyRoute(<PaymentExpenseArticleFormPage />),
    permissionKey: PermissionKeys.SystemPages.ExpenseArticles.View,
  },
  {
    path: '/accounting/payment-accounts',
    element: lazyRoute(<PaymentAccountsPage />),
  },
  {
    path: '/accounting/payment-accounts/new',
    element: lazyRoute(<PaymentAccountFormPage />),
  },
  {
    path: '/accounting/payment-accounts/edit/:id',
    element: lazyRoute(<PaymentAccountFormPage />),
  },
  {
    path: '/accounting/advance-payments',
    element: lazyRoute(<AdvancePaymentsPage />),
  },
  { path: '/accounting/banks', element: lazyRoute(<AccountingBanksPage />) },
  { path: '/accounting/company-cars', element: lazyRoute(<CompanyCarsPage />) },
  {
    path: '/accounting/company-cars/new',
    element: lazyRoute(<CompanyCarFormPage />),
  },
  {
    path: '/accounting/company-cars/edit/:id',
    element: lazyRoute(<CompanyCarFormPage />),
  },
  {
    path: '/accounting/company-cars/:id/road-lists',
    element: lazyRoute(<CompanyCarRoadListsPage />),
  },
  {
    path: '/accounting/currency-convertors',
    element: lazyRoute(<CurrencyConvertorsPage />),
  },
  {
    path: '/accounting/currency-convertors/new',
    element: lazyRoute(<CurrencyConvertorFormPage />),
  },
  {
    path: '/accounting/currency-convertors/edit/:id',
    element: lazyRoute(<CurrencyConvertorFormPage />),
  },
  {
    path: '/accounting/payment-online-shop',
    element: lazyRoute(<PaymentOnlineShopPage />),
  },
  { path: '/accounting/sync/documents', element: lazyRoute(<BalancesPage />) },
  {
    path: '/accounting/available-payments',
    element: lazyRoute(<AvailablePaymentsPage />),
  },
  {
    path: '/payments/available',
    element: lazyRoute(<AvailablePaymentsPage />),
  },
]

const customsMigrationRoutes: ConsoleRoute[] = [
  {
    path: '/sad/all',
    element: lazyRoute(<AllSadsPage />),
    permissionKey: PermissionKeys.SystemPages.Sad.View,
  },
  {
    path: '/sad/edit/:netid',
    element: lazyRoute(<EditSadPage />),
    permissionKey: PermissionKeys.SystemPages.Sad.View,
  },
  {
    path: '/sad/edit/:netid/sale',
    element: lazyRoute(<EditSaleSadPage />),
    permissionKey: PermissionKeys.SystemPages.Sad.View,
  },
  {
    path: '/sad/edit/:netid/tir',
    element: lazyRoute(<EditTirSadPage />),
    permissionKey: PermissionKeys.SystemPages.Sad.View,
  },
  {
    path: '/sad/edit/:id/specifications',
    element: lazyRoute(<SadSpecificationsPage />),
    permissionKey: PermissionKeys.SystemPages.Sad.View,
  },
  {
    path: '/tax-free/pack-list/all',
    element: lazyRoute(<TaxFreePackListsPage />),
    permissionKey: PermissionKeys.SystemPages.TaxFreePackLists.View,
  },
  {
    path: '/tax-free/pack-list/edit/:id',
    element: lazyRoute(<EditTaxFreePackListPage />),
    permissionKey: PermissionKeys.SystemPages.TaxFreePackLists.View,
  },
  {
    path: '/tax-free/all',
    element: lazyRoute(<TaxFreeDocumentsPage />),
    permissionKey: PermissionKeys.SystemPages.TaxFreeDocuments.View,
  },
  {
    path: '/tax-free/carriers/all',
    element: lazyRoute(<TaxFreeCarriersPage />),
    permissionKey: PermissionKeys.SystemPages.TaxFreeCarriers.View,
  },
  {
    path: '/tax-free/carriers/new',
    element: lazyRoute(<TaxFreeCarrierFormPage />),
    permissionKey: PermissionKeys.SystemPages.TaxFreeCarriers.View,
  },
  {
    path: '/tax-free/carriers/edit/:id',
    element: lazyRoute(<TaxFreeCarrierFormPage />),
    permissionKey: PermissionKeys.SystemPages.TaxFreeCarriers.View,
  },
  {
    path: '/ukraine/act/reconcoliation',
    element: lazyRoute(<ActReconciliationsPage />),
    permissionKey: PermissionKeys.ActReconciliations.Page.View,
  },
  {
    path: '/ukraine/act/reconcoliation/:netid',
    element: lazyRoute(<ActReconciliationViewPage />),
    permissionKey: PermissionKeys.ActReconciliations.Page.View,
  },
]

const plannedConsoleRoutes: ConsoleRoute[] = [
  {
    path: '/act-providing-services',
    element: lazyRoute(<ActProvidingServicesPage />),
  },
  {
    path: '/act-providing-services/:id',
    element: lazyRoute(<ActProvidingServiceDetailPage />),
  },
  {
    path: '/basket-supply-ukraine-order',
    element: lazyRoute(<BasketSupplyUkraineOrderPage />),
    permissionKey: PermissionKeys.SystemPages.SupplyCart.View,
  },
  {
    path: '/basket-supply-ukraine-order/*',
    element: lazyRoute(<BasketSupplyUkraineOrderPage />),
    permissionKey: PermissionKeys.SystemPages.SupplyCart.View,
  },
  {
    path: '/recommendations',
    element: lazyRoute(<BasketSupplyUkraineOrderPage />),
  },
  {
    path: '/resales',
    element: (
      <SalesDashboardShell>{lazyRoute(<ResalesPage />)}</SalesDashboardShell>
    ),
    permissionKey: PermissionKeys.Resales.Page.View,
  },
  {
    path: '/resales/new',
    element: lazyRoute(<NewResalePage />),
    permissionKey: PermissionKeys.Resales.Resale.Create,
  },
  {
    path: '/resales/:id',
    element: lazyRoute(<ResalePage />),
    permissionKey: PermissionKeys.Resales.Page.View,
  },
  {
    path: '/reports/stocks',
    element: lazyRoute(<ReportsStocksPage />),
    permissionKey: PermissionKeys.ReportsStocks.Page.View,
  },
  { path: '/reports/sale', element: lazyRoute(<ReportsSalePage />) },
  { path: '/reports/sales', element: lazyRoute(<ReportsSalePage />) },
  {
    path: '/sales/return/client',
    element: <Navigate replace to="/sales/ukraine/all/returns/new" />,
  },
  {
    path: '/sales/ukraine/all',
    element: (
      <SalesDashboardShell>
        {lazyRoute(<SalesUkrainePage />)}
      </SalesDashboardShell>
    ),
  },
  {
    path: '/sales/ukraine/debtors',
    element: (
      <SalesDashboardShell>
        {lazyRoute(<SalesDebtorsPage />)}
      </SalesDashboardShell>
    ),
  },
  {
    path: '/sales/ukraine/interest',
    element: (
      <SalesDashboardShell>
        {lazyRoute(<SalesPreordersInterestPage />)}
      </SalesDashboardShell>
    ),
  },
  {
    path: '/sales/ukraine/cart-reserve',
    element: (
      <SalesDashboardShell>
        {lazyRoute(<ShoppingCartReservePage />)}
      </SalesDashboardShell>
    ),
  },
  {
    path: '/sales/ukraine/client-product-movement',
    element: (
      <SalesDashboardShell>
        {lazyRoute(<ClientProductMovementPage />)}
      </SalesDashboardShell>
    ),
  },
  {
    path: '/sales/ukraine/offers',
    element: (
      <SalesDashboardShell>{lazyRoute(<OffersPage />)}</SalesDashboardShell>
    ),
  },
  {
    path: '/sales/ukraine/prediction',
    element: (
      <SalesDashboardShell>
        {lazyRoute(<SalesPredictionPage />)}
      </SalesDashboardShell>
    ),
  },
  {
    path: '/sales/charts',
    element: (
      <SalesDashboardShell>
        {lazyRoute(<SalesChartsPage />)}
      </SalesDashboardShell>
    ),
  },
  {
    path: '/sales/ukraine/all/returns/new',
    element: (
      <SalesDashboardShell>
        {lazyRoute(<NewUkraineSaleReturnPage />)}
      </SalesDashboardShell>
    ),
  },
  {
    path: '/sales',
    element: lazyRoute(<BasketSupplyUkraineOrderPage />),
    permissionKey: PermissionKeys.SystemPages.SupplySales.View,
  },
  {
    path: '/service/organisations',
    element: lazyRoute(<OrganisationServicesPage />),
    permissionKey: PermissionKeys.SystemPages.ServiceOrganisations.View,
  },
  {
    path: '/pricing',
    element: lazyRoute(<PricingPage />),
    permissionKey: PermissionKeys.ProductPricing.Page.View,
  },
]

export const consoleRoutes: ConsoleRoute[] = [
  ...migratedConsoleRoutes,
  ...clientMigrationRoutes,
  ...userMigrationRoutes,
  ...accountingMigrationRoutes,
  ...customsMigrationRoutes,
  ...plannedConsoleRoutes,
]
