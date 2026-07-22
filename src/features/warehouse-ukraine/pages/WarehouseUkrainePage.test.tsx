import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getTotalActForEditing } from '../api/shellApi'
import { WarehouseUkrainePage } from './WarehouseUkrainePage'

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))

vi.mock('../api/shellApi', () => ({
  getTotalActForEditing: vi.fn(),
}))

vi.mock('../components/SalesTab', () => ({
  SalesTab: () => (
    <div data-testid="sales-tab-content">
      <div className="app-filter-bar" data-testid="sales-filter" />
      <div className="console-table-body" data-testid="sales-table" />
    </div>
  ),
}))

vi.mock('../components/ShipmentsTab', () => ({
  ShipmentsTab: () => (
    <div data-testid="shipments-tab-content">
      <div className="app-filter-bar" data-testid="shipments-filter" />
      <div className="console-table-body" data-testid="shipments-table" />
    </div>
  ),
}))

vi.mock('../components/OrdersTab', () => ({
  OrdersTab: () => <div data-testid="orders-tab-content" />,
}))

vi.mock('../components/EditingTab', () => ({
  EditingTab: () => <div data-testid="editing-tab-content" />,
}))

vi.mock('../components/InvoiceRegisterTab', () => ({
  InvoiceRegisterTab: () => <div data-testid="invoice-register-tab-content" />,
}))

vi.mock('../components/DocumentVerificationTab', () => ({
  DocumentVerificationTab: () => <div data-testid="verification-tab-content" />,
}))

function renderPage() {
  return render(
    <MantineProvider>
      <I18nProvider>
        <WarehouseUkrainePage />
      </I18nProvider>
    </MantineProvider>,
  )
}

beforeEach(() => {
  vi.mocked(getTotalActForEditing).mockReset()
  vi.mocked(getTotalActForEditing).mockResolvedValue(0)
})

describe('WarehouseUkrainePage layout', () => {
  it('keeps the primary tabs, active filter bar, and table content inside one shared shell', () => {
    const { container } = renderPage()

    const page = container.querySelector('.warehouse-ukraine-page.console-table-page')
    const shell = page?.querySelector(':scope > .warehouse-ukraine-shell.console-table-shell')
    const tabs = shell?.querySelector(':scope > .warehouse-ukraine-tabs.pill-tabs')
    const activePanel = shell?.querySelector(':scope > .warehouse-ukraine-tab-panel')
    const filterBar = screen.getByTestId('sales-filter')
    const tableContent = screen.getByTestId('sales-table')

    expect(page).not.toBeNull()
    expect(shell).not.toBeNull()
    expect(page?.querySelectorAll('.console-table-shell')).toHaveLength(1)
    expect(shell?.firstElementChild).toBe(tabs)
    expect(tabs?.nextElementSibling).toBe(activePanel)
    expect(activePanel?.contains(filterBar)).toBe(true)
    expect(activePanel?.contains(tableContent)).toBe(true)
    expect((tabs?.compareDocumentPosition(filterBar) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect((tabs?.compareDocumentPosition(tableContent) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  })

  it('keeps the same shared wrapper when switching the primary tab', async () => {
    const { container } = renderPage()

    const shellBefore = container.querySelector('.warehouse-ukraine-page > .warehouse-ukraine-shell.console-table-shell')
    const tabsBefore = shellBefore?.querySelector(':scope > .warehouse-ukraine-tabs.pill-tabs')
    const salesFilter = screen.getByTestId('sales-filter')

    fireEvent.click(within(tabsBefore as HTMLElement).getAllByRole('button')[1])

    const shipmentsFilter = await screen.findByTestId('shipments-filter')
    const shipmentsTable = screen.getByTestId('shipments-table')
    const shellAfter = container.querySelector('.warehouse-ukraine-page > .warehouse-ukraine-shell.console-table-shell')
    const tabsAfter = shellAfter?.querySelector(':scope > .warehouse-ukraine-tabs.pill-tabs')
    const salesPanel = salesFilter.closest('.warehouse-ukraine-tab-panel') as HTMLElement | null
    const shipmentsPanel = shipmentsFilter.closest('.warehouse-ukraine-tab-panel') as HTMLElement | null

    expect(shellAfter).toBe(shellBefore)
    expect(tabsAfter).toBe(tabsBefore)
    expect(container.querySelectorAll('.warehouse-ukraine-page .console-table-shell')).toHaveLength(1)
    expect(shipmentsPanel?.contains(shipmentsTable)).toBe(true)
    expect((tabsAfter?.compareDocumentPosition(shipmentsFilter) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(salesPanel?.style.display).toBe('none')
    expect(shipmentsPanel?.style.display).toBe('')
  })
})
