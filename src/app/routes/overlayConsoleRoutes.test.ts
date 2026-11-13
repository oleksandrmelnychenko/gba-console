import { describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../shared/auth/permissionKeys'
import { consoleRoutes } from './consoleRoutes'
import { overlayConsoleRoutes } from './overlayConsoleRoutes'

vi.mock('../../features/reports/reportSurfacePolicy', () => ({ BUG_1274_ONLY_REPORT_SURFACE: true }))

describe('overlay console routes', () => {
  it('only declares screens that also exist in the main route table', () => {
    const mainPaths = new Set(consoleRoutes.map((route) => route.path))
    const orphanPaths = overlayConsoleRoutes
      .map((route) => route.path)
      .filter((path) => !mainPaths.has(path))

    expect(orphanPaths).toEqual([])
  })

  it.each(overlayConsoleRoutes.map((route) => [route.path, route.permissionKey] as const))(
    'guards %s with the same key as its main route',
    (path, permissionKey) => {
      const mainRoute = consoleRoutes.find((route) => route.path === path)

      expect(permissionKey).toBe(mainRoute?.permissionKey)
    },
  )

  // These create forms rendered for roles without the right when opened from a button.
  it.each([
    ['/clients/new', PermissionKeys.Clients.Client.Create],
    ['/accounting/income-cashflows/new/conversion',
      PermissionKeys.FinancialAdministration.IncomeCashflows.IncomeOrder.CreateOtherIncome],
    ['/accounting/income-cashflows/new/shop', PermissionKeys.OnlineShopPayment.IncomeOrder.Create],
    ['/accounting/income-cashflows/new/user',
      PermissionKeys.FinancialAdministration.IncomeCashflows.IncomeOrder.CreateColleagueReturn],
    ['/accounting/outgoing-cashflow/new', PermissionKeys.OutgoingCashflows.Order.Create],
    ['/accounting/outgoing-cashflow/new/simple', PermissionKeys.OutgoingCashflows.Order.Create],
    ['/accounting/outgoing-cashflow/new/group', PermissionKeys.OutgoingCashflows.Order.Create],
  ])('requires the create permission for the %s overlay', (path, permissionKey) => {
    const overlay = overlayConsoleRoutes.find((route) => route.path === path)

    expect(overlay?.permissionKey).toBe(permissionKey)
  })
})
