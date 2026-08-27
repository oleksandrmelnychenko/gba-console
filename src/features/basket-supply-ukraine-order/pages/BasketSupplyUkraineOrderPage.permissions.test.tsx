import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import type { BasketSale, SupplyOrderUkraineCartItem } from '../types'
import {
  getNotSentSads,
  getNotSentSaleSads,
  getNotSentSaleTaxFreePackLists,
  getNotSentTaxFreePackLists,
  getSalesForMovingToUkraine,
  getUkraineCartItems,
} from '../api/basketSupplyUkraineOrderApi'
import { BasketSupplyUkraineOrderPage } from './BasketSupplyUkraineOrderPage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: (permission: string) => allowedPermissions.has(permission),
    isLoading: false,
  }),
}))

vi.mock('../components/BudgetCartTab', () => ({
  BudgetCartTab: () => <div>Budget cart permission fixture</div>,
}))

vi.mock('../components/ProcurementConstructor', () => ({
  ProcurementConstructor: () => <div>Purchase cockpit permission fixture</div>,
}))

vi.mock('../components/ProcureDashboardTab', () => ({
  ProcureDashboardTab: () => <div>Supply dashboard permission fixture</div>,
}))

vi.mock('../api/basketSupplyUkraineOrderApi', () => ({
  addOrUpdateSad: vi.fn(),
  addOrUpdateSaleSad: vi.fn(),
  addOrUpdateSaleTaxFreePackList: vi.fn(),
  addOrUpdateTaxFreePackList: vi.fn(),
  assembleCartSadDocument: vi.fn(),
  assembleCartTaxFreeDocument: vi.fn(),
  calculateTotalsByCartItems: vi.fn().mockResolvedValue({}),
  calculateTotalsBySales: vi.fn().mockResolvedValue({}),
  getNotSentSads: vi.fn().mockResolvedValue([]),
  getNotSentSaleSads: vi.fn().mockResolvedValue([]),
  getNotSentSaleTaxFreePackLists: vi.fn().mockResolvedValue([]),
  getNotSentTaxFreePackLists: vi.fn().mockResolvedValue([]),
  getSalesForMovingToUkraine: vi.fn(),
  getUkraineCartItems: vi.fn(),
  updateUkraineCartItem: vi.fn(),
  uploadPreviewUkraineCartItemsFromFile: vi.fn(),
  uploadUkraineCartItemsFromFile: vi.fn(),
}))

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModal: ({ children, opened }: { children: ReactNode; opened: boolean }) => opened ? <section>{children}</section> : null,
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, opened, title }: { children: ReactNode; opened: boolean; title?: ReactNode }) => opened ? (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ) : null,
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: <TRow,>({
    columns,
    data,
    getRowId,
    onRowClick,
    toolbarRight,
  }: {
    columns: Array<DataTableColumn<TRow>>
    data: TRow[]
    getRowId: (row: TRow, index: number) => string
    onRowClick?: (row: TRow) => void
    toolbarRight?: ReactNode
  }) => (
    <div>
      {toolbarRight}
      {data.map((row, index) => (
        <div
          data-testid={`row-${getRowId(row, index)}`}
          key={getRowId(row, index)}
          onClick={() => onRowClick?.(row)}
        >
          {columns.map((column) => (
            <span key={column.id}>{column.cell?.(row) as ReactNode}</span>
          ))}
        </div>
      ))}
    </div>
  ),
}))

const CART_ITEM: SupplyOrderUkraineCartItem = {
  Id: 41,
  NetUid: '11111111-1111-4111-8111-111111111111',
  ProductId: 73,
  Product: { Name: 'Товар QA', VendorCode: 'QA-73' },
  ReservedQty: 12,
  AvailableQty: 20,
  UploadedQty: 5,
}

const SALE: BasketSale = {
  Id: 51,
  NetUid: '22222222-2222-4222-8222-222222222222',
  Order: { OrderItems: [{ Id: 1, Qty: 2 }] },
  SaleNumber: { Value: 'SALE-QA' },
}

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

describe('BasketSupplyUkraineOrderPage permissions', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getUkraineCartItems).mockResolvedValue([CART_ITEM])
    vi.mocked(getSalesForMovingToUkraine).mockResolvedValue([SALE])
  })

  it('does not mount the cart workflow without its page permission', () => {
    renderPage('/basket-supply-ukraine-order')

    expect(screen.getByText('Доступ заборонено')).not.toBeNull()
    expect(getUkraineCartItems).not.toHaveBeenCalled()
  })

  it('keeps import and reservation controls independent', async () => {
    allowedPermissions.add(PermissionKeys.SystemPages.SupplyCart.View)
    const view = renderPage('/basket-supply-ukraine-order')

    await waitFor(() => expect(getUkraineCartItems).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('button', { name: 'Завантажити в корзину' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Резерв' })).toBeNull()

    allowedPermissions.add(PermissionKeys.SupplyCart.File.Import)
    view.rerender(
      <MantineProvider>
        <I18nProvider>
          <MemoryRouter initialEntries={['/basket-supply-ukraine-order']}>
            <BasketSupplyUkraineOrderPage />
          </MemoryRouter>
        </I18nProvider>
      </MantineProvider>,
    )
    expect(screen.getByRole('button', { name: 'Завантажити в корзину' })).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Резерв' })).toBeNull()

    allowedPermissions.delete(PermissionKeys.SupplyCart.File.Import)
    allowedPermissions.add(PermissionKeys.SupplyCart.Item.EditReservation)
    view.rerender(
      <MantineProvider>
        <I18nProvider>
          <MemoryRouter initialEntries={['/basket-supply-ukraine-order']}>
            <BasketSupplyUkraineOrderPage />
          </MemoryRouter>
        </I18nProvider>
      </MantineProvider>,
    )
    expect(screen.queryByRole('button', { name: 'Завантажити в корзину' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Резерв' })).not.toBeNull()
  })

  it('does not load document references or expose assembly without the document permission', async () => {
    allowedPermissions.add(PermissionKeys.SystemPages.SupplyCart.View)
    const view = renderPage('/basket-supply-ukraine-order')

    await waitFor(() => expect(getUkraineCartItems).toHaveBeenCalledTimes(1))
    expect(getNotSentTaxFreePackLists).not.toHaveBeenCalled()
    expect(getNotSentSads).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Створити' })).toBeNull()

    allowedPermissions.add(PermissionKeys.SupplyCart.Document.Assemble)
    view.rerender(
      <MantineProvider>
        <I18nProvider>
          <MemoryRouter initialEntries={['/basket-supply-ukraine-order']}>
            <BasketSupplyUkraineOrderPage />
          </MemoryRouter>
        </I18nProvider>
      </MantineProvider>,
    )

    await waitFor(() => {
      expect(getNotSentTaxFreePackLists).toHaveBeenCalledTimes(1)
      expect(getNotSentSads).toHaveBeenCalledTimes(1)
    })
    expect(screen.getByRole('button', { name: 'Створити' })).not.toBeNull()
  })

  it('blocks the sales tab request without its page permission', () => {
    allowedPermissions.add(PermissionKeys.SystemPages.SupplyCart.View)
    renderPage('/basket-supply-ukraine-order/sales')

    expect(screen.getByText('Доступ заборонено')).not.toBeNull()
    expect(getSalesForMovingToUkraine).not.toHaveBeenCalled()
  })

  it('keeps sales document assembly independent from sales page access', async () => {
    allowedPermissions.add(PermissionKeys.SystemPages.SupplySales.View)
    const view = renderPage('/basket-supply-ukraine-order/sales')

    await waitFor(() => expect(getSalesForMovingToUkraine).toHaveBeenCalledTimes(1))
    expect(getNotSentSaleTaxFreePackLists).not.toHaveBeenCalled()
    expect(getNotSentSaleSads).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Створити' })).toBeNull()

    allowedPermissions.add(PermissionKeys.SupplyCart.Document.Assemble)
    view.rerender(
      <MantineProvider>
        <I18nProvider>
          <MemoryRouter initialEntries={['/basket-supply-ukraine-order/sales']}>
            <BasketSupplyUkraineOrderPage />
          </MemoryRouter>
        </I18nProvider>
      </MantineProvider>,
    )

    await waitFor(() => {
      expect(getNotSentSaleTaxFreePackLists).toHaveBeenCalledTimes(1)
      expect(getNotSentSaleSads).toHaveBeenCalledTimes(1)
    })
    expect(screen.getByRole('button', { name: 'Створити' })).not.toBeNull()
  })

  it('keeps budget-cart access independent from the supply-cart page permission', () => {
    allowedPermissions.add(PermissionKeys.SystemPages.SupplyCart.View)
    const view = renderPage('/basket-supply-ukraine-order/budget-cart')

    expect(screen.getByText('Доступ заборонено')).not.toBeNull()
    expect(screen.queryByText('Budget cart permission fixture')).toBeNull()

    allowedPermissions.clear()
    allowedPermissions.add(PermissionKeys.SystemPages.BudgetCart.View)
    view.rerender(
      <MantineProvider>
        <I18nProvider>
          <MemoryRouter initialEntries={['/basket-supply-ukraine-order/budget-cart']}>
            <BasketSupplyUkraineOrderPage />
          </MemoryRouter>
        </I18nProvider>
      </MantineProvider>,
    )

    expect(screen.getByText('Budget cart permission fixture')).not.toBeNull()
    expect(getUkraineCartItems).not.toHaveBeenCalled()
    expect(getSalesForMovingToUkraine).not.toHaveBeenCalled()
  })

  it.each([
    [
      '/basket-supply-ukraine-order/cockpit',
      PermissionKeys.SystemPages.PurchaseCockpit.View,
      'Purchase cockpit permission fixture',
    ],
    [
      '/basket-supply-ukraine-order/dashboard',
      PermissionKeys.SystemPages.SupplyDashboard.View,
      'Supply dashboard permission fixture',
    ],
  ])('keeps %s independent from supply-cart page access', (pathname, permission, marker) => {
    allowedPermissions.add(PermissionKeys.SystemPages.SupplyCart.View)
    const view = renderPage(pathname)

    expect(screen.getByText('Доступ заборонено')).not.toBeNull()
    expect(screen.queryByText(marker)).toBeNull()

    allowedPermissions.clear()
    allowedPermissions.add(permission)
    view.rerender(
      <MantineProvider>
        <I18nProvider>
          <MemoryRouter initialEntries={[pathname]}>
            <BasketSupplyUkraineOrderPage />
          </MemoryRouter>
        </I18nProvider>
      </MantineProvider>,
    )

    expect(screen.getByText(marker)).not.toBeNull()
    expect(getUkraineCartItems).not.toHaveBeenCalled()
    expect(getSalesForMovingToUkraine).not.toHaveBeenCalled()
  })

  it('opens a sale only with the independent sale-open permission', async () => {
    allowedPermissions.add(PermissionKeys.SystemPages.SupplySales.View)
    const view = renderPage('/basket-supply-ukraine-order/sales')

    await waitFor(() => expect(getSalesForMovingToUkraine).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('button', { name: 'Переглянути' })).toBeNull()
    fireEvent.click(screen.getByTestId(`row-${SALE.NetUid}`))
    expect(screen.queryByText('Фактура SALE-QA')).toBeNull()

    allowedPermissions.add(PermissionKeys.SupplySales.Sale.Open)
    view.rerender(
      <MantineProvider>
        <I18nProvider>
          <MemoryRouter initialEntries={['/basket-supply-ukraine-order/sales']}>
            <BasketSupplyUkraineOrderPage />
          </MemoryRouter>
        </I18nProvider>
      </MantineProvider>,
    )
    fireEvent.click(screen.getAllByRole('button', { name: 'Переглянути' })[0])
    expect(screen.getByText('Фактура SALE-QA')).not.toBeNull()
  })
})
