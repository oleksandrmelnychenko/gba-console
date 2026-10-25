import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { getProductSourcePriceComparison } from './api/productsApi'
import type { ProductSourcePriceComparison } from './types'
import { useProductSourcePrices } from './useProductSourcePrices'

vi.mock('./api/productsApi', () => ({ getProductSourcePriceComparison: vi.fn() }))
vi.mock('../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: (text: string) => text }) }))
const load = vi.mocked(getProductSourcePriceComparison)
const prices = (id: string, value: number): ProductSourcePriceComparison => ({ ProductNetId: id, Amg: { IsLinked: true, IsAvailable: true, Prices: [{ PricingName: 'ЦР', PriceEur: value }] } })
function deferred() {
  let resolve!: (value: ProductSourcePriceComparison | null) => void
  let reject!: (error: Error) => void
  const promise = new Promise<ProductSourcePriceComparison | null>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
beforeEach(() => load.mockReset())

it('retries failed source prices once for concurrent callers and clears the error', async () => {
  load.mockRejectedValueOnce(new Error('offline'))
  const { result } = renderHook(() => useProductSourcePrices('retry-prices'))
  await waitFor(() => expect(result.current.error).toBe('offline'))
  const retry = deferred()
  load.mockReturnValueOnce(retry.promise)
  let pending!: Promise<void>
  act(() => { pending = result.current.retry(); expect(result.current.retry()).toBe(pending) })
  expect(load).toHaveBeenCalledTimes(2)
  expect(result.current.isLoading).toBe(true)
  await act(async () => { retry.resolve(prices('retry-prices', 8)); await pending })
  expect(result.current.error).toBeNull()
  expect(result.current.comparison?.Amg?.Prices?.[0].PriceEur).toBe(8)
})

it('retires old refresh generations without caching their late responses', async () => {
  const old = deferred(), fresh = deferred()
  load.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise)
  const { result, rerender, unmount } = renderHook(({ revision }) => useProductSourcePrices('revision-prices', revision), { initialProps: { revision: 0 } })
  const oldSignal = load.mock.calls[0][1]
  rerender({ revision: 1 })
  expect(oldSignal?.aborted).toBe(true)
  await act(async () => fresh.resolve(prices('revision-prices', 12)))
  await act(async () => old.resolve(prices('revision-prices', 99)))
  expect(result.current.comparison?.Amg?.Prices?.[0].PriceEur).toBe(12)
  unmount()
  load.mockResolvedValueOnce(prices('revision-prices', 13))
  const revisited = renderHook(() => useProductSourcePrices('revision-prices', 0))
  await waitFor(() => expect(revisited.result.current.comparison?.Amg?.Prices?.[0].PriceEur).toBe(13))
  expect(load).toHaveBeenCalledTimes(3)
})

it('reuses successful snapshots within the TTL but refreshes expired entries', async () => {
  const now = vi.spyOn(Date, 'now').mockReturnValue(1000)
  try {
    load.mockResolvedValue(prices('cached-prices', 6))
    const first = renderHook(() => useProductSourcePrices('cached-prices'))
    await waitFor(() => expect(first.result.current.comparison).not.toBeNull())
    first.unmount()
    const second = renderHook(() => useProductSourcePrices('cached-prices'))
    expect(second.result.current.comparison?.Amg?.Prices?.[0].PriceEur).toBe(6)
    await act(async () => {})
    expect(load).toHaveBeenCalledOnce()
    second.unmount()
    now.mockReturnValue(122000)
    load.mockResolvedValue(prices('cached-prices', 7))
    const third = renderHook(() => useProductSourcePrices('cached-prices'))
    await waitFor(() => expect(third.result.current.comparison?.Amg?.Prices?.[0].PriceEur).toBe(7))
    expect(load).toHaveBeenCalledTimes(2)
  } finally { now.mockRestore() }
})

it('clears a previous product error when switching and ignores a retired failure', async () => {
  const old = deferred()
  load.mockReturnValueOnce(old.promise).mockResolvedValueOnce(prices('second-prices', 4))
  const { result, rerender } = renderHook(({ id }) => useProductSourcePrices(id), { initialProps: { id: 'old-prices' } })
  rerender({ id: 'second-prices' })
  await waitFor(() => expect(result.current.comparison?.ProductNetId).toBe('second-prices'))
  await act(async () => old.reject(new Error('retired failure')))
  expect(result.current.error).toBeNull()
})
