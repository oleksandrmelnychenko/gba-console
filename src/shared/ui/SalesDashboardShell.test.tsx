import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'
import { SalesDashboardShell } from './SalesDashboardShell'

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
})
