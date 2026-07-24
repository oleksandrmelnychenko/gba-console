import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../shared/i18n/I18nProvider'
import { useNavigation } from '../navigation/hooks/useNavigation'
import type { NavigationModule } from '../navigation/types'
import { PaymentArticlesShell } from './PaymentArticlesShell'

vi.mock('../navigation/hooks/useNavigation', () => ({
  useNavigation: vi.fn(),
}))

const EXPENSE_PATH = '/accounting/payment-expense-articles'
const CASHFLOW_PATH = '/accounting/payment-cashflow-articles'

function createNavigationModules(routes: string[]): NavigationModule[] {
  return [
    {
      Id: 1,
      Module: 'Облік',
      Children: routes.map((route, index) => ({
        Id: index + 10,
        Module: route === EXPENSE_PATH ? 'Статті витрат' : 'Статті руху грошових коштів',
        Route: route,
      })),
    },
  ]
}

function mockNavigation(routes = [EXPENSE_PATH, CASHFLOW_PATH]) {
  vi.mocked(useNavigation).mockReturnValue({
    error: null,
    getNodePath: (node) => node.Route,
    isLoading: false,
    isNodeActive: () => false,
    modules: createNavigationModules(routes),
    selectedModule: null,
    selectedNode: null,
    selectModule: vi.fn(),
  })
}

function ActivePanel() {
  const location = useLocation()

  return (
    <div className="payment-articles-tab-content" data-testid="active-panel">
      {location.pathname}
    </div>
  )
}

function renderShell(initialEntry = EXPENSE_PATH) {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <PaymentArticlesShell>
            <ActivePanel />
          </PaymentArticlesShell>
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

beforeEach(() => {
  mockNavigation()
})

describe('PaymentArticlesShell', () => {
  it('keeps both article directories inside one shared shell', () => {
    const { container } = renderShell()
    const shell = container.querySelector('.payment-articles-shell__card.console-table-shell')
    const tabs = shell?.querySelector(':scope > .payment-articles-shell__tabs.pill-tabs')
    const panel = screen.getByRole('tabpanel')

    expect(shell).not.toBeNull()
    expect(container.querySelectorAll('.console-table-shell')).toHaveLength(1)
    expect(shell?.firstElementChild).toBe(tabs)
    expect(tabs?.nextElementSibling).toBe(panel)
    expect(panel.contains(screen.getByTestId('active-panel'))).toBe(true)
    expect(screen.getByRole('tab', { name: 'Статті витрат' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'Статті руху грошових коштів' }).getAttribute('aria-selected')).toBe('false')
  })

  it('selects the cashflow tab from its legacy URL', () => {
    renderShell(CASHFLOW_PATH)

    expect(screen.getByRole('tab', { name: 'Статті витрат' }).getAttribute('aria-selected')).toBe('false')
    expect(screen.getByRole('tab', { name: 'Статті руху грошових коштів' }).getAttribute('aria-selected')).toBe('true')
  })

  it('switches directories by navigating between the existing URLs', () => {
    renderShell()

    fireEvent.click(screen.getByRole('tab', { name: 'Статті руху грошових коштів' }))

    expect(screen.getByTestId('active-panel').textContent).toBe(CASHFLOW_PATH)
    expect(screen.getByRole('tab', { name: 'Статті руху грошових коштів' }).getAttribute('aria-selected')).toBe('true')
  })

  it('hides a directory that is unavailable to the current role', () => {
    mockNavigation([EXPENSE_PATH])
    renderShell()

    expect(screen.getByRole('tab', { name: 'Статті витрат' })).not.toBeNull()
    expect(screen.queryByRole('tab', { name: 'Статті руху грошових коштів' })).toBeNull()
  })
})
