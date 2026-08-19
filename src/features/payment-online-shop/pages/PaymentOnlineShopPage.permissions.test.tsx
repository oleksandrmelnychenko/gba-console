import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  addPaymentImage,
  editPaymentImage,
  getPaymentShopItemsPage,
} from '../api/paymentOnlineShopApi'
import type { PaymentShopItem, RetailClientPaymentImageItem } from '../types'
import { PaymentOnlineShopPage } from './PaymentOnlineShopPage'

const allowedPermissions = new Set<string>()
const paymentImage = { Id: 11, RowVersion: 'AQIDBAUGBwg=' } as RetailClientPaymentImageItem
const payment = {
  Id: 1,
  RetailClient: { NetUid: 'retail-1' },
  RetailClientPaymentImageItems: [paymentImage],
  RetailPaymentStatus: { AmountToPay: 100, RetailPaymentStatusType: 2 },
  Sale: {
    ClientAgreementId: 3,
    Id: 2,
    Order: { OrderItems: [] },
    SaleNumber: { Value: 'SHOP-1' },
  },
  SaleId: 2,
} as PaymentShopItem

vi.mock('../../auth/components/PermissionGate', () => ({
  PermissionGate: ({ children, fallback = null, permissionKey }: {
    children: ReactNode
    fallback?: ReactNode
    permissionKey: string
  }) => allowedPermissions.has(permissionKey) ? children : fallback,
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (permission: string) => allowedPermissions.has(permission),
    user: { Id: 7 },
  }),
}))

vi.mock('../api/paymentOnlineShopApi', () => ({
  addPaymentImage: vi.fn(),
  editPaymentImage: vi.fn(),
  getPaymentShopItemsPage: vi.fn(),
}))

vi.mock('../../sales-ukraine/persistentSalesMutation', () => ({
  SalesPendingMutationRecoveredError: class extends Error {},
  usePersistentSalesMutation: () => async (
    payload: unknown,
    executor: (value: unknown, operation: { operationId: string }) => Promise<unknown>,
  ) => executor(payload, { operationId: '11111111-1111-4111-8111-111111111111' }),
}))

vi.mock('../paymentImageMutation', () => ({
  classifyRetailPaymentImageMutationFailure: vi.fn(),
  createAddPaymentImageMutationPayload: vi.fn(async (payload) => ({ ...payload, file: {} })),
  ensurePaymentImageReplayFileMatches: vi.fn(),
  isDefinitiveRetailPaymentImageConcurrencyConflict: vi.fn(() => false),
}))

vi.mock('../components/PaymentShopDetailDrawer', () => ({
  PaymentShopDetailDrawer: ({
    canCreatePayment,
    canEditPayment,
    item,
    onAddPayment,
    onEditItem,
  }: {
    canCreatePayment: boolean
    canEditPayment: boolean
    item: PaymentShopItem | null
    onAddPayment: (payload: unknown) => Promise<boolean>
    onEditItem: (item: RetailClientPaymentImageItem) => void
  }) => item ? (
    <section>
      <span>payment-details</span>
      {canCreatePayment && (
        <button type="button" onClick={() => void onAddPayment({ image: new File(['x'], 'x.png') })}>
          create-payment
        </button>
      )}
      {canEditPayment && (
        <button type="button" onClick={() => onEditItem(paymentImage)}>
          edit-payment
        </button>
      )}
    </section>
  ) : null,
}))

vi.mock('../components/PaymentImageEditModal', () => ({
  PaymentImageEditModal: ({ item, onConfirm }: {
    item: RetailClientPaymentImageItem | null
    onConfirm: (amount: number, comment: string) => void
  }) => item ? (
    <button type="button" onClick={() => onConfirm(100, 'edit')}>confirm-edit</button>
  ) : null,
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({ columns, data, onRowClick, tableId }: {
    columns: Array<{ cell?: (item: PaymentShopItem) => ReactNode; id: string }>
    data: PaymentShopItem[]
    onRowClick?: (item: PaymentShopItem) => void
    tableId: string
  }) => (
    <div data-testid={tableId}>
      {data[0] && onRowClick && (
        <button type="button" onClick={() => onRowClick(data[0])}>open-details</button>
      )}
      {data[0] && columns.find((column) => column.id === 'incomeCashOrder')?.cell?.(data[0])}
    </div>
  ),
}))

vi.mock('../../../shared/ui/paginator/Paginator', () => ({ Paginator: () => null }))

function LocationProbe() {
  const location = useLocation()

  return <span data-testid="location">{location.pathname}</span>
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/accounting/payment-online-shop']}>
      <MantineProvider>
        <I18nProvider>
          <PaymentOnlineShopPage />
          <LocationProbe />
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

describe('Payment online shop canonical permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getPaymentShopItemsPage).mockResolvedValue({ items: [payment], totalRowsQty: 1 })
  })

  it('does not mount the registry without page.view', () => {
    renderPage()

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getPaymentShopItemsPage).not.toHaveBeenCalled()
  })

  it('keeps details page-scoped and hides all mutations with page access alone', async () => {
    allowedPermissions.add(PermissionKeys.SystemPages.OnlineShopPayment.View)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'open-details' }))
    expect(screen.getByText('payment-details')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'create-payment' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'edit-payment' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Новий прибутковий ордер' })).toBeNull()
  })

  it('rechecks create, edit and income-order rights after controls render', async () => {
    allowedPermissions.add(PermissionKeys.SystemPages.OnlineShopPayment.View)
    allowedPermissions.add(PermissionKeys.OnlineShopPayment.Payment.Create)
    allowedPermissions.add(PermissionKeys.OnlineShopPayment.Payment.Edit)
    allowedPermissions.add(PermissionKeys.OnlineShopPayment.IncomeOrder.Create)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'open-details' }))
    const createButton = screen.getByRole('button', { name: 'create-payment' })
    const editButton = screen.getByRole('button', { name: 'edit-payment' })
    const incomeButton = screen.getByRole('button', { name: 'Новий прибутковий ордер' })

    allowedPermissions.delete(PermissionKeys.OnlineShopPayment.Payment.Create)
    fireEvent.click(createButton)
    expect(addPaymentImage).not.toHaveBeenCalled()

    fireEvent.click(editButton)
    const confirmEdit = await screen.findByRole('button', { name: 'confirm-edit' })
    allowedPermissions.delete(PermissionKeys.OnlineShopPayment.Payment.Edit)
    fireEvent.click(confirmEdit)
    expect(editPaymentImage).not.toHaveBeenCalled()

    allowedPermissions.delete(PermissionKeys.OnlineShopPayment.IncomeOrder.Create)
    fireEvent.click(incomeButton)
    await waitFor(() =>
      expect(screen.getByTestId('location').textContent)
        .toBe('/accounting/payment-online-shop'),
    )
  })
})
