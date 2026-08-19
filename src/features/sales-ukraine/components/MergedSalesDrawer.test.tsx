import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/apiClient'
import { theme } from '../../../shared/theme/theme'
import {
  clearAllSalesPendingMutations,
  loadSalesPendingMutation,
  saveSalesPendingMutation,
  type SalesPendingMutationScope,
} from '../pendingSalesMutationRegistry'
import type { SalesUkraineSale } from '../types'
import { MergedSalesDrawer } from './MergedSalesDrawer'
import { createWizardMergedSaleSubmission } from './new-sale-wizard/wizardMergedSubmit'

const mocks = vi.hoisted(() => ({
  getCurrentUnmergedSale: vi.fn(),
  getMergedSales: vi.fn(),
  notificationsShow: vi.fn(),
  translate: (key: string) => key,
  updateMergedSale: vi.fn(),
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ session: { userNetUid: 'USER-A' } }),
}))

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: mocks.translate }),
}))

vi.mock('@mantine/notifications', () => ({
  notifications: { show: mocks.notificationsShow },
}))

vi.mock('../api/salesUkraineApi', () => ({
  getCurrentUnmergedSale: mocks.getCurrentUnmergedSale,
  getMergedSales: mocks.getMergedSales,
  updateMergedSale: mocks.updateMergedSale,
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, opened }: { children: React.ReactNode; opened: boolean }) => opened ? <div>{children}</div> : null,
}))

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModal: ({ children, opened }: { children: React.ReactNode; opened: boolean }) => opened ? <div role="dialog">{children}</div> : null,
}))

const pendingScope: SalesPendingMutationScope = {
  context: 'merged-drawer:merge-root',
  kind: 'merged-sale',
  userKey: 'net:user-a',
}

const currentMergedSale: SalesUkraineSale = {
  InputSaleMerges: [
    {
      InputSale: {
        ClientAgreement: {
          Agreement: { Currency: { Code: 'UAH' } },
          Client: { FullName: 'Current Client', NetUid: 'current-client' },
        },
        NetUid: 'current-sale',
        Order: {
          OrderItems: [
            {
              NetUid: 'current-item',
              Product: { NameUA: 'Current product', VendorCode: 'CURRENT' },
              Qty: 1,
              TotalAmountLocal: 100,
            },
          ],
        },
        SaleNumber: { Value: 'CURRENT-SALE' },
      },
    },
  ],
  NetUid: 'merge-root',
}

function seedPendingMergedSale() {
  const operationId = '22222222-2222-4222-8222-222222222222'
  const submission = createWizardMergedSaleSubmission(
    {
      Comment: 'frozen restored selection',
      NetUid: 'restored-sale',
      Order: { OrderItems: [{ NetUid: 'restored-item', Qty: 2 }] },
    },
    operationId,
  )

  saveSalesPendingMutation(pendingScope, operationId, submission)

  return submission
}

function renderDrawer(onChanged = vi.fn()) {
  return {
    ...render(
      <MantineProvider theme={theme}>
        <MergedSalesDrawer
          canCreateInvoice
          canEdit
          saleNetId="merge-root"
          onChanged={onChanged}
          onClose={vi.fn()}
        />
      </MantineProvider>,
    ),
    onChanged,
  }
}

describe('MergedSalesDrawer restored reconciliation', () => {
  beforeAll(() => {
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    })
  })

  beforeEach(() => {
    clearAllSalesPendingMutations()
    vi.clearAllMocks()
    mocks.getMergedSales.mockResolvedValue(currentMergedSale)
    mocks.updateMergedSale.mockResolvedValue(undefined)
  })

  it('keeps merged create and edit controls independently unavailable without their keys', async () => {
    const protectedRequest = vi.fn()

    render(
      <MantineProvider theme={theme}>
        <MergedSalesDrawer
          canCreateInvoice={false}
          canEdit={false}
          saleNetId="merge-root"
          submitMergedSale={protectedRequest}
          onChanged={vi.fn()}
          onClose={vi.fn()}
          onCreateNewSale={vi.fn()}
          onEditSale={vi.fn()}
          onInvoice={vi.fn()}
        />
      </MantineProvider>,
    )

    await screen.findByText('CURRENT-SALE')
    expect(screen.queryByRole('button', { name: 'Створити накладну' })).toBe(null)
    expect(screen.queryByRole('button', { name: 'Редагувати' })).toBe(null)
    expect(screen.queryByText('Створити новий рахунок головному клієнту')).toBe(null)
    expect(protectedRequest).not.toHaveBeenCalled()
  })

  it('loads permission-scoped merged reads without calling shared helpers', async () => {
    const loadMergedSale = vi.fn().mockResolvedValue(currentMergedSale)
    const loadCurrentUnmergedSale = vi.fn().mockResolvedValue(null)

    render(
      <MantineProvider theme={theme}>
        <MergedSalesDrawer
          canCreateInvoice
          canEdit
          clientAgreementNetId="agreement-1"
          loadCurrentUnmergedSale={loadCurrentUnmergedSale}
          loadMergedSale={loadMergedSale}
          saleNetId="merge-root"
          onChanged={vi.fn()}
          onClose={vi.fn()}
          onCreateNewSale={vi.fn()}
        />
      </MantineProvider>,
    )

    await screen.findByText('CURRENT-SALE')
    await waitFor(() => expect(loadCurrentUnmergedSale).toHaveBeenCalledWith('agreement-1'))
    expect(loadMergedSale).toHaveBeenCalledWith('merge-root')
    expect(mocks.getMergedSales).not.toHaveBeenCalled()
    expect(mocks.getCurrentUnmergedSale).not.toHaveBeenCalled()
  })

  it('does not replay a stored merged create after create permission is revoked', async () => {
    seedPendingMergedSale()
    const protectedRequest = vi.fn()

    render(
      <MantineProvider theme={theme}>
        <MergedSalesDrawer
          canCreateInvoice={false}
          canEdit={false}
          saleNetId="merge-root"
          submitMergedSale={protectedRequest}
          onChanged={vi.fn()}
          onClose={vi.fn()}
        />
      </MantineProvider>,
    )

    await screen.findByText('CURRENT-SALE')
    expect(screen.queryByText('Потрібна звірка операції')).toBe(null)
    expect(screen.queryByRole('button', { name: 'Перевірити результат' })).toBe(null)
    expect(protectedRequest).not.toHaveBeenCalled()
    expect(loadSalesPendingMutation(pendingScope)?.operationId).toBeTruthy()
  })

  it('keeps the restored warning visible through loading and replays only the frozen selection', async () => {
    const submission = seedPendingMergedSale()
    let resolveLoad: ((value: SalesUkraineSale) => void) | null = null
    mocks.getMergedSales.mockImplementationOnce(() => new Promise((resolve) => {
      resolveLoad = resolve
    }))
    const { onChanged } = renderDrawer()

    expect(await screen.findByText('Потрібна звірка операції')).toBeTruthy()

    await act(async () => {
      resolveLoad?.(currentMergedSale)
    })

    await screen.findByText('CURRENT-SALE')
    expect(screen.getByText('Потрібна звірка операції')).toBeTruthy()

    const currentSelectionAction = screen.getByRole('button', { name: 'Створити накладну' }) as HTMLButtonElement

    expect(currentSelectionAction.disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Перевірити результат' }))

    await waitFor(() => expect(mocks.updateMergedSale).toHaveBeenCalledTimes(1))
    expect(mocks.updateMergedSale.mock.calls[0]?.[0]).toEqual(submission.payload)
    expect(mocks.updateMergedSale.mock.calls[0]?.[1]).toEqual({ operationId: submission.operationId })
    await waitFor(() => expect(screen.queryByText('Потрібна звірка операції')).toBe(null))
    expect(onChanged).toHaveBeenCalledTimes(1)
    expect(loadSalesPendingMutation(pendingScope)).toBe(null)
  })

  it('settles a restored 4xx as a known rejection and exposes the server message', async () => {
    seedPendingMergedSale()
    mocks.updateMergedSale.mockRejectedValueOnce(new ApiError(
      'selection rejected',
      400,
      { MutationLedgerState: 'not-entered' },
    ))
    renderDrawer()

    await screen.findByText('CURRENT-SALE')
    fireEvent.click(screen.getByRole('button', { name: 'Перевірити результат' }))

    await waitFor(() => expect(loadSalesPendingMutation(pendingScope)).toBe(null))
    expect(screen.queryByText('Потрібна звірка операції')).toBe(null)
    expect(mocks.updateMergedSale).toHaveBeenCalledTimes(1)
    expect(mocks.notificationsShow).toHaveBeenCalledWith({
      color: 'red',
      message: 'selection rejected',
    })

    const currentSelectionAction = screen.getByRole('button', { name: 'Створити накладну' }) as HTMLButtonElement

    expect(currentSelectionAction.disabled).toBe(false)
  })

  it.each([
    [
      [{ NetUid: '', Product: { VendorCode: 'A' }, Qty: 1 }],
      'Обʼєднання неможливе: позиція не має збереженого ідентифікатора',
    ],
    [
      [
        { NetUid: 'duplicate-item', Product: { VendorCode: 'A' }, Qty: 1 },
        { NetUid: 'DUPLICATE-ITEM', Product: { VendorCode: 'B' }, Qty: 1 },
      ],
      'Обʼєднання неможливе: одна позиція передана двічі',
    ],
  ])('blocks invalid merged order items before the API call', async (orderItems, message) => {
    mocks.getMergedSales.mockResolvedValueOnce({
      ...currentMergedSale,
      InputSaleMerges: [{
        InputSale: {
          ...currentMergedSale.InputSaleMerges?.[0]?.InputSale,
          Order: { OrderItems: orderItems },
        },
      }],
    })
    renderDrawer()

    await screen.findByText('CURRENT-SALE')
    fireEvent.click(screen.getByRole('button', { name: 'Створити накладну' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Зробити рахунок' }))

    await waitFor(() => expect(mocks.notificationsShow).toHaveBeenCalledWith({
      color: 'red',
      message,
    }))
    expect(mocks.updateMergedSale).not.toHaveBeenCalled()
  })
})
