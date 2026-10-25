import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  current: vi.fn(),
  calculated: vi.fn(),
  reservations: vi.fn(),
  nearest: vi.fn(),
  totals: vi.fn(),
  t: (value: string) => value,
}))
vi.mock('./newSaleWizardApi', () => ({
  getProductCurrentPriceByAgreement: mocks.current,
  getProductCalculatedPricingsByAgreement: mocks.calculated,
  getProductReservationsByAgreement: mocks.reservations,
  getNearestSupplyOrder: mocks.nearest,
  getAllProductAvailabilities: mocks.totals,
}))
vi.mock('../../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: mocks.t }) }))
import { useWizardProductData } from './useWizardProductData'

const initialProps = {
  agreementNetId: 'agreement-1',
  productNetUid: 'product-1',
  saleNetUid: 'sale-1',
  isVatSale: false,
  detailsOpened: false,
}
const product = { NetUid: 'product-1' }
async function tick() {
  await act(async () => { await vi.advanceTimersByTimeAsync(240) })
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => { resolve = nextResolve })
  return { promise, resolve }
}
beforeEach(() => {
  vi.useFakeTimers()
  mocks.current.mockReset().mockResolvedValue(20)
  mocks.calculated.mockReset().mockResolvedValue([{ DiscountRate: 5 }])
  mocks.reservations.mockReset().mockResolvedValue([{ ProductNetUid: 'product-1', Price: 18 }])
  mocks.nearest.mockReset().mockResolvedValue({ Number: 'SUP-1' })
  mocks.totals.mockReset().mockResolvedValue({ TotalAvailabilities: { StorageUkrNotVat: 5 } })
})
afterEach(() => vi.useRealTimers())

describe('wizard product data', () => {
  it('publishes prices before a slow reservation lookup finishes', async () => {
    const pending = deferred<unknown[]>()
    mocks.reservations.mockReturnValueOnce(pending.promise)
    const { result } = renderHook(useWizardProductData, { initialProps })
    await tick()
    expect(result.current.productPricing.get('product-1')?.currentPrice).toBe(20)
    await act(async () => pending.resolve([{ ProductNetUid: 'product-1', Price: 18 }]))
    expect(result.current.productPricing.get('product-1')?.reservation?.Price).toBe(18)
    expect(mocks.current).toHaveBeenCalledOnce()
  })

  it('shows stock before slow supply data and shares the in-flight reads across reopening details', async () => {
    const supply = deferred<object>()
    mocks.nearest.mockReturnValueOnce(supply.promise)
    const { result, rerender } = renderHook(useWizardProductData, { initialProps: { ...initialProps, detailsOpened: true } })
    await tick()
    expect(result.current.getProductDetailSnapshot(product)).toMatchObject({ detailsLoaded: true, detailsError: null,
      availabilities: { TotalAvailabilities: { StorageUkrNotVat: 5 } }, nearestOrder: null })
    const signal = mocks.nearest.mock.calls[0][1] as AbortSignal
    rerender(initialProps)
    rerender({ ...initialProps, detailsOpened: true })
    await tick()
    expect(signal.aborted).toBe(false)
    expect(mocks.nearest).toHaveBeenCalledOnce()
    expect(mocks.totals).toHaveBeenCalledOnce()
    await act(async () => supply.resolve({ Number: 'SUP-LATE' }))
    expect(result.current.getProductDetailSnapshot(product)?.nearestOrder?.Number).toBe('SUP-LATE')
    // A completed snapshot is not a cache of live stock: a later visit refreshes it.
    rerender(initialProps)
    rerender({ ...initialProps, detailsOpened: true })
    await tick()
    expect(mocks.totals).toHaveBeenCalledTimes(2)
  })

  it('loads prices concurrently after focus settles and keeps details lazy', async () => {
    const current = deferred<number>()
    mocks.current.mockReturnValueOnce(current.promise)
    const { result } = renderHook(useWizardProductData, { initialProps })
    expect(mocks.current).not.toHaveBeenCalled()
    await tick()
    expect(mocks.current).toHaveBeenCalledOnce()
    expect(mocks.calculated).toHaveBeenCalledOnce()
    expect(mocks.reservations).toHaveBeenCalledOnce()
    expect(mocks.nearest).not.toHaveBeenCalled()
    expect(mocks.totals).not.toHaveBeenCalled()
    expect(result.current.productPricing.size).toBe(0)
    await act(async () => current.resolve(20))
    expect(result.current.productPricing.get('product-1')).toMatchObject({ currentPrice: 20, reservation: { Price: 18 } })
  })

  it('does not dispatch details closed before the focus delay, and aborts a dispatched read on unmount even while closed', async () => {
    const pending = deferred<object>()
    mocks.totals.mockReturnValueOnce(pending.promise)
    const { rerender, unmount } = renderHook(useWizardProductData, { initialProps: { ...initialProps, detailsOpened: true } })
    rerender(initialProps)
    await tick()
    expect(mocks.totals).not.toHaveBeenCalled()
    rerender({ ...initialProps, detailsOpened: true })
    await tick()
    const signal = mocks.totals.mock.calls[0][3] as AbortSignal
    rerender(initialProps)
    expect(signal.aborted).toBe(false)
    unmount()
    expect(signal.aborted).toBe(true)
    await act(async () => pending.resolve({ stale: true }))
  })

  it('reports a stock failure without waiting for supply and retires that supply on manual retry', async () => {
    const pending = deferred<object>()
    mocks.nearest.mockReturnValueOnce(pending.promise)
    mocks.totals.mockRejectedValueOnce(new Error('Stock unavailable'))
    const { result } = renderHook(useWizardProductData, { initialProps: { ...initialProps, detailsOpened: true } })
    await tick()
    expect(result.current.getProductDetailSnapshot(product)).toMatchObject({ detailsLoaded: true, detailsError: 'Stock unavailable' })
    const signal = mocks.nearest.mock.calls[0][1] as AbortSignal
    act(() => result.current.retryProductDetails())
    expect(signal.aborted).toBe(true)
    await tick()
    await act(async () => pending.resolve({ Number: 'STALE' }))
    expect(result.current.getProductDetailSnapshot(product)).toMatchObject({ detailsError: null, nearestOrder: { Number: 'SUP-1' } })
  })

  it('does not reload prices for unrelated renders or opening and retrying details', async () => {
    const { result, rerender } = renderHook(useWizardProductData, { initialProps })
    await tick()
    rerender({ ...initialProps })
    await tick()
    rerender({ ...initialProps, detailsOpened: true })
    await tick()
    act(() => result.current.retryProductDetails())
    await tick()
    expect(mocks.current).toHaveBeenCalledOnce()
    expect(mocks.calculated).toHaveBeenCalledOnce()
    expect(mocks.reservations).toHaveBeenCalledOnce()
    expect(mocks.totals).toHaveBeenCalledTimes(2)
  })

  it('refreshes an already open details panel after realtime/cart invalidation', async () => {
    const { result } = renderHook(useWizardProductData, { initialProps: { ...initialProps, detailsOpened: true } })
    await tick()
    expect(result.current.getProductDetailSnapshot(product)?.detailsLoaded).toBe(true)
    mocks.totals.mockResolvedValueOnce({ TotalAvailabilities: { StorageUkrNotVat: 2 } })
    act(() => result.current.invalidateProductData())
    expect(result.current.productPricing.size).toBe(0)
    await tick()
    expect(mocks.totals).toHaveBeenCalledTimes(2)
    expect(mocks.current).toHaveBeenCalledTimes(2)
    expect(result.current.getProductDetailSnapshot(product)).toMatchObject({
      detailsLoaded: true,
      availabilities: { TotalAvailabilities: { StorageUkrNotVat: 2 } },
    })
  })

  it('retires requests synchronously on invalidation, even if the transport ignores abort', async () => {
    const oldPrice = deferred<number>()
    const oldTotals = deferred<object>()
    mocks.current.mockReturnValueOnce(oldPrice.promise)
    mocks.totals.mockReturnValueOnce(oldTotals.promise)
    const { result } = renderHook(useWizardProductData, { initialProps: { ...initialProps, detailsOpened: true } })
    await tick()
    const pricingSignal = mocks.current.mock.calls[0][2] as AbortSignal
    const detailsSignal = mocks.totals.mock.calls[0][3] as AbortSignal
    act(() => result.current.invalidateProductData())
    expect(pricingSignal.aborted).toBe(true)
    expect(detailsSignal.aborted).toBe(true)
    await tick()
    await act(async () => { oldPrice.resolve(999); oldTotals.resolve({ stale: true }) })
    expect(result.current.productPricing.get('product-1')?.currentPrice).toBe(20)
    expect(result.current.getProductDetailSnapshot(product)?.availabilities).not.toHaveProperty('stale')
  })

  it.each(['agreementNetId', 'saleNetUid', 'isVatSale'] as const)('does not reuse pricing or details across %s', async (field) => {
    const { result, rerender } = renderHook(useWizardProductData, { initialProps: { ...initialProps, detailsOpened: true } })
    await tick()
    const previousSignal = mocks.current.mock.calls[0][2] as AbortSignal
    rerender({ ...initialProps, detailsOpened: true, [field]: field === 'isVatSale' ? true : 'new-context' })
    expect(previousSignal.aborted).toBe(true)
    expect(result.current.productPricing.size).toBe(0)
    expect(result.current.getProductDetailSnapshot(product)?.availabilities ?? null).toBeNull()
    await tick()
    expect(mocks.current).toHaveBeenCalledTimes(2)
    expect(mocks.totals).toHaveBeenCalledTimes(2)
  })

  it('debounces focus changes and aborts requests for the previous product', async () => {
    const late = deferred<number>()
    mocks.current.mockReturnValueOnce(late.promise)
    const { result, rerender } = renderHook(useWizardProductData, { initialProps })
    await tick()
    const signal = mocks.current.mock.calls[0][2] as AbortSignal
    rerender({ ...initialProps, productNetUid: 'product-2' })
    rerender({ ...initialProps, productNetUid: 'product-3' })
    await tick()
    await act(async () => late.resolve(999))
    expect(signal.aborted).toBe(true)
    expect(mocks.current.mock.calls.map((call) => call[0])).toEqual(['product-1', 'product-3'])
    expect(result.current.productPricing.has('product-1')).toBe(false)
    expect(result.current.productPricing.get('product-3')?.currentPrice).toBe(20)
  })

  it('keeps stock usable if supply lookup fails, and supports retrying a stock error', async () => {
    mocks.nearest.mockRejectedValue(new Error('supply unavailable'))
    mocks.totals.mockRejectedValueOnce(new Error('stock unavailable'))
    const { result } = renderHook(useWizardProductData, { initialProps: { ...initialProps, detailsOpened: true } })
    await tick()
    expect(result.current.getProductDetailSnapshot(product)).toMatchObject({ detailsLoaded: true, detailsError: 'stock unavailable' })
    act(() => result.current.retryProductDetails())
    await tick()
    expect(result.current.getProductDetailSnapshot(product)).toMatchObject({ detailsLoaded: true, detailsError: null, nearestOrder: null })
    expect(result.current.getProductDetailSnapshot(product)?.availabilities).not.toBeNull()
  })

  it('does not carry a removed reservation price into the next snapshot', async () => {
    mocks.current.mockResolvedValue(null)
    const { result, rerender } = renderHook(useWizardProductData, { initialProps })
    await tick()
    expect(result.current.productPricing.get('product-1')?.reservation?.Price).toBe(18)
    rerender({ ...initialProps, productNetUid: 'product-2' })
    await tick()
    mocks.reservations.mockResolvedValueOnce([])
    rerender(initialProps)
    await tick()
    expect(result.current.productPricing.get('product-1')?.reservation).toBeUndefined()
  })

  it('aborts every active read on unmount and never sends delayed reads after unmount', async () => {
    const pending = deferred<number>()
    mocks.current.mockReturnValueOnce(pending.promise)
    const { unmount } = renderHook(useWizardProductData, { initialProps: { ...initialProps, detailsOpened: true } })
    await tick()
    const signals = [mocks.current.mock.calls[0][2], mocks.calculated.mock.calls[0][2], mocks.reservations.mock.calls[0][2], mocks.nearest.mock.calls[0][1], mocks.totals.mock.calls[0][3]] as AbortSignal[]
    unmount()
    expect(signals.every((signal) => signal.aborted)).toBe(true)
    await act(async () => pending.resolve(999))
    const second = renderHook(useWizardProductData, { initialProps })
    second.unmount()
    await tick()
    expect(mocks.current).toHaveBeenCalledOnce()
  })
})
