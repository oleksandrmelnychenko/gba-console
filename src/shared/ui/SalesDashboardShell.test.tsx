import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../auth/permissionKeys'
import { I18nProvider } from '../i18n/I18nProvider'
import { SalesDashboardShell } from './SalesDashboardShell'

const permissionState = vi.hoisted(() => ({ granted: new Set<string>() }))

vi.mock('../../features/auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (permissionKey: string) => permissionState.granted.has(permissionKey),
    isPermissionsLoading: false,
    permissions: Array.from(permissionState.granted),
  }),
}))

const SALES_TAB_PERMISSIONS = [
  ['Продажі', PermissionKeys.SalesUkraine.Sale.View],
  ['Оферти', PermissionKeys.SystemPages.SalesUkraineOffers.View],
  ['Резерв кошика', PermissionKeys.SystemPages.SalesUkraineCartReserve.View],
  ['Боржники', PermissionKeys.SystemPages.SalesUkraineDebtors.View],
  ['Зацікавленість', PermissionKeys.SystemPages.SalesUkraineInterest.View],
  ['Повернення', PermissionKeys.SystemPages.SalesUkraineReturns.View],
  ['Рух товару клієнта', PermissionKeys.SystemPages.SalesUkraineClientProductMovement.View],
  ['Прогноз', PermissionKeys.SystemPages.SalesUkrainePrediction.View],
  ['Графіки', PermissionKeys.SystemPages.SalesCharts.View],
  ['Resale', PermissionKeys.Resales.Page.View],
] as const

function renderShell(initialEntry = '/sales/ukraine/all') {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route
              path="*"
              element={(
                <SalesDashboardShell>
                  <div className="sales-dashboard-test-panel">
                    <div className="app-filter-bar" data-testid="sales-filter" />
                    <div data-testid="sales-content" />
                  </div>
                </SalesDashboardShell>
              )}
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('SalesDashboardShell layout', () => {
  beforeEach(() => {
    permissionState.granted = new Set(
      SALES_TAB_PERMISSIONS.map(([, permissionKey]) => permissionKey),
    )
  })

  it('keeps tabs and routed filter content inside one shared shell', () => {
    const { container } = renderShell()

    const page = container.querySelector('.sales-dashboard-shell')
    const shell = page?.querySelector(':scope > .sales-dashboard-shell__card.console-table-shell')
    const tabs = shell?.querySelector(':scope > .sales-dashboard-shell__tabs.pill-tabs')
    const content = shell?.querySelector(':scope > .sales-dashboard-shell__content')
    const filter = screen.getByTestId('sales-filter')

    expect(shell).not.toBeNull()
    expect(page?.querySelectorAll('.console-table-shell')).toHaveLength(1)
    expect(shell?.firstElementChild).toBe(tabs)
    expect(tabs?.nextElementSibling).toBe(content)
    expect(content?.contains(filter)).toBe(true)
    expect((tabs?.compareDocumentPosition(filter) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  })

  it('keeps the shared wrapper while switching sales tabs', () => {
    const { container } = renderShell()
    const shellBefore = container.querySelector('.sales-dashboard-shell__card.console-table-shell')

    fireEvent.click(screen.getByRole('button', { name: 'Оферти' }))

    const shellAfter = container.querySelector('.sales-dashboard-shell__card.console-table-shell')
    const offersTab = screen.getByRole('button', { name: 'Оферти' })

    expect(shellAfter).toBe(shellBefore)
    expect(offersTab.classList.contains('is-active')).toBe(true)
    expect(offersTab.getAttribute('aria-pressed')).toBe('true')
  })

  it.each(SALES_TAB_PERMISSIONS)(
    'shows only the independently granted %s tab',
    (label, permissionKey) => {
      permissionState.granted = new Set([permissionKey])

      renderShell()

      expect(screen.getAllByRole('button')).toHaveLength(1)
      expect(screen.getByRole('button', { name: label })).not.toBeNull()
    },
  )

  it('shows all ten tabs in the product order when every page permission is granted', () => {
    renderShell()

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(
      SALES_TAB_PERMISSIONS.map(([label]) => label),
    )
  })

  it('redirects the dashboard entry route to the first permitted tab', async () => {
    permissionState.granted = new Set([
      PermissionKeys.SystemPages.SalesUkrainePrediction.View,
    ])

    renderShell('/sales/ukraine/all')

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Прогноз' }).getAttribute('aria-pressed'),
      ).toBe('true')
    })
  })
})
