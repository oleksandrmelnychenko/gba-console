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
  '/service/organisations':
    PermissionKeys.SystemPages.ServiceOrganisations.View,
  '/sad/all': PermissionKeys.SystemPages.Sad.View,
  '/tax-free/carriers/all': PermissionKeys.SystemPages.TaxFreeCarriers.View,
  '/tax-free/all': PermissionKeys.SystemPages.TaxFreeDocuments.View,
  '/tax-free/pack-list/all': PermissionKeys.SystemPages.TaxFreePackLists.View,
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
})

describe('console report routes', () => {
  it('registers both sales-report URLs as direct routes', () => {
    const paths = new Set(consoleRoutes.map((route) => route.path))

    expect(paths.has('/reports/sale')).toBe(true)
    expect(paths.has('/reports/sales')).toBe(true)
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
