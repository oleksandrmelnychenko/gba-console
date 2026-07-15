import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../../shared/api/apiClient'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { theme } from '../../../../shared/theme/theme'
import {
  clearAllSalesPendingMutations,
  loadSalesPendingMutation,
  type SalesPendingMutationScope,
} from '../../pendingSalesMutationRegistry'
import type { SalesUkraineOrderItem, SalesUkraineProduct, SalesUkraineSale } from '../../types'

const apiMocks = vi.hoisted(() => ({
  addOrderItem: vi.fn(),
  deleteOrderItem: vi.fn(),
  getProductAvailabilityBuckets: vi.fn(),
  updateOrderItem: vi.fn(),
}))

vi.mock('../../api/salesUkraineApi', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../api/salesUkraineApi')>()

  return {
    ...original,
    addOrderItem: apiMocks.addOrderItem,
    deleteOrderItem: apiMocks.deleteOrderItem,
    updateOrderItem: apiMocks.updateOrderItem,
  }
})

vi.mock('./newSaleWizardApi', async (importOriginal) => {
  const original = await importOriginal<typeof import('./newSaleWizardApi')>()

  return {
    ...original,
    getAllProductAvailabilities: vi.fn(async () => ({ Rows: [], Total: 0 })),
    getNearestSupplyOrder: vi.fn(async () => null),
    getProductAnalogues: vi.fn(async () => []),
    getProductAvailabilityBuckets: apiMocks.getProductAvailabilityBuckets,
    getProductCalculatedPricingsByAgreement: vi.fn(async () => []),
    getProductCurrentPriceByAgreement: vi.fn(async () => null),
    getProductReservationsByAgreement: vi.fn(async () => []),
    searchSaleProductsWithAvailability: vi.fn(async () => []),
    shiftOrderItemFromSale: vi.fn(async () => null),
  }
})

vi.mock('../../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: () => true,
    session: { userNetUid: 'USER-A' },
    user: { FirstName: 'Test', LastName: 'User', NetUid: 'user-1' },
  }),
}))

vi.mock('../../../../shared/realtime/events', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../../shared/realtime/events')>()

  return {
    ...original,
    useRealtimeEvent: () => {},
  }
})

vi.mock('../../../clients/api/clientRecommendationsApi', () => ({
  getMostPurchasedProductsByClientId: vi.fn(async () => []),
}))

vi.mock('./WizardShoppingCartGrid', () => ({
  WizardShoppingCartGrid: ({
    items,
    onCrossSell,
    onRemove,
  }: {
    items: SalesUkraineOrderItem[]
    onCrossSell?: (item: SalesUkraineOrderItem) => void
    onRemove?: (item: SalesUkraineOrderItem) => void
  }) => (
    <div>
      <button disabled={!items[0] || !onCrossSell} type="button" onClick={() => items[0] && onCrossSell?.(items[0])}>
        cross sell
      </button>
      <button disabled={!items[0] || !onRemove} type="button" onClick={() => items[0] && onRemove?.(items[0])}>
        remove row
      </button>
    </div>
  ),
}))

vi.mock('./WizardCrossSellModal', () => ({
  WizardCrossSellModal: ({
    opened,
    seedProduct,
    onPick,
  }: {
    opened: boolean
    seedProduct: SalesUkraineProduct | null
    onPick: (product: SalesUkraineProduct) => void
  }) => opened && seedProduct ? (
    <button type="button" onClick={() => onPick(seedProduct)}>
      pick same product
    </button>
  ) : null,
}))

vi.mock('./ChangeQtyModal', () => ({
  ChangeQtyModal: ({ opened, onAccept }: { opened: boolean; onAccept: (qty: number, comment: string) => void }) => (
    opened ? <button type="button" onClick={() => onAccept(3, '')}>accept quantity</button> : null
  ),
}))

vi.mock('./EditShoppingCartOverlay', () => ({
  EditShoppingCartOverlay: ({ onClose }: { onClose: () => void }) => (
    <button type="button" onClick={onClose}>restore split items</button>
  ),
}))

vi.mock('./WizardConfirmModal', () => ({
  WizardConfirmModal: ({ opened, onConfirm }: { opened: boolean; onConfirm: () => void }) => (
    opened ? <button type="button" onClick={onConfirm}>confirm mutation</button> : null
  ),
}))

import { NewSaleProductsStep } from './NewSaleProductsStep'
import { initializeWizardKeyboard, setWizardKeyboardState } from './wizardKeyboard'
import {
  clearAllWizardSplitRecoveries,
  getWizardSplitOrderItems,
  getWizardSplitRecovery,
  setWizardSplitOrderItems,
} from './newSaleWizardState'
import { createWizardSplitOrderItem } from './wizardSplitSale'
import type { WizardSaleProduct } from './wizardSaleProduct'

const agreementNetId = 'agreement-1'
const scope: SalesPendingMutationScope = {
  context: `${agreementNetId}:sale-1`,
  kind: 'cart',
  userKey: 'net:user-a',
}

function createSale(qty: number = 2): SalesUkraineSale {
  const product: WizardSaleProduct = {
    AvailableQtyUk: 10,
    AvailableQtyUkReSale: 0,
    Id: 10,
    NetUid: 'product-1',
  }

  return {
    BaseLifeCycleStatus: { SaleLifeCycleType: 0 },
    ClientAgreement: { NetUid: agreementNetId },
    NetUid: 'sale-1',
    Order: {
      OrderItems: [{
        Deleted: false,
        Id: 20,
        NetUid: 'row-1',
        Product: product,
        Qty: qty,
      }],
    },
  }
}

function renderStep({
  onBusyChange = vi.fn(),
  onCartChanged = vi.fn(async () => createSale()),
  sale = createSale(),
}: {
  onBusyChange?: (busy: boolean) => void
  onCartChanged?: () => SalesUkraineSale | Promise<SalesUkraineSale>
  sale?: SalesUkraineSale
} = {}) {
  return render(
    <MantineProvider theme={theme}>
      <Notifications />
      <I18nProvider>
        <NewSaleProductsStep
          agreementNetId={agreementNetId}
          client={null}
          clientNetId="client-1"
          sale={sale}
          onBusyChange={onBusyChange}
          onCartChanged={onCartChanged}
        />
      </I18nProvider>
    </MantineProvider>,
  )
}

beforeEach(() => {
  clearAllSalesPendingMutations()
  clearAllWizardSplitRecoveries()
  initializeWizardKeyboard(1)
  setWizardKeyboardState('ProductSearch')
  apiMocks.addOrderItem.mockReset().mockResolvedValue(null)
  apiMocks.deleteOrderItem.mockReset().mockResolvedValue(null)
  apiMocks.updateOrderItem.mockReset().mockResolvedValue(null)
  apiMocks.getProductAvailabilityBuckets.mockReset().mockResolvedValue({
    AvailableQtyUk: 10,
    AvailableQtyUkReSale: 0,
  })
})

afterEach(() => {
  clearAllSalesPendingMutations()
  clearAllWizardSplitRecoveries()
})

describe('NewSaleProductsStep persistent cart mutations', () => {
  it('adds quantity atomically instead of overwriting an existing row with an absolute quantity', async () => {
    const onCartChanged = vi.fn(async () => createSale(5))
    renderStep({ onCartChanged })

    fireEvent.click(screen.getByRole('button', { name: 'cross sell' }))
    fireEvent.click(await screen.findByRole('button', { name: 'pick same product' }))
    fireEvent.click(await screen.findByRole('button', { name: 'accept quantity' }))

    await waitFor(() => expect(apiMocks.addOrderItem).toHaveBeenCalledOnce())

    expect(apiMocks.updateOrderItem).not.toHaveBeenCalled()
    expect(apiMocks.addOrderItem.mock.calls[0]?.[0]).toBe(agreementNetId)
    expect(apiMocks.addOrderItem.mock.calls[0]?.[1]).toBe('sale-1')
    expect(apiMocks.addOrderItem.mock.calls[0]?.[2]).toMatchObject({
      NetUid: '00000000-0000-0000-0000-000000000000',
      Product: { NetUid: 'product-1' },
      Qty: 3,
    })
  })

  it('retains an initial submitted 4xx until exact reconciliation succeeds', async () => {
    apiMocks.deleteOrderItem
      .mockRejectedValueOnce(new ApiError('row conflict', 400, null))
      .mockResolvedValueOnce(null)
    const onBusyChange = vi.fn()
    renderStep({ onBusyChange })

    fireEvent.click(screen.getByRole('button', { name: 'remove row' }))
    fireEvent.click(await screen.findByRole('button', { name: 'confirm mutation' }))

    await waitFor(() => expect(apiMocks.deleteOrderItem).toHaveBeenCalledOnce())
    const retry = await screen.findByRole('button', { name: 'Перевірити та повторити' })
    const pending = loadSalesPendingMutation(scope)
    const firstOperationId = apiMocks.deleteOrderItem.mock.calls[0]?.[1]?.operationId

    expect(pending).toMatchObject({ operationId: firstOperationId, phase: 'unknown' })
    expect(onBusyChange).toHaveBeenLastCalledWith(true)

    fireEvent.click(retry)

    await waitFor(() => expect(apiMocks.deleteOrderItem).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(loadSalesPendingMutation(scope)).toBe(null))
    expect(apiMocks.deleteOrderItem.mock.calls[1]?.[1]?.operationId).toBe(firstOperationId)
    expect(onBusyChange).toHaveBeenLastCalledWith(false)
  })

  it('keeps an initial 5xx retryable and reuses the persisted operation key', async () => {
    apiMocks.deleteOrderItem
      .mockRejectedValueOnce(new ApiError('response lost', 503, null))
      .mockResolvedValueOnce(null)
    const onBusyChange = vi.fn()
    const onCartChanged = vi.fn(async () => createSale())
    renderStep({ onBusyChange, onCartChanged })

    fireEvent.click(screen.getByRole('button', { name: 'remove row' }))
    fireEvent.click(await screen.findByRole('button', { name: 'confirm mutation' }))

    const retry = await screen.findByRole('button', { name: 'Перевірити та повторити' })
    const pending = loadSalesPendingMutation(scope)
    const firstOperationId = apiMocks.deleteOrderItem.mock.calls[0]?.[1]?.operationId

    expect(pending?.operationId).toBe(firstOperationId)
    expect(onBusyChange).toHaveBeenLastCalledWith(true)

    fireEvent.click(retry)

    await waitFor(() => expect(apiMocks.deleteOrderItem).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(loadSalesPendingMutation(scope)).toBe(null))

    expect(apiMocks.deleteOrderItem.mock.calls[1]?.[1]?.operationId).toBe(firstOperationId)
    expect(onBusyChange).toHaveBeenLastCalledWith(false)
  })

  it('clears the final pending operation after restored split reconciliation succeeds', async () => {
    const sale = createSale()
    const source = sale.Order?.OrderItems?.[0] as SalesUkraineOrderItem & { Product: WizardSaleProduct }
    const splitItem = createWizardSplitOrderItem(source, 1, source.Comment)
    setWizardSplitOrderItems([splitItem], agreementNetId, {
      agreementNetId,
      origin: 'ordinary',
      saleNetUid: 'sale-1',
      userKey: 'net:user-a',
    })
    const onCartChanged = vi.fn(async () => createSale(3))
    renderStep({ onCartChanged, sale })

    fireEvent.keyDown(document.body, { key: 'F2' })
    fireEvent.click(await screen.findByRole('button', { name: 'restore split items' }))

    await waitFor(() => expect(apiMocks.updateOrderItem).toHaveBeenCalledOnce())
    await waitFor(() => expect(onCartChanged).toHaveBeenCalled())

    expect(apiMocks.updateOrderItem.mock.calls[0]?.[0]).toMatchObject({ NetUid: 'row-1', Qty: 3 })
    expect(loadSalesPendingMutation(scope)).toBe(null)
  })

  it.each([
    ['acknowledged response', false],
    ['authoritative reconciliation after a lost response', true],
  ] as const)(
    'commits split extraction before clearing the cart journal after an %s',
    async (_label, loseResponse) => {
      const sale = createSale()
      const source = sale.Order?.OrderItems?.[0] as SalesUkraineOrderItem & { Product: WizardSaleProduct }
      const splitItem = createWizardSplitOrderItem(source, 1, source.Comment)
      setWizardSplitOrderItems([splitItem], agreementNetId, {
        agreementNetId,
        origin: 'ordinary',
        saleNetUid: 'sale-1',
        userKey: 'net:user-a',
      })

      if (loseResponse) {
        apiMocks.deleteOrderItem.mockRejectedValueOnce(new ApiError('response lost', 503, null))
      }

      const onCartChanged = vi.fn(async () => {
        const reconciledOperationId = apiMocks.deleteOrderItem.mock.calls[0]?.[1]?.operationId

        return loseResponse
          ? {
              ...sale,
              Order: {
                ...sale.Order,
                OrderItems: [{ ...source, Deleted: true, OperationNetUid: reconciledOperationId }],
              },
            }
          : { ...sale, Order: { ...sale.Order, OrderItems: [] } }
      })
      renderStep({ onCartChanged, sale })

      fireEvent.keyDown(document.body, { key: 'F2' })
      await screen.findByRole('button', { name: 'restore split items' })
      fireEvent.keyDown(document.body, { key: 'Delete' })
      fireEvent.click(await screen.findByRole('button', { name: 'confirm mutation' }))

      await waitFor(() => expect(apiMocks.deleteOrderItem).toHaveBeenCalledOnce())
      await waitFor(() => expect(getWizardSplitRecovery()?.pendingExtraction).toBeUndefined())

      expect(getWizardSplitOrderItems()).toEqual([
        expect.objectContaining({ Product: expect.objectContaining({ NetUid: 'product-1' }), Qty: 3 }),
      ])
      expect(loadSalesPendingMutation(scope)).toBe(null)
    },
  )

  it('retains the hidden split extraction and frozen cart journal while the outcome is unknown', async () => {
    const sale = createSale()
    const source = sale.Order?.OrderItems?.[0] as SalesUkraineOrderItem & { Product: WizardSaleProduct }
    const splitItem = createWizardSplitOrderItem(source, 1, source.Comment)
    setWizardSplitOrderItems([splitItem], agreementNetId, {
      agreementNetId,
      origin: 'ordinary',
      saleNetUid: 'sale-1',
      userKey: 'net:user-a',
    })
    apiMocks.deleteOrderItem.mockRejectedValueOnce(new ApiError('response lost', 503, null))
    renderStep({ onCartChanged: vi.fn(async () => sale), sale })

    fireEvent.keyDown(document.body, { key: 'F2' })
    await screen.findByRole('button', { name: 'restore split items' })
    fireEvent.keyDown(document.body, { key: 'Delete' })
    fireEvent.click(await screen.findByRole('button', { name: 'confirm mutation' }))

    await waitFor(() => expect(loadSalesPendingMutation(scope)?.phase).toBe('unknown'))

    expect(getWizardSplitOrderItems()).toEqual([
      expect.objectContaining({ Qty: 1 }),
    ])
    expect(getWizardSplitRecovery()).toMatchObject({
      items: [expect.objectContaining({ Qty: 3 })],
      pendingExtraction: { phase: 'unknown' },
    })
  })
})
