import type { ReactNode } from 'react'
import type { PermissionKey } from '../../shared/auth/permissionKeys'
import { consoleRoutes } from './consoleRoutes'
import {
  AdvanceReportViewPage,
  ClientEditPage,
  ClientNewPage,
  CompanyCarFormPage,
  ConsumableOrderFormPage,
  ConsumableOrderPayPage,
  ConsumableStorageFormPage,
  CurrencyConvertorFormPage,
  IncomeCashflowClientFormPage,
  IncomeCashflowConversionFormPage,
  IncomeCashflowShopFormPage,
  IncomeCashflowUserFormPage,
  NewResalePage,
  ResalePage,
  OrganizationClientEditPage,
  OrganizationClientNewPage,
  OutgoingCashflowCreatePage,
  PaymentAccountFormPage,
  PaymentCashflowArticleFormPage,
  PaymentExpenseArticleFormPage,
  ProductGroupDetailPage,
  SupplierOrganizationEditPage,
  SupplyOrderUkraineProductPlacementPage,
  SupplyUkraineDirectOrderCreatePage,
  SupplyUkraineToUkraineOrderCreatePage,
  TaxFreeCarrierFormPage,
  UserEditPage,
  UserNewPage,
  WarehouseUkraineOrderPlacementsPage,
} from './lazyConsolePages'
import { lazyRoute } from './lazyRoute'

export type OverlayConsoleRoute = {
  path: string
  element: ReactNode
  permissionKey?: PermissionKey
}

/* Screens that open as a modal over the page the user came from
   (navigation with `state.backgroundLocation`). They are rendered by a second
   <Routes> in App, outside the main route table, so they must not define their
   own access rules: each one inherits the permission key of the main console
   route with the same path. Otherwise a role without the right gets the form
   when the screen is opened from a button instead of by URL. */
const overlayRouteElements: Array<Omit<OverlayConsoleRoute, 'permissionKey'>> = [
  { path: '/clients/new/:step', element: lazyRoute(<ClientNewPage />) },
  { path: '/clients/new', element: lazyRoute(<ClientNewPage />) },
  { path: '/clients/edit/:netid/:step/:productNetId', element: lazyRoute(<ClientEditPage />) },
  { path: '/clients/edit/:netid/:step', element: lazyRoute(<ClientEditPage />) },
  { path: '/clients/edit/:netid', element: lazyRoute(<ClientEditPage />) },
  { path: '/suppliers/edit/:netid/:step/:productNetId', element: lazyRoute(<ClientEditPage />) },
  { path: '/suppliers/edit/:netid/:step', element: lazyRoute(<ClientEditPage />) },
  { path: '/suppliers/edit/:netid', element: lazyRoute(<ClientEditPage />) },
  { path: '/organization-clients/new', element: lazyRoute(<OrganizationClientNewPage />) },
  { path: '/organization-clients/edit/:netId', element: lazyRoute(<OrganizationClientEditPage />) },
  { path: '/accounting/supplier-organizations/new', element: lazyRoute(<SupplierOrganizationEditPage />) },
  { path: '/accounting/supplier-organizations/edit/:id', element: lazyRoute(<SupplierOrganizationEditPage />) },
  { path: '/accounting/company-cars/new', element: lazyRoute(<CompanyCarFormPage />) },
  { path: '/accounting/company-cars/edit/:id', element: lazyRoute(<CompanyCarFormPage />) },
  { path: '/accounting/consumable-orders/new', element: lazyRoute(<ConsumableOrderFormPage />) },
  { path: '/accounting/consumable-orders/edit/:id', element: lazyRoute(<ConsumableOrderFormPage />) },
  { path: '/accounting/consumable-orders/pay/:id', element: lazyRoute(<ConsumableOrderPayPage />) },
  { path: '/accounting/storages/new', element: lazyRoute(<ConsumableStorageFormPage />) },
  { path: '/accounting/storages/edit/:id', element: lazyRoute(<ConsumableStorageFormPage />) },
  { path: '/accounting/currency-convertors/new', element: lazyRoute(<CurrencyConvertorFormPage />) },
  { path: '/accounting/currency-convertors/edit/:id', element: lazyRoute(<CurrencyConvertorFormPage />) },
  { path: '/accounting/income-cashflows/new/client', element: lazyRoute(<IncomeCashflowClientFormPage />) },
  { path: '/accounting/income-cashflows/new/conversion', element: lazyRoute(<IncomeCashflowConversionFormPage />) },
  { path: '/accounting/income-cashflows/new/shop', element: lazyRoute(<IncomeCashflowShopFormPage />) },
  { path: '/accounting/income-cashflows/new/user', element: lazyRoute(<IncomeCashflowUserFormPage />) },
  { path: '/accounting/outgoing-cashflow/new', element: lazyRoute(<OutgoingCashflowCreatePage />) },
  { path: '/accounting/outgoing-cashflow/new/simple', element: lazyRoute(<OutgoingCashflowCreatePage />) },
  { path: '/accounting/outgoing-cashflow/new/group', element: lazyRoute(<OutgoingCashflowCreatePage />) },
  { path: '/accounting/outgoing-cashflow/:id/advanced-report/view', element: lazyRoute(<AdvanceReportViewPage />) },
  { path: '/accounting/payment-accounts/new', element: lazyRoute(<PaymentAccountFormPage />) },
  { path: '/accounting/payment-accounts/edit/:id', element: lazyRoute(<PaymentAccountFormPage />) },
  { path: '/accounting/payment-cashflow-articles/new', element: lazyRoute(<PaymentCashflowArticleFormPage />) },
  { path: '/accounting/payment-cashflow-articles/edit/:id', element: lazyRoute(<PaymentCashflowArticleFormPage />) },
  { path: '/accounting/payment-expense-articles/new', element: lazyRoute(<PaymentExpenseArticleFormPage />) },
  { path: '/accounting/payment-expense-articles/edit/:id', element: lazyRoute(<PaymentExpenseArticleFormPage />) },
  { path: '/tax-free/carriers/new', element: lazyRoute(<TaxFreeCarrierFormPage />) },
  { path: '/tax-free/carriers/edit/:id', element: lazyRoute(<TaxFreeCarrierFormPage />) },
  { path: '/orders/ukraine/all/new', element: lazyRoute(<SupplyUkraineDirectOrderCreatePage />) },
  { path: '/orders/ukraine/to-ukraine/new', element: lazyRoute(<SupplyUkraineToUkraineOrderCreatePage />) },
  { path: '/orders/ukraine/placement/:id', element: lazyRoute(<WarehouseUkraineOrderPlacementsPage />) },
  { path: '/orders/ukraine/:id/product-income', element: lazyRoute(<SupplyOrderUkraineProductPlacementPage />) },
  { path: '/warehouse/ukraine/orders/:id/placements', element: lazyRoute(<WarehouseUkraineOrderPlacementsPage />) },
  { path: '/product-groups/:id', element: lazyRoute(<ProductGroupDetailPage />) },
  { path: '/resales/new', element: lazyRoute(<NewResalePage />) },
  { path: '/resales/:id', element: lazyRoute(<ResalePage />) },
  { path: '/users/new', element: lazyRoute(<UserNewPage />) },
  { path: '/users/edit/:netid', element: lazyRoute(<UserEditPage />) },
]

const mainRoutePermissionKeys = new Map(
  consoleRoutes.map((route) => [route.path, route.permissionKey] as const),
)

export function getMainRoutePermissionKey(path: string): PermissionKey | undefined {
  return mainRoutePermissionKeys.get(path)
}

export const overlayConsoleRoutes: OverlayConsoleRoute[] = overlayRouteElements.map((route) => ({
  ...route,
  permissionKey: getMainRoutePermissionKey(route.path),
}))
