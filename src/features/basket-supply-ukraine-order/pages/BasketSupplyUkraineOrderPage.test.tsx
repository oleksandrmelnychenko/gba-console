import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { BasketSupplyUkraineOrderPage } from './BasketSupplyUkraineOrderPage'

vi.mock('../components/ProcurementConstructor', () => ({
  ProcurementConstructor: () => (
    <div className="procure-cockpit" data-testid="procurement-constructor">
      <div className="app-data-card basket-supply-primary-card">
        <div className="app-filter-bar" data-testid="active-filter" />
      </div>
    </div>
  ),
}))

function renderPage(pathname: string) {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={[pathname]}>
          <BasketSupplyUkraineOrderPage />
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('BasketSupplyUkraineOrderPage shell', () => {
  it.each(['/recommendations', '/basket-supply-ukraine-order/recommendations'])(
    'keeps the recommendations alias on the visible constructor tab at %s',
    (pathname) => {
      const { container } = renderPage(pathname)

      const shell = container.querySelector('.basket-supply-page > .basket-supply-shell.app-data-card')
      const tabs = shell?.querySelector(':scope > .basket-supply-tabs.pill-tabs')
      const content = shell?.querySelector(':scope > .basket-supply-tab-content')
      const activeTabs = tabs?.querySelectorAll('.pill-tab.is-active')
      const activeFilter = screen.getByTestId('active-filter')

      expect(shell).not.toBeNull()
      expect(shell?.firstElementChild).toBe(tabs)
      expect(tabs?.nextElementSibling).toBe(content)
      expect(activeTabs).toHaveLength(1)
      expect(activeTabs?.[0]?.getAttribute('aria-pressed')).toBe('true')
      expect(activeTabs?.[0]?.textContent).toContain('Конструктор закупівель')
      expect(content?.contains(activeFilter)).toBe(true)
      expect((tabs?.compareDocumentPosition(activeFilter) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    },
  )
})
