import { Route, Routes, useLocation, type Location } from 'react-router-dom'
import { ConsoleLayout } from './layout/ConsoleLayout'
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
} from './routes/lazyConsolePages'
import { consoleRoutes } from './routes/consoleRoutes'
import { lazyRoute } from './routes/lazyRoute'
import { ProtectedRoute } from '../features/auth/components/ProtectedRoute'
import { OutgoingPaymentTasksRedirect } from '../features/outgoing-cashflows/components/OutgoingPaymentTasksRedirect'
import { LoginPage } from '../pages/login/LoginPage'
import { ModulePage } from '../pages/module/ModulePage'

type AppLocationState = {
  backgroundLocation?: Location
}

export function App() {
  const location = useLocation()
  const state = location.state as AppLocationState | null
  const backgroundLocation = state?.backgroundLocation

  return (
    <>
      <Routes location={backgroundLocation || location}>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<ConsoleLayout />}>
            {consoleRoutes.map((route) => (
              <Route key={route.path} path={route.path} element={route.element} />
            ))}
            <Route path="*" element={<ModulePage fallback />} />
          </Route>
        </Route>
      </Routes>

      {backgroundLocation && (
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/clients/new/:step" element={lazyRoute(<ClientNewPage />)} />
            <Route path="/clients/new" element={lazyRoute(<ClientNewPage />)} />
            <Route path="/clients/edit/:netid/:step/:productNetId" element={lazyRoute(<ClientEditPage />)} />
            <Route path="/clients/edit/:netid/:step" element={lazyRoute(<ClientEditPage />)} />
            <Route path="/clients/edit/:netid" element={lazyRoute(<ClientEditPage />)} />
            <Route path="/suppliers/edit/:netid/:step/:productNetId" element={lazyRoute(<ClientEditPage />)} />
            <Route path="/suppliers/edit/:netid/:step" element={lazyRoute(<ClientEditPage />)} />
            <Route path="/suppliers/edit/:netid" element={lazyRoute(<ClientEditPage />)} />
            <Route path="/organization-clients/new" element={lazyRoute(<OrganizationClientNewPage />)} />
            <Route path="/organization-clients/edit/:netId" element={lazyRoute(<OrganizationClientEditPage />)} />
            <Route path="/accounting/supplier-organizations/new" element={lazyRoute(<SupplierOrganizationEditPage />)} />
            <Route path="/accounting/supplier-organizations/edit/:id" element={lazyRoute(<SupplierOrganizationEditPage />)} />
            <Route path="/accounting/company-cars/new" element={lazyRoute(<CompanyCarFormPage />)} />
            <Route path="/accounting/company-cars/edit/:id" element={lazyRoute(<CompanyCarFormPage />)} />
            <Route path="/accounting/consumable-orders/new" element={lazyRoute(<ConsumableOrderFormPage />)} />
            <Route path="/accounting/consumable-orders/edit/:id" element={lazyRoute(<ConsumableOrderFormPage />)} />
            <Route path="/accounting/consumable-orders/pay/:id" element={lazyRoute(<ConsumableOrderPayPage />)} />
            <Route path="/accounting/storages/new" element={lazyRoute(<ConsumableStorageFormPage />)} />
            <Route path="/accounting/storages/edit/:id" element={lazyRoute(<ConsumableStorageFormPage />)} />
            <Route path="/accounting/currency-convertors/new" element={lazyRoute(<CurrencyConvertorFormPage />)} />
            <Route path="/accounting/currency-convertors/edit/:id" element={lazyRoute(<CurrencyConvertorFormPage />)} />
            <Route path="/accounting/income-cashflows/new/client" element={lazyRoute(<IncomeCashflowClientFormPage />)} />
            <Route path="/accounting/income-cashflows/new/conversion" element={lazyRoute(<IncomeCashflowConversionFormPage />)} />
            <Route path="/accounting/income-cashflows/new/shop" element={lazyRoute(<IncomeCashflowShopFormPage />)} />
            <Route path="/accounting/income-cashflows/new/user" element={lazyRoute(<IncomeCashflowUserFormPage />)} />
            <Route path="/accounting/outgoing-cashflow/new" element={lazyRoute(<OutgoingCashflowCreatePage />)} />
            <Route path="/accounting/outgoing-cashflow/new/simple" element={lazyRoute(<OutgoingCashflowCreatePage />)} />
            <Route path="/accounting/outgoing-cashflow/new/supplier" element={lazyRoute(<OutgoingCashflowCreatePage />)} />
            <Route path="/accounting/outgoing-cashflow/new/client-return" element={lazyRoute(<OutgoingCashflowCreatePage />)} />
            <Route path="/accounting/outgoing-cashflow/new/group" element={lazyRoute(<OutgoingCashflowCreatePage />)} />
            <Route path="/accounting/outgoing-cashflow/new/payment-tasks" element={<OutgoingPaymentTasksRedirect />} />
            <Route path="/accounting/outgoing-cashflow/:id/advanced-report/view" element={lazyRoute(<AdvanceReportViewPage />)} />
            <Route path="/accounting/payment-accounts/new" element={lazyRoute(<PaymentAccountFormPage />)} />
            <Route path="/accounting/payment-accounts/edit/:id" element={lazyRoute(<PaymentAccountFormPage />)} />
            <Route path="/accounting/payment-cashflow-articles/new" element={lazyRoute(<PaymentCashflowArticleFormPage />)} />
            <Route path="/accounting/payment-cashflow-articles/edit/:id" element={lazyRoute(<PaymentCashflowArticleFormPage />)} />
            <Route path="/accounting/payment-expense-articles/new" element={lazyRoute(<PaymentExpenseArticleFormPage />)} />
            <Route path="/accounting/payment-expense-articles/edit/:id" element={lazyRoute(<PaymentExpenseArticleFormPage />)} />
            <Route path="/tax-free/carriers/new" element={lazyRoute(<TaxFreeCarrierFormPage />)} />
            <Route path="/tax-free/carriers/edit/:id" element={lazyRoute(<TaxFreeCarrierFormPage />)} />
            <Route path="/orders/ukraine/all/new" element={lazyRoute(<SupplyUkraineDirectOrderCreatePage />)} />
            <Route path="/orders/ukraine/to-ukraine/new" element={lazyRoute(<SupplyUkraineToUkraineOrderCreatePage />)} />
            <Route path="/orders/ukraine/placement/:id" element={lazyRoute(<WarehouseUkraineOrderPlacementsPage />)} />
            <Route path="/orders/ukraine/:id/product-income" element={lazyRoute(<SupplyOrderUkraineProductPlacementPage />)} />
            <Route path="/warehouse/ukraine/orders/:id/placements" element={lazyRoute(<WarehouseUkraineOrderPlacementsPage />)} />
            <Route path="/product-groups/:id" element={lazyRoute(<ProductGroupDetailPage />)} />
            <Route path="/resales/new" element={lazyRoute(<NewResalePage />)} />
            <Route path="/users/new" element={lazyRoute(<UserNewPage />)} />
            <Route path="/users/edit/:netid" element={lazyRoute(<UserEditPage />)} />
          </Route>
        </Routes>
      )}
    </>
  )
}
