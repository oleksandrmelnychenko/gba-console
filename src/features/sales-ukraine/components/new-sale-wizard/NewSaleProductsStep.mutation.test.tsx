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
  saveSalesPendingMutation,
  type SalesPendingMutationScope,
} from '../../pendingSalesMutationRegistry'
import type { SalesUkraineOrderItem, SalesUkraineProduct, SalesUkraineSale } from '../../types'

const apiMocks = vi.hoisted(() => ({
  acceptedQty: 3,
  addOrderItem: vi.fn(),
  deleteOrderItem: vi.fn(),
  getProductAvailabilityBuckets: vi.fn(),
  searchSaleProductsWithAvailability: vi.fn(),
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
    searchSaleProductsWithAvailability: apiMocks.searchSaleProductsWithAvailability,
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
    opened ? <button type="button" onClick={() => onAccept(apiMocks.acceptedQty, '')}>accept quantity</button> : null
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
import { createPersistedWizardCartMutation } from './wizardCartMutation'

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
  onPendingMutationChange = vi.fn(),
  sale = createSale(),
}: {
  onBusyChange?: (busy: boolean) => void
  onCartChanged?: () => SalesUkraineSale | Promise<SalesUkraineSale>
  onPendingMutationChange?: (pending: boolean) => void
  sale?: SalesUkraineSale
} = {}) {
  return render(
    <MantineProvider theme={theme}>
      <Notifications autoClose={false} />
      <I18nProvider>
        <NewSaleProductsStep
          agreementNetId={agreementNetId}
          client={null}
          clientNetId="client-1"
          sale={sale}
          onBusyChange={onBusyChange}
          onCartChanged={onCartChanged}
          onPendingMutationChange={onPendingMutationChange}
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
  apiMocks.acceptedQty = 3
  apiMocks.addOrderItem.mockReset().mockResolvedValue(null)
  apiMocks.deleteOrderItem.mockReset().mockResolvedValue(null)
  apiMocks.searchSaleProductsWithAvailability.mockReset().mockResolvedValue([])
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
  it('automatically clears a restored operation confirmed by the exact server marker', async () => {
    const operationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const sale = createSale()
    const persisted = createPersistedWizardCartMutation({
      context: scope.context,
      expectation: { kind: 'operation-marker' },
      fallbackMessage: 'Не вдалося додати товар',
      localCommit: { kind: 'none' },
      operationId,
      request: {
        clientAgreementNetId: agreementNetId,
        kind: 'add',
        orderItem: sale.Order?.OrderItems?.[0] as SalesUkraineOrderItem,
        saleNetId: sale.NetUid as string,
      },
    })
    saveSalesPendingMutation(scope, operationId, persisted)
    const committedSale = { ...sale, OperationNetUid: operationId }
    const onCartChanged = vi.fn(async () => committedSale)
    const onPendingMutationChange = vi.fn()

    renderStep({ onCartChanged, onPendingMutationChange, sale: committedSale })

    await waitFor(() => expect(loadSalesPendingMutation(scope)).toBe(null))
    expect(onCartChanged).not.toHaveBeenCalled()
    expect(apiMocks.addOrderItem).not.toHaveBeenCalled()
    expect(onPendingMutationChange).toHaveBeenLastCalledWith(false)
    expect(screen.queryByText('Результат операції потребує перевірки')).toBeNull()
  })

  it('unblocks a completed add whose cart projection has no operation marker', async () => {
    const operationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const sale = createSale()
    const persisted = createPersistedWizardCartMutation({
      context: scope.context,
      expectation: { kind: 'operation-marker' },
      fallbackMessage: 'Не вдалося додати товар',
      localCommit: { kind: 'none' },
      operationId,
      request: {
        clientAgreementNetId: agreementNetId,
        kind: 'add',
        orderItem: {
          ...(sale.Order?.OrderItems?.[0] as SalesUkraineOrderItem),
          Product: createSearchProduct(10),
        },
        saleNetId: sale.NetUid as string,
      },
    })
    saveSalesPendingMutation(scope, operationId, persisted)
    const onPendingMutationChange = vi.fn()
    apiMocks.searchSaleProductsWithAvailability.mockResolvedValueOnce([createSearchProduct(10)])
    apiMocks.getProductAvailabilityBuckets.mockResolvedValueOnce({
      AvailableQtyUk: 7,
      AvailableQtyUkReSale: 0,
    })

    const view = renderStep({ onPendingMutationChange, sale })

    fireEvent.change(screen.getByPlaceholderText(/пошук/i), { target: { value: 'SEM12081' } })
    await screen.findByRole('button', { name: 'Скопіювати код: SEM12081' })

    fireEvent.click(await screen.findByRole('button', { name: 'Перевірити та повторити' }))

    await waitFor(() => expect(apiMocks.addOrderItem).toHaveBeenCalledOnce())
    await waitFor(() => expect(loadSalesPendingMutation(scope)).toBe(null))
    expect(apiMocks.addOrderItem.mock.calls[0]?.[3]?.operationId).toBe(operationId)
    expect(onPendingMutationChange).toHaveBeenLastCalledWith(false)
    await waitFor(() => {
      expect(view.container.querySelector('.new-sale-product-picker-card__qty')?.textContent).toBe('7')
    })
  })

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

  it('refreshes a retained search result from 254 to 0 after the full quantity enters the cart', async () => {
    apiMocks.acceptedQty = 254
    apiMocks.getProductAvailabilityBuckets
      .mockResolvedValueOnce({ AvailableQtyUk: 254, AvailableQtyUkReSale: 0 })
      .mockResolvedValueOnce({ AvailableQtyUk: 0, AvailableQtyUkReSale: 0 })
    apiMocks.searchSaleProductsWithAvailability.mockResolvedValueOnce([createSearchProduct(254)])
    const emptySale = createSale(0)
    emptySale.Order = { ...emptySale.Order, OrderItems: [] }
    const view = renderStep({ onCartChanged: vi.fn(async () => createSale(254)), sale: emptySale })

    fireEvent.change(screen.getByPlaceholderText(/пошук/i), { target: { value: 'SEM12081' } })
    await screen.findByRole('button', { name: 'Скопіювати код: SEM12081' })
    expect(view.container.querySelector('.new-sale-product-picker-card__qty')?.textContent).toBe('254')

    fireEvent.keyDown(document.body, { key: 'Enter' })
    fireEvent.click(await screen.findByRole('button', { name: 'accept quantity' }))

    await waitFor(() => expect(apiMocks.getProductAvailabilityBuckets).toHaveBeenCalledTimes(2))
    await waitFor(() => {
      expect(view.container.querySelector('.new-sale-product-picker-card__qty')?.textContent).toBe('0')
    })
    expect(apiMocks.searchSaleProductsWithAvailability).toHaveBeenCalledOnce()
  })

  it('refreshes a retained search result to the exact partial remainder', async () => {
    apiMocks.acceptedQty = 16
    apiMocks.getProductAvailabilityBuckets
      .mockResolvedValueOnce({ AvailableQtyUk: 30, AvailableQtyUkReSale: 0 })
      .mockResolvedValueOnce({ AvailableQtyUk: 14, AvailableQtyUkReSale: 0 })
    apiMocks.searchSaleProductsWithAvailability.mockResolvedValueOnce([createSearchProduct(30)])
    const emptySale = createSale(0)
    emptySale.Order = { ...emptySale.Order, OrderItems: [] }
    const view = renderStep({ onCartChanged: vi.fn(async () => createSale(16)), sale: emptySale })

    fireEvent.change(screen.getByPlaceholderText(/пошук/i), { target: { value: 'SEM12081' } })
    await screen.findByRole('button', { name: 'Скопіювати код: SEM12081' })

    fireEvent.keyDown(document.body, { key: 'Enter' })
    fireEvent.click(await screen.findByRole('button', { name: 'accept quantity' }))

    await waitFor(() => {
      expect(view.container.querySelector('.new-sale-product-picker-card__qty')?.textContent).toBe('14')
    })
    expect(apiMocks.searchSaleProductsWithAvailability).toHaveBeenCalledOnce()
  })

  it('uses the exact post-mutation availability when a repeated broad search stays stale', async () => {
    apiMocks.acceptedQty = 1
    apiMocks.getProductAvailabilityBuckets
      .mockResolvedValueOnce({ AvailableQtyUk: 2, AvailableQtyUkReSale: 0 })
      .mockResolvedValueOnce({ AvailableQtyUk: 1, AvailableQtyUkReSale: 0 })
    apiMocks.searchSaleProductsWithAvailability
      .mockResolvedValueOnce([createSearchProduct(2, {
        NameUA: 'Насос масляний',
        VendorCode: '0102133-VDN',
      })])
      .mockResolvedValueOnce([createSearchProduct(2, {
        NameUA: 'Насос масляний',
        VendorCode: '0102133-VDN',
      })])
    const emptySale = createSale(0)
    emptySale.Order = { ...emptySale.Order, OrderItems: [] }
    const view = renderStep({ onCartChanged: vi.fn(async () => createSale(1)), sale: emptySale })

    fireEvent.change(screen.getByPlaceholderText(/пошук/i), { target: { value: '0102133-VDN' } })
    await screen.findByRole('button', { name: 'Скопіювати код: 0102133-VDN' })
    expect(view.container.querySelector('.new-sale-product-picker-card__qty')?.textContent).toBe('2')

    fireEvent.keyDown(document.body, { key: 'Enter' })
    fireEvent.click(await screen.findByRole('button', { name: 'accept quantity' }))

    await waitFor(() => expect(apiMocks.getProductAvailabilityBuckets).toHaveBeenCalledTimes(2))
    await waitFor(() => {
      expect(view.container.querySelector('.new-sale-product-picker-card__qty')?.textContent).toBe('1')
    })
    expect(apiMocks.searchSaleProductsWithAvailability).toHaveBeenCalledOnce()
  })

  it('refreshes only the selected product and preserves a broad search detail view', async () => {
    apiMocks.acceptedQty = 1
    apiMocks.getProductAvailabilityBuckets
      .mockResolvedValueOnce({ AvailableQtyUk: 59, AvailableQtyUkReSale: 0 })
      .mockResolvedValueOnce({ AvailableQtyUk: 58, AvailableQtyUkReSale: 0 })
    apiMocks.searchSaleProductsWithAvailability.mockResolvedValueOnce([
      createSearchProduct(59, {
        NameUA: 'Болт-шпилька з круглою головкою',
        VendorCode: '38118103 NR',
      }),
    ])
    const emptySale = createSale(0)
    emptySale.Order = { ...emptySale.Order, OrderItems: [] }
    const view = renderStep({ onCartChanged: vi.fn(async () => createSale(1)), sale: emptySale })

    fireEvent.change(screen.getByPlaceholderText(/пошук/i), { target: { value: '381' } })
    fireEvent.click(await screen.findByText('38118103 NR'))
    await screen.findByRole('button', { name: 'Скопіювати код: 38118103 NR' })
    expect(view.container.querySelector('.new-sale-product-picker-card__qty')?.textContent).toBe('59')
    await waitFor(() => expect(apiMocks.searchSaleProductsWithAvailability).toHaveBeenCalledTimes(2))
    const searchCallsBeforeMutation = apiMocks.searchSaleProductsWithAvailability.mock.calls.length

    fireEvent.click(screen.getByRole('button', { name: 'Деталі' }))
    fireEvent.keyDown(document.body, { key: 'Enter' })
    fireEvent.click(await screen.findByRole('button', { name: 'accept quantity' }))

    await waitFor(() => expect(apiMocks.getProductAvailabilityBuckets).toHaveBeenCalledTimes(2))
    await waitFor(() => {
      expect(view.container.querySelector('.new-sale-product-picker-card__qty')?.textContent).toBe('58')
    })
    expect(apiMocks.searchSaleProductsWithAvailability).toHaveBeenCalledTimes(searchCallsBeforeMutation)
  })

  it('removes stale availability without fabricating zero when the exact refresh fails', async () => {
    apiMocks.acceptedQty = 1
    apiMocks.getProductAvailabilityBuckets
      .mockResolvedValueOnce({ AvailableQtyUk: 2, AvailableQtyUkReSale: 0 })
      .mockRejectedValueOnce(new Error('availability unavailable'))
    apiMocks.searchSaleProductsWithAvailability.mockResolvedValueOnce([
      createSearchProduct(2, { NameUA: 'Насос масляний', VendorCode: '0102133-VDN' }),
    ])
    const emptySale = createSale(0)
    emptySale.Order = { ...emptySale.Order, OrderItems: [] }
    const view = renderStep({ onCartChanged: vi.fn(async () => createSale(1)), sale: emptySale })

    fireEvent.change(screen.getByPlaceholderText(/пошук/i), { target: { value: '0102133-VDN' } })
    await screen.findByRole('button', { name: 'Скопіювати код: 0102133-VDN' })
    fireEvent.keyDown(document.body, { key: 'Enter' })
    fireEvent.click(await screen.findByRole('button', { name: 'accept quantity' }))

    await waitFor(() => {
      expect(
        screen.getAllByText('Не вдалося оновити залишок товару. Повторіть пошук.'),
      ).toHaveLength(2)
    })
    expect(view.container.querySelector('.new-sale-product-picker-card__qty')).toBeNull()
    expect(apiMocks.addOrderItem).toHaveBeenCalledOnce()
    expect(apiMocks.searchSaleProductsWithAvailability).toHaveBeenCalledOnce()
  })

  it('retains an initial submitted 4xx until exact reconciliation succeeds', async () => {
    apiMocks.deleteOrderItem
      .mockRejectedValueOnce(new ApiError('row conflict', 400, null))
      .mockResolvedValueOnce(null)
    const onPendingMutationChange = vi.fn()
    renderStep({ onPendingMutationChange })

    fireEvent.click(screen.getByRole('button', { name: 'remove row' }))
    fireEvent.click(await screen.findByRole('button', { name: 'confirm mutation' }))

    await waitFor(() => expect(apiMocks.deleteOrderItem).toHaveBeenCalledOnce())
    const retry = await screen.findByRole('button', { name: 'Перевірити та повторити' })
    const pending = loadSalesPendingMutation(scope)
    const firstOperationId = apiMocks.deleteOrderItem.mock.calls[0]?.[1]?.operationId

    expect(pending).toMatchObject({ operationId: firstOperationId, phase: 'unknown' })
    expect(onPendingMutationChange).toHaveBeenLastCalledWith(true)

    fireEvent.click(retry)

    await waitFor(() => expect(apiMocks.deleteOrderItem).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(loadSalesPendingMutation(scope)).toBe(null))
    expect(apiMocks.deleteOrderItem.mock.calls[1]?.[1]?.operationId).toBe(firstOperationId)
    expect(onPendingMutationChange).toHaveBeenLastCalledWith(false)
  })

  it('keeps an initial 5xx retryable and reuses the persisted operation key', async () => {
    apiMocks.deleteOrderItem
      .mockRejectedValueOnce(new ApiError('response lost', 503, null))
      .mockResolvedValueOnce(null)
    const onPendingMutationChange = vi.fn()
    const onCartChanged = vi.fn(async () => createSale())
    renderStep({ onCartChanged, onPendingMutationChange })

    fireEvent.click(screen.getByRole('button', { name: 'remove row' }))
    fireEvent.click(await screen.findByRole('button', { name: 'confirm mutation' }))

    const retry = await screen.findByRole('button', { name: 'Перевірити та повторити' })
    const pending = loadSalesPendingMutation(scope)
    const firstOperationId = apiMocks.deleteOrderItem.mock.calls[0]?.[1]?.operationId

    expect(pending?.operationId).toBe(firstOperationId)
    expect(onPendingMutationChange).toHaveBeenLastCalledWith(true)

    fireEvent.click(retry)

    await waitFor(() => expect(apiMocks.deleteOrderItem).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(loadSalesPendingMutation(scope)).toBe(null))

    expect(apiMocks.deleteOrderItem.mock.calls[1]?.[1]?.operationId).toBe(firstOperationId)
    expect(onPendingMutationChange).toHaveBeenLastCalledWith(false)
  })

  it('recovers a deleted row when reconciliation omits both the row and operation marker', async () => {
    apiMocks.deleteOrderItem
      .mockRejectedValueOnce(new ApiError('response lost after commit', 503, null))
      .mockResolvedValueOnce(null)
    const onPendingMutationChange = vi.fn()
    const reconciledSale = createSale()
    reconciledSale.Order = { ...reconciledSale.Order, OrderItems: [] }
    const onCartChanged = vi.fn(async () => reconciledSale)
    renderStep({ onCartChanged, onPendingMutationChange })

    fireEvent.click(screen.getByRole('button', { name: 'remove row' }))
    fireEvent.click(await screen.findByRole('button', { name: 'confirm mutation' }))

    const retry = await screen.findByRole('button', { name: 'Перевірити та повторити' })
    const firstOperationId = apiMocks.deleteOrderItem.mock.calls[0]?.[1]?.operationId

    expect(loadSalesPendingMutation(scope)?.phase).toBe('unknown')
    expect(onPendingMutationChange).toHaveBeenLastCalledWith(true)

    fireEvent.click(retry)

    await waitFor(() => expect(apiMocks.deleteOrderItem).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(loadSalesPendingMutation(scope)).toBe(null))
    expect(apiMocks.deleteOrderItem.mock.calls[1]?.[1]?.operationId).toBe(firstOperationId)
    expect(onPendingMutationChange).toHaveBeenLastCalledWith(false)
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

function createSearchProduct(availableQty: number, overrides: Partial<WizardSaleProduct> = {}): WizardSaleProduct {
  return {
    AvailableQtyUk: availableQty,
    AvailableQtyUkReSale: 0,
    HasAnalogue: true,
    Id: 10,
    NameUA: 'Комплект ремонтний вала розжимного',
    NetUid: 'product-1',
    VendorCode: 'SEM12081',
    ...overrides,
  }
}
