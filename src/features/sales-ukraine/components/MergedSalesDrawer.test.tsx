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

  it('retains a restored 4xx as unknown and blocks a new current selection', async () => {
    const submission = seedPendingMergedSale()
    mocks.updateMergedSale.mockRejectedValueOnce(new ApiError('selection rejected', 400, null))
    renderDrawer()

    await screen.findByText('CURRENT-SALE')
    fireEvent.click(screen.getByRole('button', { name: 'Перевірити результат' }))

    await waitFor(() => expect(loadSalesPendingMutation(pendingScope)).toMatchObject({
      operationId: submission.operationId,
      phase: 'unknown',
      payload: submission,
    }))
    expect(screen.getByText('Потрібна звірка операції')).toBeTruthy()
    expect(mocks.updateMergedSale).toHaveBeenCalledTimes(1)

    const currentSelectionAction = screen.getByRole('button', { name: 'Створити накладну' }) as HTMLButtonElement

    expect(currentSelectionAction.disabled).toBe(true)
    fireEvent.click(currentSelectionAction)

    expect(screen.queryByRole('dialog')).toBe(null)
    expect(mocks.updateMergedSale).toHaveBeenCalledTimes(1)
  })
})
