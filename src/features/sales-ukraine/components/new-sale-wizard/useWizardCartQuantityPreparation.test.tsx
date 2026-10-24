import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWizardCartQuantityPreparation } from './useWizardCartQuantityPreparation'
import type { SalesUkraineOrderItem, SalesUkraineSale } from '../../types'
import type { WizardSaleProduct } from './wizardSaleProduct'

const mocks = vi.hoisted(() => ({ load: vi.fn(), notify: vi.fn(), t: (key: string) => key }))
vi.mock('./newSaleWizardApi', () => ({ getProductAvailabilityBuckets: mocks.load }))
vi.mock('@mantine/notifications', () => ({ notifications: { show: mocks.notify } }))
vi.mock('../../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: mocks.t }) }))
beforeEach(() => { mocks.load.mockReset().mockResolvedValue({ AvailableQtyUk: 4, AvailableQtyUkReSale: 2, AvailableQtyUkVAT: 9 }); mocks.notify.mockClear() })
afterEach(cleanup)
const product: WizardSaleProduct = { NetUid: 'product-a', AvailableQtyUk: 4, AvailableQtyUkReSale: 2, AvailableQtyUkVAT: 9 }
const item: SalesUkraineOrderItem = { NetUid: 'row-a', Product: product, Qty: 3, Comment: 'original' }
type Options = Parameters<typeof useWizardCartQuantityPreparation>[0]
function options() {
  let locked = false
  return {
    sale: { NetUid: 'sale-a', IsVatSale: false, BaseLifeCycleStatus: { SaleLifeCycleType: 0 } } as SalesUkraineSale,
    agreementNetId: 'agreement-a', canCreateFutureReservation: true,
    onFutureReservation: vi.fn(), onReady: vi.fn(),
    mutation: {
      beginBusy: vi.fn(() => { if (locked) return null; locked = true; return 'agreement-a:sale-a' }),
      endBusy: vi.fn(() => { locked = false }),
      isCurrentMutationContext: vi.fn(() => true),
    },
  } satisfies Options
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => { resolve = next })
  return { promise, resolve }
}

describe('cart quantity preparation', () => {
  it.each([false, true])('loads the relevant stock for add and edit (VAT=%s)', async (vat) => {
    const props = options()
    props.sale.IsVatSale = vat
    const { result } = renderHook(() => useWizardCartQuantityPreparation(props))
    await act(() => result.current.prepareAddToCart(product))
    expect(mocks.load).toHaveBeenLastCalledWith('product-a', 'agreement-a')
    expect(props.onReady).toHaveBeenLastCalledWith({ kind: 'add', available: vat ? 9 : 6, item: {
      Deleted: false, Id: 0, NetUid: '00000000-0000-0000-0000-000000000000', Product: product, Qty: 0,
    } })
    await act(() => result.current.onEditOrderItem(item))
    expect(props.onReady).toHaveBeenLastCalledWith({ kind: 'edit-current', available: vat ? 12 : 9, item })
    expect(props.mutation.endBusy).toHaveBeenCalledTimes(2)
  })

  it('adds numeric stock strings instead of concatenating them', async () => {
    mocks.load.mockResolvedValue({ AvailableQtyUk: '4.5', AvailableQtyUkReSale: '2.25' })
    const props = options()
    const { result } = renderHook(() => useWizardCartQuantityPreparation(props))
    await act(() => result.current.prepareAddToCart(product))
    expect(props.onReady).toHaveBeenLastCalledWith(expect.objectContaining({ available: 6.75 }))
    await act(() => result.current.onEditOrderItem(item))
    expect(props.onReady).toHaveBeenLastCalledWith(expect.objectContaining({ available: 9.75 }))
  })

  it.each([null, {}])('preserves zero availability for missing bucket data: %s', async (buckets) => {
    mocks.load.mockResolvedValue(buckets)
    const props = options()
    const { result } = renderHook(() => useWizardCartQuantityPreparation(props))
    await act(() => result.current.prepareAddToCart(product))
    expect(props.onReady).toHaveBeenLastCalledWith(expect.objectContaining({ available: 0 }))
    await act(() => result.current.onEditOrderItem(item))
    expect(props.onReady).toHaveBeenLastCalledWith(expect.objectContaining({ available: 3 }))
  })

  it.each([true, false])('routes known zero stock through reservation permission=%s without a stock request', async (allowed) => {
    const props = { ...options(), canCreateFutureReservation: allowed }
    const empty = { ...product, AvailableQtyUk: 0, AvailableQtyUkReSale: 0 }
    const { result } = renderHook(() => useWizardCartQuantityPreparation(props))
    await act(() => result.current.prepareAddToCart(empty))
    expect(props.onFutureReservation).toHaveBeenCalledTimes(allowed ? 1 : 0)
    expect(mocks.notify).toHaveBeenCalledTimes(allowed ? 0 : 1)
    expect(mocks.load).not.toHaveBeenCalled()
    expect(props.mutation.beginBusy).not.toHaveBeenCalled()
    expect(props.onReady).not.toHaveBeenCalled()
  })

  it('loads unknown stock instead of treating it as a future reservation', async () => {
    const props = options()
    const { result } = renderHook(() => useWizardCartQuantityPreparation(props))
    await act(() => result.current.prepareAddToCart({ NetUid: 'unknown-stock' }))
    expect(mocks.load).toHaveBeenCalledWith('unknown-stock', 'agreement-a')
    expect(props.onFutureReservation).not.toHaveBeenCalled()
  })

  it('rejects missing product identity and missing client/sale context before loading', async () => {
    const props = options()
    const { result, rerender } = renderHook(useWizardCartQuantityPreparation, { initialProps: props as Options })
    await act(() => result.current.prepareAddToCart(null))
    await act(() => result.current.prepareAddToCart({}))
    await act(() => result.current.onEditOrderItem({ Qty: 1 }))
    rerender({ ...props, agreementNetId: null })
    await act(() => result.current.prepareAddToCart(product))
    await act(() => result.current.onEditOrderItem(item))
    rerender({ ...props, sale: null })
    await act(() => result.current.prepareAddToCart(product))
    expect(mocks.load).not.toHaveBeenCalled()
    expect(props.onReady).not.toHaveBeenCalled()
    expect(props.mutation.beginBusy).not.toHaveBeenCalled()
  })

  it.each([false, true])('requires approval before changing a printed sale (approved=%s)', async (approved) => {
    const props = options()
    props.sale.IsPrinted = true
    props.sale.BaseLifeCycleStatus = { SaleLifeCycleType: 1 }
    const approval = { NetUid: 'approval-a', ApproveUpdate: approved }
    props.sale.HistoryInvoiceEdit = [approval]
    const { result } = renderHook(() => useWizardCartQuantityPreparation(props))
    await act(() => result.current.prepareAddToCart(product))
    await act(() => result.current.onEditOrderItem(item))
    expect(mocks.load).toHaveBeenCalledTimes(approved ? 2 : 0)
    expect(props.onReady).toHaveBeenCalledTimes(approved ? 2 : 0)
    expect(mocks.notify).toHaveBeenCalledTimes(approved ? 0 : 2)
  })

  it('explains why an unprinted invoice cannot use direct quantity editing', async () => {
    const props = options()
    props.sale.BaseLifeCycleStatus = { SaleLifeCycleType: 1 }
    const { result } = renderHook(() => useWizardCartQuantityPreparation(props))
    await act(() => result.current.onEditOrderItem(item))
    expect(mocks.notify).toHaveBeenCalledWith({ color: 'red', message: 'Неможливо редагувати накладну' })
    expect(mocks.load).not.toHaveBeenCalled()
  })

  it.each(['add', 'edit'] as const)('does not load when the mutation guard rejects %s', async (action) => {
    const props = options()
    props.mutation.beginBusy.mockReturnValue(null)
    const { result } = renderHook(() => useWizardCartQuantityPreparation(props))
    await act(() => action === 'add' ? result.current.prepareAddToCart(product) : result.current.onEditOrderItem(item))
    expect(mocks.load).not.toHaveBeenCalled()
    expect(props.onReady).not.toHaveBeenCalled()
    expect(props.mutation.endBusy).not.toHaveBeenCalled()
  })

  it('holds the lock until stock is loaded, preventing duplicate preparation', async () => {
    const props = options()
    const pending = deferred<{ AvailableQtyUk: number; AvailableQtyUkReSale: number }>()
    mocks.load.mockReturnValue(pending.promise)
    const { result } = renderHook(() => useWizardCartQuantityPreparation(props))
    let request!: Promise<void>
    act(() => { request = result.current.prepareAddToCart(product); void result.current.onEditOrderItem(item) })
    expect(mocks.load).toHaveBeenCalledOnce()
    await act(async () => { pending.resolve({ AvailableQtyUk: 1, AvailableQtyUkReSale: 2 }); await request })
    expect(props.onReady).toHaveBeenCalledOnce()
    expect(props.mutation.endBusy).toHaveBeenCalledOnce()
  })

  it('reports add failures and limits editing to the current quantity when stock loading fails', async () => {
    mocks.load.mockRejectedValue(new Error('Stock unavailable'))
    const props = options()
    const { result } = renderHook(() => useWizardCartQuantityPreparation(props))
    await act(() => result.current.prepareAddToCart(product))
    expect(props.onReady).not.toHaveBeenCalled()
    expect(mocks.notify).toHaveBeenCalledWith({ color: 'red', message: 'Stock unavailable' })
    await act(() => result.current.onEditOrderItem(item))
    expect(props.onReady).toHaveBeenCalledExactlyOnceWith({ kind: 'edit-current', available: 3, item })
    expect(props.mutation.endBusy).toHaveBeenCalledTimes(2)
  })

  it.each(['add', 'edit'] as const)('ignores stale %s responses and errors after the mutation context changes', async (action) => {
    const props = options()
    const pending = deferred<{ AvailableQtyUk: number }>()
    mocks.load.mockReturnValue(pending.promise)
    const { result } = renderHook(() => useWizardCartQuantityPreparation(props))
    let request!: Promise<void>
    act(() => { request = action === 'add' ? result.current.prepareAddToCart(product) : result.current.onEditOrderItem(item) })
    props.mutation.isCurrentMutationContext.mockReturnValue(false)
    await act(async () => { pending.resolve({ AvailableQtyUk: 3 }); await request })
    mocks.load.mockRejectedValue(new Error('Late failure'))
    await act(() => action === 'add' ? result.current.prepareAddToCart(product) : result.current.onEditOrderItem(item))
    expect(props.onReady).not.toHaveBeenCalled()
    expect(mocks.notify).not.toHaveBeenCalled()
    expect(props.mutation.endBusy).toHaveBeenCalledTimes(2)
  })
})
