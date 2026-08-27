import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
    opened ? <section>{children}</section> : null,
}))

vi.mock('../../../shared/ui/AppModal', () => ({
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
    data: unknown[]
    tableId: string
  }) => (
    <section data-testid={tableId}>
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
