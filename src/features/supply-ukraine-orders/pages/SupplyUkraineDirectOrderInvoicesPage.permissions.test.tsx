import { DEFAULT_THEME, MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getProductForOrderInvoices } from '../../products/api/productsApi'
import {
  deleteSupplyInvoice,
  getDirectSupplyOrderForInvoices,
  getSupplyInvoiceItemsForDirectOrder,
  getSupplyOrderInvoiceTotalsForInvoices,
  getSupplyOrderItemsForInvoices,
} from '../api/supplyUkraineOrdersApi'
import { SupplyUkraineDirectOrderInvoicesPage } from './SupplyUkraineDirectOrderInvoicesPage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (permission: string) => allowedPermissions.has(permission),
  }),
}))

vi.mock('../../products/api/productsApi', () => ({
  getProductForOrderInvoices: vi.fn(),
}))

vi.mock('../../products/components/ProductCardModal', () => ({
  ProductCardModal: ({
    loadProduct,
    productNetId,
  }: {
    loadProduct: typeof getProductForOrderInvoices
    productNetId: string | null
  }) => productNetId ? (
    <output data-loader={loadProduct === getProductForOrderInvoices ? 'scoped' : 'legacy'}>
      {productNetId}
    </output>
  ) : null,
}))

vi.mock('../api/supplyUkraineOrdersApi', () => ({
  deleteDirectSupplyOrderInvoiceDocument: vi.fn(),
  deletePackingList: vi.fn(),
  deleteSupplyInvoice: vi.fn(),
  getDirectSupplyOrderForInvoices: vi.fn(),
  getDirectSupplyOrderInvoiceInformationProtocolKeys: vi.fn(async () => []),
  getDirectSupplyOrderInvoicePaymentProtocolKeys: vi.fn(async () => []),
  getDirectSupplyOrderInvoiceResponsibleUsers: vi.fn(async () => []),
  getSupplyInvoiceItemsForDirectOrder: vi.fn(),
  getSupplyOrderInvoiceTotalsForInvoices: vi.fn(),
  getSupplyOrderItemsForInvoices: vi.fn(),
  updateDirectSupplyOrderInvoice: vi.fn(),
  updateDirectSupplyOrderInvoiceItems: vi.fn(),
  updateDirectSupplyOrderPackingLists: vi.fn(),
  uploadDirectSupplyOrderInvoiceDocuments: vi.fn(),
  uploadPackingListDocuments: vi.fn(),
  uploadPackingListFile: vi.fn(),
  uploadSupplyInvoiceFile: vi.fn(),
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, opened }: { children: ReactNode; opened: boolean }) =>
    opened ? <section className="app-drawer">{children}</section> : null,
}))

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModalFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AppModal: ({ children, opened }: { children: ReactNode; opened: boolean }) =>
    opened ? <section>{children}</section> : null,
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({
    columns,
    data,
    tableId,
  }: {
    columns: Array<{ cell?: (item: unknown) => ReactNode; id: string }>
    data: Array<{ Qty?: number }>
    tableId: string
  }) => (
    <section data-testid={tableId} data-row-count={data.length} data-quantities={JSON.stringify(data.map((item) => item.Qty))}>
      {data.flatMap((item, rowIndex) => columns.map((column) => (
        <span key={`${rowIndex}-${column.id}`}>{column.cell?.(item)}</span>
      )))}
    </section>
  ),
}))

vi.mock('../../../shared/ui/table-row-action', () => ({
  TableRowAction: ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button type="button" onClick={onClick}>{label}</button>
  ),
}))

const ORDER = {
  NetUid: 'order-1',
  SupplyProForm: { Id: 1, Number: 'PF-1' },
  SupplyProFormId: 1,
  SupplyInvoices: [{
    NetUid: 'invoice-1',
    Number: 'INV-1',
    PackingLists: [],
  }],
}

const INVOICE = {
  NetUid: 'invoice-1',
  Number: 'INV-1',
  PackingLists: [],
  SupplyInvoiceOrderItems: [],
}

const ORDER_ITEM = {
  NetUid: 'order-item-1',
  Product: {
    Name: 'Product 1',
    NetUid: 'product-1',
    VendorCode: 'P-1',
  },
  Qty: 1,
}

function renderPage() {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={['/orders/ukraine/all/edit/order-1/supply-invoices']}>
          <Routes>
            <Route
              path="/orders/ukraine/all/edit/:id/supply-invoices"
              element={<SupplyUkraineDirectOrderInvoicesPage />}
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('Supply Ukraine direct-order invoice permissions', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getDirectSupplyOrderForInvoices).mockResolvedValue(ORDER)
    vi.mocked(getSupplyOrderItemsForInvoices).mockResolvedValue([ORDER_ITEM])
    vi.mocked(getSupplyOrderInvoiceTotalsForInvoices).mockResolvedValue({})
    vi.mocked(getSupplyInvoiceItemsForDirectOrder).mockResolvedValue(INVOICE)
  })

  function renderReportedInvoices() {
    allowedPermissions.add(PermissionKeys.OrdersUkraine.Order.OpenProducts)
    const invoices = [
      {
        NetUid: '2a27f6ff-e661-4bdf-9a18-dcd37cd55d5b',
        Number: '9991',
        DateFrom: '2026-10-28T11:32:00',
        codes: ['900252-AL', '900254-AL', '900260-AL', '990038-AL', '990148-AL'],
        quantities: [40, 30, 70, 8, 6],
      },
      {
        NetUid: 'ca26d95f-5a71-4d83-98b8-af753fc8fb0a',
        Number: '99992222',
        DateFrom: '2026-10-28T15:14:00',
        codes: ['990155-AL', '990550-AL', '990554-AL', '990560-AL', '990911-AL', '900254-AL', '900253-AL', '990038-AL', '990560-AL', '990554-AL'],
        quantities: [25, 30, 25, 45, 6, 100, 100, 15, 25, 10],
      },
    ].map(({ codes, quantities, ...invoice }) => ({
      ...invoice,
      SupplyOrganizationAgreement: { Currency: { Code: 'EUR' } },
      SupplyInvoiceOrderItems: codes.map((code, index) => ({
        NetUid: `${invoice.NetUid}-${index}`,
        Product: { NetUid: code, VendorCode: code, Name: code },
        Qty: quantities[index],
      })),
    }))
    vi.mocked(getDirectSupplyOrderForInvoices).mockResolvedValue({ ...ORDER, SupplyInvoices: invoices })
    vi.mocked(getSupplyInvoiceItemsForDirectOrder).mockImplementation(async (netId) => invoices.find((invoice) => invoice.NetUid === netId) || null)
    return renderPage()
  }

  it('gives both reported invoice selectors visible button surfaces and a distinct selected state', async () => {
    renderReportedInvoices()
    fireEvent.click(await screen.findByRole('tab', { name: 'Інвойси' }))
    const selected = await screen.findByRole('button', { name: /9991/ })
    const unselected = screen.getByRole('button', { name: /99992222/ })
    const { readFileSync } = await vi.importActual<{ readFileSync: (path: string, encoding: string) => string }>('node:fs')
    const styles = document.createElement('style')
    styles.textContent = (readFileSync('src/shared/ui/sheet-surfaces.css', 'utf8')
      + readFileSync('src/features/supply-ukraine-orders/pages/supply-order-invoices.css', 'utf8')
      + readFileSync('src/shared/ui/selection-surface.css', 'utf8'))
      .replace(/var\(--mantine-color-(gray|orange)-(\d)\)/g, (_, color: string, shade: string) => DEFAULT_THEME.colors[color][Number(shade)])
    document.head.append(styles)
    try {
      for (const button of [selected, unselected]) {
        const style = getComputedStyle(button)
        expect(style.borderTopStyle).toBe('solid')
        expect(style.borderTopColor).not.toBe('transparent')
        expect(style.borderTopColor).not.toBe('rgba(0, 0, 0, 0)')
        expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
        expect(button.getAttribute('type')).toBe('button')
        expect(button.textContent).toMatch(/28\.10\.(?:20)?26/)
        expect(button.textContent).toContain('EUR')
      }
      expect(getComputedStyle(selected).backgroundColor).not.toBe(getComputedStyle(unselected).backgroundColor)
      expect(selected.getAttribute('aria-pressed')).toBe('true')
      expect(unselected.getAttribute('aria-pressed')).toBe('false')
    } finally {
      styles.remove()
    }
  })

  it('switches between the reported invoices and preserves their own rows and selection state', async () => {
    renderReportedInvoices()
    fireEvent.click(await screen.findByRole('tab', { name: 'Інвойси' }))
    const first = await screen.findByRole('button', { name: /9991/ })
    const second = screen.getByRole('button', { name: /99992222/ })
    const table = () => screen.getByTestId('supply-direct-invoice-items')
    expect(table().getAttribute('data-row-count')).toBe('5')
    expect(JSON.parse(table().getAttribute('data-quantities')!)).toEqual([40, 30, 70, 8, 6])
    expect(within(table()).getAllByRole('button', { name: '900252-AL' }).length).toBeGreaterThan(0)
    fireEvent.click(second)
    await waitFor(() => expect(table().getAttribute('data-row-count')).toBe('10'))
    expect(JSON.parse(table().getAttribute('data-quantities')!)).toEqual([25, 30, 25, 45, 6, 100, 100, 15, 25, 10])
    expect(getSupplyInvoiceItemsForDirectOrder).toHaveBeenLastCalledWith('ca26d95f-5a71-4d83-98b8-af753fc8fb0a')
    expect(within(table()).queryByRole('button', { name: '900252-AL' })).toBeNull()
    expect(second.getAttribute('aria-pressed')).toBe('true')
    expect(first.getAttribute('aria-pressed')).toBe('false')
    await waitFor(() => expect(first.hasAttribute('disabled')).toBe(false))
    fireEvent.click(first)
    await waitFor(() => expect(table().getAttribute('data-row-count')).toBe('5'))
    expect(getSupplyInvoiceItemsForDirectOrder).toHaveBeenLastCalledWith('2a27f6ff-e661-4bdf-9a18-dcd37cd55d5b')
    expect(first.getAttribute('aria-pressed')).toBe('true')
  })

  it('does not mount the model or call APIs without invoice-page access', () => {
    renderPage()

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getDirectSupplyOrderForInvoices).not.toHaveBeenCalled()
  })

  it('opens a product card with the permission-scoped loader', async () => {
    allowedPermissions.add(PermissionKeys.OrdersUkraine.Order.OpenProducts)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'P-1' }))

    const productCard = screen.getByText('product-1')
    expect(productCard.getAttribute('data-loader')).toBe('scoped')
  })

  it('rechecks invoice-delete permission at the final confirmation boundary', async () => {
    allowedPermissions.add(PermissionKeys.OrdersUkraine.Order.OpenProducts)
    allowedPermissions.add(PermissionKeys.OrdersUkraine.Invoice.Delete)
    renderPage()

    fireEvent.click(await screen.findByRole('tab', { name: 'Інвойси' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Видалити' }))
    allowedPermissions.delete(PermissionKeys.OrdersUkraine.Invoice.Delete)

    const deleteButtons = await screen.findAllByRole('button', { name: 'Видалити' })
    fireEvent.click(deleteButtons.at(-1)!)

    await waitFor(() => expect(deleteSupplyInvoice).not.toHaveBeenCalled())
  })
})
