import { isValidElement } from 'react'
import { Navigate } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { PaymentArticlesPage } from '../../features/payment-articles/PaymentArticlesPage'
import { PermissionKeys } from '../../shared/auth/permissionKeys'
import { consoleRoutes } from './consoleRoutes'

const EXPECTED_NEW_PAGE_PERMISSIONS = {
  '/dashboard': PermissionKeys.SystemPages.Dashboard.View,
  '/administration/vehicle-registry':
    PermissionKeys.SystemPages.VehicleRegistry.View,
  '/accounting/payment-expense-articles':
    PermissionKeys.SystemPages.ExpenseArticles.View,
  '/basket-supply-ukraine-order': PermissionKeys.SystemPages.SupplyCart.View,
  '/sales': PermissionKeys.SystemPages.SupplySales.View,
  '/sales/cockpit': PermissionKeys.SystemPages.SalesCockpit.View,
  '/sales/cockpit/head': PermissionKeys.SystemPages.SalesHeadDashboard.View,
  '/sales/ukraine/offers': PermissionKeys.SystemPages.SalesUkraineOffers.View,
  '/service/organisations':
    PermissionKeys.SystemPages.ServiceOrganisations.View,
  '/sad/all': PermissionKeys.SystemPages.Sad.View,
  '/tax-free/carriers/all': PermissionKeys.SystemPages.TaxFreeCarriers.View,
  '/tax-free/all': PermissionKeys.SystemPages.TaxFreeDocuments.View,
  '/tax-free/pack-list/all': PermissionKeys.SystemPages.TaxFreePackLists.View,
  '/accounting/consumable-services': PermissionKeys.AccountableExpenses.Page.View,
  '/accounting/consumable-orders': PermissionKeys.ConsumableOrders.Page.View,
  '/accounting/consumable-product': PermissionKeys.ConsumableProducts.Page.View,
  '/resales': PermissionKeys.Resales.Page.View,
  '/reports/stocks': PermissionKeys.ReportsStocks.Page.View,
  '/products/transfers': PermissionKeys.ProductTransfers.Page.View,
  '/products/storages/incomes': PermissionKeys.SystemPages.ConsignmentBalances.View,
  '/orders/depreciated': PermissionKeys.SystemPages.WriteOff.View,
  '/accounting/payment-online-shop': PermissionKeys.SystemPages.OnlineShopPayment.View,
  '/accounting/income-cashflows': PermissionKeys.SystemPages.IncomeCashflows.View,
  '/accounting/income-cashflows/new/conversion':
    PermissionKeys.FinancialAdministration.IncomeCashflows.IncomeOrder.CreateOtherIncome,
  '/accounting/income-cashflows/new/shop': PermissionKeys.OnlineShopPayment.IncomeOrder.Create,
  '/accounting/income-cashflows/new/user':
    PermissionKeys.FinancialAdministration.IncomeCashflows.IncomeOrder.CreateColleagueReturn,
} as const

describe('newly classified page permissions', () => {
  it.each(Object.entries(EXPECTED_NEW_PAGE_PERMISSIONS))(
    'maps %s to one canonical page key',
    (path, permissionKey) => {
      const route = consoleRoutes.find((candidate) => candidate.path === path)

      expect(route?.permissionKey).toBe(permissionKey)
    },
  )

  it('keeps every canonical page key unique', () => {
    const keys = Object.values(EXPECTED_NEW_PAGE_PERMISSIONS)

    expect(new Set(keys).size).toBe(keys.length)
  })

  it('uses independent create, edit-read and pay boundaries for consumable orders', () => {
    expect(consoleRoutes.find((route) => route.path === '/accounting/consumable-orders/new')?.permissionKey)
      .toBe(PermissionKeys.ConsumableOrders.Order.Create)
    expect(consoleRoutes.find((route) => route.path === '/accounting/consumable-orders/edit/:id')?.permissionKey)
      .toBe(PermissionKeys.ConsumableOrders.Page.View)
    expect(consoleRoutes.find((route) => route.path === '/accounting/consumable-orders/pay/:id')?.permissionKey)
      .toBe(PermissionKeys.ConsumableOrders.Order.Pay)
  })

  it('uses create for the new resale route and page view for resale details', () => {
    expect(consoleRoutes.find((route) => route.path === '/resales/new')?.permissionKey)
      .toBe(PermissionKeys.Resales.Resale.Create)
    expect(consoleRoutes.find((route) => route.path === '/resales/:id')?.permissionKey)
      .toBe(PermissionKeys.Resales.Page.View)
  })

  it('uses independent Company Car create, edit and road-list route guards', () => {
    expect(consoleRoutes.find((route) => route.path === '/accounting/company-cars/new')?.permissionKey)
      .toBe(PermissionKeys.Warehouses.CompanyCars.Car.Create)
    expect(consoleRoutes.find((route) => route.path === '/accounting/company-cars/edit/:id')?.permissionKey)
      .toBe(PermissionKeys.Warehouses.CompanyCars.Car.Edit)
    expect(consoleRoutes.find((route) => route.path === '/accounting/company-cars/:id/road-lists')?.permissionKey)
      .toBe(PermissionKeys.Warehouses.CompanyCars.RoadList.Open)
  })

  it('guards the supply-to-Ukraine create route with open-arrival', () => {
    expect(consoleRoutes.find((route) => route.path === '/orders/ukraine/to-ukraine/new')?.permissionKey)
      .toBe(PermissionKeys.OrdersUkraine.Order.OpenArrival)
  })

  it('guards both available-payments route aliases with the same page right', () => {
    expect(consoleRoutes.find((route) => route.path === '/accounting/available-payments')?.permissionKey)
      .toBe(PermissionKeys.FinancialAdministration.AvailablePayments.Page.View)
    expect(consoleRoutes.find((route) => route.path === '/payments/available')?.permissionKey)
      .toBe(PermissionKeys.FinancialAdministration.AvailablePayments.Page.View)
  })

  it('guards the budget-cart route with its own page right', () => {
    expect(consoleRoutes.find((route) => route.path === '/basket-supply-ukraine-order/budget-cart')?.permissionKey)
      .toBe(PermissionKeys.SystemPages.BudgetCart.View)
  })

  it('guards procurement cockpit routes with their exact page rights', () => {
    expect(consoleRoutes.find((route) => route.path === '/basket-supply-ukraine-order/cockpit')?.permissionKey)
      .toBe(PermissionKeys.SystemPages.PurchaseCockpit.View)
    expect(consoleRoutes.find((route) => route.path === '/basket-supply-ukraine-order/dashboard')?.permissionKey)
      .toBe(PermissionKeys.SystemPages.SupplyDashboard.View)
  })

  it('uses the client-payment canonical for shop income without a duplicate right', () => {
    expect(PermissionKeys.OnlineShopPayment.IncomeOrder.Create).toBe(
      PermissionKeys.FinancialAdministration.IncomeCashflows.IncomeOrder.CreateClientPayment,
    )
  })
})

describe('console report routes', () => {
  it('registers both sales-report URLs as direct routes', () => {
    const paths = new Set(consoleRoutes.map((route) => route.path))

    expect(paths.has('/reports/sale')).toBe(true)
    expect(paths.has('/reports/sales')).toBe(true)
  })

  it('guards both sale-file aliases with one page capability', () => {
    expect(consoleRoutes.find((route) => route.path === '/reports/sale')?.permissionKey)
      .toBe(PermissionKeys.ReportsSaleFile.Page.View)
    expect(consoleRoutes.find((route) => route.path === '/reports/sales')?.permissionKey)
      .toBe(PermissionKeys.ReportsSaleFile.Page.View)
  })
})

describe('vehicle registry route', () => {
  it('registers the administration vehicle registry screen', () => {
    const paths = new Set(consoleRoutes.map((route) => route.path))

    expect(paths.has('/administration/vehicle-registry')).toBe(true)
  })
})

describe('legacy client return route', () => {
  it('redirects to the canonical order-item return workflow', () => {
    const route = consoleRoutes.find(
      (candidate) => candidate.path === '/sales/return/client',
    )

    expect(isValidElement(route?.element)).toBe(true)

    if (!isValidElement(route?.element)) {
      throw new Error(
        'Expected the legacy client return route to render a redirect',
      )
    }

    expect(route.element.type).toBe(Navigate)
    expect(route.element.props).toMatchObject({
      replace: true,
      to: '/sales/ukraine/all/returns/new',
    })
  })
})

describe('console payment article routes', () => {
  const listPaths = [
    '/accounting/payment-expense-articles',
    '/accounting/payment-cashflow-articles',
  ]
  const formPaths = listPaths.flatMap((path) => [
    `${path}/new`,
    `${path}/edit/:id`,
  ])

  it('keeps both legacy list and form URLs registered', () => {
    const paths = new Set(consoleRoutes.map((route) => route.path))

    for (const path of [...listPaths, ...formPaths]) {
      expect(paths.has(path)).toBe(true)
    }
  })

  it.each(listPaths)(
    'renders %s as the combined two-table articles screen',
    (path) => {
      const route = consoleRoutes.find((candidate) => candidate.path === path)

      expect(isValidElement(route?.element)).toBe(true)

      if (!isValidElement(route?.element)) {
        throw new Error(`Expected ${path} to render a React element`)
      }

      expect(route.element.type).toBe(PaymentArticlesPage)
    },
  )
})

describe('retired VAT register', () => {
  it('no longer exposes the Poland-only VAT report screen', () => {
    const paths = new Set(consoleRoutes.map((route) => route.path))

    expect(paths.has('/accounting/vat-reports')).toBe(false)
  })
})
