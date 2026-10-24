import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WizardSaleProduct } from './wizardSaleProduct'

const mocks = vi.hoisted(() => ({ load: vi.fn(), resetFocus: vi.fn() }))
vi.mock('./newSaleWizardApi', () => ({ getProductAnalogues: mocks.load }))
import { useWizardProductAnalogues } from './useWizardProductAnalogues'

const initialProps = {
  agreementNetId: 'agreement-1', saleNetUid: 'sale-1', isVatSale: false, dataRevision: 0,
  productNetUid: 'parent-1', hasAnalogue: true, isAnalogueSource: false, onResetFocus: mocks.resetFocus,
}
const analogue = (id: string, qty: number): WizardSaleProduct => ({ NetUid: id, AvailableQtyUk: qty, ProductAvailabilities: [{ Amount: qty }] })
async function tick() {
  await act(async () => { await vi.advanceTimersByTimeAsync(240) })
}
function deferred() {
  let resolve!: (value: WizardSaleProduct[]) => void
  const promise = new Promise<WizardSaleProduct[]>((nextResolve) => { resolve = nextResolve })
  return { promise, resolve }
}
beforeEach(() => {
  vi.useFakeTimers()
  mocks.load.mockReset().mockResolvedValue([analogue('a', 2)])
  mocks.resetFocus.mockReset()
})
afterEach(() => vi.useRealTimers())

describe('wizard product analogues', () => {
  it('filters unavailable rows and sorts by stock while retaining the parent list on analogue focus', async () => {
    mocks.load.mockResolvedValueOnce([analogue('a', 2), { NetUid: 'unavailable' }, analogue('b', 5)])
    const { result, rerender } = renderHook(useWizardProductAnalogues, { initialProps })
    await tick()
    expect(result.current.analogueState.items.map((item) => item.NetUid)).toEqual(['b', 'a'])
    mocks.resetFocus.mockClear()
    rerender({ ...initialProps, productNetUid: 'b', isAnalogueSource: true })
    await tick()
    expect(result.current.analogueState.parentNetUid).toBe('parent-1')
    expect(mocks.resetFocus).not.toHaveBeenCalled()
    expect(mocks.load).toHaveBeenCalledOnce()
  })

  it('reuses the cache when returning to the parent and retains local description edits', async () => {
    const { result, rerender } = renderHook(useWizardProductAnalogues, { initialProps })
    await tick()
    act(() => result.current.patchAnalogues((item) => ({ ...item, Description: 'updated' })))
    rerender({ ...initialProps, productNetUid: 'component-1' })
    await tick()
    rerender(initialProps)
    await tick()
    expect(mocks.load).toHaveBeenCalledTimes(2)
    expect(result.current.analogueState.items[0].Description).toBe('updated')
    act(() => result.current.restoreCachedAnalogues({ NetUid: 'parent-1', HasAnalogue: true }))
    expect(result.current.analogueState.items[0].Description).toBe('updated')
  })

  it('restores cached results after selection reset without another request', async () => {
    const { result } = renderHook(useWizardProductAnalogues, { initialProps })
    await tick()
    act(() => result.current.resetAnalogues())
    await tick()
    expect(mocks.load).toHaveBeenCalledOnce()
    expect(result.current.analogueState.items).toEqual([analogue('a', 2)])
  })

  it.each(['agreementNetId', 'saleNetUid', 'isVatSale', 'dataRevision'] as const)('invalidates cached analogues on %s change', async (field) => {
    const { result, rerender } = renderHook(useWizardProductAnalogues, { initialProps })
    await tick()
    const scope = result.current.analogueScopeKey
    rerender({ ...initialProps, [field]: field === 'isVatSale' ? true : field === 'dataRevision' ? 1 : 'new-context' })
    expect(result.current.analogueScopeKey).not.toBe(scope)
    await tick()
    expect(mocks.load).toHaveBeenCalledTimes(2)
    expect(result.current.analogueState.scopeKey).toBe(result.current.analogueScopeKey)
  })

  it('does not publish or cache late responses for a previous product', async () => {
    const old = deferred()
    mocks.load.mockReturnValueOnce(old.promise)
    const { result, rerender } = renderHook(useWizardProductAnalogues, { initialProps })
    await tick()
    const signal = mocks.load.mock.calls[0][2] as AbortSignal
    rerender({ ...initialProps, productNetUid: 'parent-2' })
    await tick()
    await act(async () => old.resolve([analogue('stale', 999)]))
    expect(signal.aborted).toBe(true)
    expect(result.current.analogueState.parentNetUid).toBe('parent-2')
    expect(result.current.analogueState.items[0].NetUid).toBe('a')
    rerender(initialProps)
    await tick()
    expect(mocks.load).toHaveBeenCalledTimes(3)
  })

  it('does not cache failures and cancels pending work on unmount', async () => {
    mocks.load.mockRejectedValueOnce(new Error('offline'))
    const { result, rerender, unmount } = renderHook(useWizardProductAnalogues, { initialProps })
    await tick()
    expect(result.current.analogueState.items).toEqual([])
    rerender({ ...initialProps, productNetUid: 'parent-2' })
    await tick()
    rerender(initialProps)
    await tick()
    expect(mocks.load).toHaveBeenCalledTimes(3)
    const signal = mocks.load.mock.calls[2][2] as AbortSignal
    unmount()
    expect(signal.aborted).toBe(true)
    const second = renderHook(useWizardProductAnalogues, { initialProps })
    second.unmount()
    await tick()
    expect(mocks.load).toHaveBeenCalledTimes(3)
  })
})


describe('analogue patch identity', () => {
  it('keeps the state and cached list when a patch does not change any product', async () => {
    const { result } = renderHook(useWizardProductAnalogues, { initialProps })
    await tick()
    const before = result.current.analogueState
    act(() => result.current.patchAnalogues((item) => item))
    expect(result.current.analogueState).toBe(before)
    act(() => result.current.restoreCachedAnalogues({ NetUid: 'parent-1', HasAnalogue: true }))
    expect(result.current.analogueState.items).toBe(before.items)
  })

  it('patches a shared visible/cached list once and keeps unchanged product identities', async () => {
    const first = analogue('a', 5)
    const second = analogue('b', 2)
    mocks.load.mockResolvedValueOnce([first, second])
    const { result } = renderHook(useWizardProductAnalogues, { initialProps })
    await tick()
    const patch = vi.fn((item: WizardSaleProduct) => item.NetUid === 'a' ? { ...item, Description: 'updated' } : item)
    act(() => result.current.patchAnalogues(patch))
    expect(patch).toHaveBeenCalledTimes(2)
    const visible = result.current.analogueState.items
    expect(visible[0].Description).toBe('updated')
    expect(visible[1]).toBe(second)
    act(() => result.current.restoreCachedAnalogues({ NetUid: 'parent-1', HasAnalogue: true }))
    expect(result.current.analogueState.items).toBe(visible)
    expect(mocks.load).toHaveBeenCalledOnce()
  })
})
