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
  getPaymentShopItemForRefresh,
  reconcilePaymentImageAdd,
} from '../api/paymentOnlineShopApi'
import type { PaymentShopItem, RetailClientPaymentImageItem } from '../types'
import { PaymentOnlineShopPage } from './PaymentOnlineShopPage'

const allowedPermissions = new Set<string>()
const pendingReconciliations: unknown[] = []
const paymentImage = { Amount: 5_000, Id: 11, RowVersion: 'AQIDBAUGBwg=' } as RetailClientPaymentImageItem
const payment = {
  Id: 1,
  RetailClient: { NetUid: 'retail-1' },
  RetailClientPaymentImageItems: [paymentImage],
  RetailPaymentStatus: { Amount: 5_000, PaidAmount: 0, RetailPaymentStatusType: 2 },
  Sale: {
    ClientAgreementId: 3,
    Id: 2,
    Order: { OrderItems: [], TotalAmountLocal: 7_712.36 },
    SaleNumber: { Value: 'SHOP-1' },
  },
  SaleId: 2,
} as PaymentShopItem

vi.mock('../../income-cashflows/pages/IncomeCashflowShopFormPage', () => ({
  IncomeCashflowShopDrawer: ({ searchParams, onClose, onSaved }: {
    searchParams: URLSearchParams; onClose: () => void; onSaved: () => void
  }) => <section aria-label="retail-payment">
    <span>{searchParams.toString()}</span>
    <button onClick={onClose}>close-retail</button>
    <button onClick={onSaved}>save-retail</button>
  </section>,
}))

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
  getPaymentShopItemForRefresh: vi.fn(),
  reconcilePaymentImageAdd: vi.fn(),
}))

vi.mock('../../sales-ukraine/persistentSalesMutation', () => ({
  SalesPendingMutationRecoveredError: class extends Error {},
  usePersistentSalesMutation: () => async (
    payload: unknown,
    executor: (value: unknown, operation: { operationId: string }) => Promise<unknown>,
  ) => executor(payload, { operationId: '11111111-1111-4111-8111-111111111111' }),
  usePersistentSalesMutationReconciliation: () => async () =>
    pendingReconciliations.shift() ?? null,
}))

vi.mock('../paymentImageMutation', () => ({
  classifyRetailPaymentImageMutationFailure: vi.fn(),
  createAddPaymentImageMutationPayload: vi.fn(async (payload) => ({ ...payload, file: {} })),
  ensurePaymentImageReplayFileMatches: vi.fn(),
  isDefinitiveRetailPaymentImageConcurrencyConflict: vi.fn(() => false),
  isSameAddPaymentImageMutation: vi.fn((first, second) =>
    first.paymentImageId === second.paymentImageId &&
    first.amount === second.amount &&
    first.comment === second.comment),
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

  return <><span data-testid="location">{location.pathname}</span><span data-testid="background">{location.state?.backgroundLocation?.pathname}</span></>
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
    pendingReconciliations.splice(0)
    vi.clearAllMocks()
    vi.mocked(getPaymentShopItemsPage).mockResolvedValue({ items: [payment], totalRowsQty: 1 })
    vi.mocked(addPaymentImage).mockReset().mockResolvedValue(payment)
    vi.mocked(reconcilePaymentImageAdd).mockReset()
    vi.mocked(getPaymentShopItemForRefresh).mockReset().mockResolvedValue({
      ...payment,
      RetailClientPaymentImageItems: [{ ...paymentImage, Amount: 5_061.10 }],
      RetailPaymentStatus: {
        ...payment.RetailPaymentStatus,
        Amount: 5_061.10,
        RetailPaymentStatusType: 1,
      },
      Sale: {
        ...payment.Sale,
        Order: { OrderItems: [], TotalAmountLocal: 10_061.10 },
      },
    })
  })

  async function confirmPayment() {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'open-details' }))
    fireEvent.click(screen.getByRole('button', { name: 'create-payment' }))
    await waitFor(() => expect(addPaymentImage).toHaveBeenCalledTimes(1))
  }

  function allowConfirmation(withIncome = true) {
    allowedPermissions.add(PermissionKeys.SystemPages.OnlineShopPayment.View)
    allowedPermissions.add(PermissionKeys.OnlineShopPayment.Payment.Create)
    if (withIncome) allowedPermissions.add(PermissionKeys.OnlineShopPayment.IncomeOrder.Create)
  }

  it('automatically opens an unsaved order after confirmation using refreshed payment data', async () => {
    allowConfirmation()
    await confirmPayment()
    expect(await screen.findByText('caId=3&retailClientId=retail-1&saleId=2&sum=5000')).toBeTruthy()
    expect(getPaymentShopItemForRefresh).toHaveBeenCalledWith(1, 'SHOP-1')
    expect(screen.queryByText('payment-details')).toBeNull()
    expect(screen.getByTestId('location').textContent).toBe('/accounting/payment-online-shop')
  })

  it('does not open an order when manager confirmation fails', async () => {
    allowConfirmation()
    vi.mocked(addPaymentImage).mockRejectedValue(new Error('Confirmation rejected'))
    await confirmPayment()
    await waitFor(() => expect(screen.getByText('payment-details')).toBeTruthy())
    expect(getPaymentShopItemForRefresh).not.toHaveBeenCalled()
    expect(screen.queryByRole('region', { name: 'retail-payment' })).toBeNull()
  })

  it('reconciles an older sale and still submits the currently opened payment', async () => {
    allowConfirmation(false)
    pendingReconciliations.push({
      payload: {
        amount: 25,
        comment: 'older sale',
        file: {},
        paymentImageId: 99,
        paymentType: 0,
        user: null,
      },
      result: { ...payment, Id: 99, SaleId: 100 },
      status: 'committed',
    })

    await confirmPayment()

    expect(addPaymentImage).toHaveBeenCalledTimes(1)
    expect(addPaymentImage).toHaveBeenCalledWith(
      expect.objectContaining({ paymentImageId: payment.Id }),
      expect.any(Object),
    )
    await waitFor(() =>
      expect(screen.queryByText('payment-details')).toBeNull(),
    )
  })

  it('does not report success when the server returns another payment row', async () => {
    allowConfirmation(false)
    vi.mocked(addPaymentImage).mockResolvedValue({
      ...payment,
      Id: 99,
      SaleId: 100,
    })

    await confirmPayment()

    await waitFor(() =>
      expect(screen.getByText('payment-details')).toBeTruthy(),
    )
    expect(addPaymentImage).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('region', { name: 'retail-payment' })).toBeNull()
  })

  it('does not open or fetch an order without income-order permission', async () => {
    allowConfirmation(false)
    await confirmPayment()
    await waitFor(() => expect(screen.queryByText('payment-details')).toBeNull())
    expect(getPaymentShopItemForRefresh).not.toHaveBeenCalled()
    expect(screen.queryByRole('region', { name: 'retail-payment' })).toBeNull()
  })

  it.each(['refresh failure', 'no outstanding amount', 'missing payment'])(
    'does not offer a stale order or repeat the confirmation on %s', async (scenario) => {
      allowConfirmation()
      if (scenario === 'refresh failure') vi.mocked(getPaymentShopItemForRefresh).mockRejectedValue(new Error('Offline'))
      else if (scenario === 'missing payment') vi.mocked(getPaymentShopItemForRefresh).mockResolvedValue(null)
      else vi.mocked(getPaymentShopItemForRefresh).mockResolvedValue({
        ...payment,
        RetailPaymentStatus: {
          ...payment.RetailPaymentStatus,
          PaidAmount: 2_712.36,
          RetailPaymentStatusType: 1,
        },
      })
      await confirmPayment()
      await waitFor(() => expect(getPaymentShopItemForRefresh).toHaveBeenCalledTimes(1))
      await waitFor(() => expect(screen.queryByText('payment-details')).toBeNull())
      expect(screen.queryByRole('region', { name: 'retail-payment' })).toBeNull()
      expect(addPaymentImage).toHaveBeenCalledTimes(1)
    },
  )

  it('opens the retail payment drawer over the current shop page', async () => {
    allowedPermissions.add(PermissionKeys.SystemPages.OnlineShopPayment.View)
    allowedPermissions.add(PermissionKeys.OnlineShopPayment.IncomeOrder.Create)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Новий прибутковий ордер' }))
    expect(screen.getByTestId('location').textContent).toBe('/accounting/payment-online-shop')
    expect(screen.getByText('caId=3&retailClientId=retail-1&saleId=2&sum=2712.36')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'close-retail' }))
    expect(screen.queryByRole('region', { name: 'retail-payment' })).toBeNull()
    expect(screen.getByTestId('location').textContent).toBe('/accounting/payment-online-shop')
    fireEvent.click(screen.getByRole('button', { name: 'Новий прибутковий ордер' }))
    const calls = vi.mocked(getPaymentShopItemsPage).mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'save-retail' }))
    await waitFor(() => expect(getPaymentShopItemsPage).toHaveBeenCalledTimes(calls + 1))
    expect(screen.queryByRole('region', { name: 'retail-payment' })).toBeNull()
    expect(screen.getByTestId('location').textContent).toBe('/accounting/payment-online-shop')
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
