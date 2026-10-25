import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { RecommendationProduct } from '../../recommendationsTypes'
const mocks = vi.hoisted(() => ({ client: vi.fn(), related: vi.fn(), seed: vi.fn(), t: (text: string) => text }))
vi.mock('../../api/clientRecommendationsApi', () => ({ getMostPurchasedProductsByClientId: mocks.client,
  getProductCoPurchaseRecommendations: mocks.related, getProductById: mocks.seed }))
vi.mock('../../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: mocks.t }) }))
import { useRecommendationsData } from './useRecommendationsData'
const props = { agreementNetId: 'a', clientNetId: 'c', productNetId: 'seed' }
const rows = [{ NetUid: 'one', Name: 'One' }, { NetUid: 'two', Name: 'Two' }]
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(next => { resolve = next })
  return { promise, resolve }
}
beforeEach(() => {
  mocks.client.mockReset().mockResolvedValue(rows)
  mocks.related.mockReset().mockResolvedValue(rows)
  mocks.seed.mockReset().mockResolvedValue({ NetUid: 'seed' })
})
it('shows recommendations before the seed and preserves selection when the seed arrives', async () => {
  const seed = deferred<RecommendationProduct>()
  mocks.seed.mockReturnValue(seed.promise)
  const { result, rerender } = renderHook(useRecommendationsData, { initialProps: props })
  await waitFor(() => expect(result.current.state.isLoading).toBe(false))
  expect(result.current.state.products).toBe(rows)
  act(() => result.current.dispatch({ type: 'toggleSelected', key: 'one' }))
  await act(async () => seed.resolve({ NetUid: 'seed', Name: 'Seed' }))
  expect(result.current.state.selectedProduct?.Name).toBe('Seed')
  expect(result.current.state.selectedKeys.has('one')).toBe(true)
  rerender({ ...props })
  expect(mocks.related).toHaveBeenCalledOnce()
  expect(mocks.seed).toHaveBeenCalledOnce()
  act(() => result.current.dispatch({ type: 'removeProduct', key: 'one' }))
  expect(result.current.state.selectedKeys.size).toBe(0)
  expect(result.current.state.products).toEqual([rows[1]])
})
it('keeps recommendations usable if the supplementary seed lookup fails', async () => {
  mocks.seed.mockRejectedValue(new Error('seed unavailable'))
  const { result } = renderHook(useRecommendationsData, { initialProps: props })
  await waitFor(() => expect(result.current.state.isLoading).toBe(false))
  expect(result.current.state.error).toBeNull()
  expect(result.current.state.products).toBe(rows)
})
it.each(['agreementNetId', 'clientNetId', 'productNetId'] as const)('retires both reads and selection on %s change', async field => {
  const seed = deferred<RecommendationProduct>(), related = deferred<RecommendationProduct[]>()
  mocks.seed.mockReturnValueOnce(seed.promise)
  mocks.related.mockReturnValueOnce(related.promise)
  const { result, rerender, unmount } = renderHook(useRecommendationsData, { initialProps: props })
  const signal = mocks.seed.mock.calls[0][1] as AbortSignal
  expect(mocks.related.mock.calls[0][3].signal).toBe(signal)
  rerender({ ...props, [field]: 'new' })
  await waitFor(() => expect(result.current.state.products).toBe(rows))
  await act(async () => { seed.resolve({ Name: 'stale seed' }); related.resolve([{ Name: 'stale row' }]) })
  expect(signal.aborted).toBe(true)
  expect(result.current.state.products).toBe(rows)
  expect(result.current.state.selectedProduct?.Name).not.toBe('stale seed')
  const currentSignal = mocks.related.mock.calls[1][3].signal as AbortSignal
  unmount()
  expect(currentSignal.aborted).toBe(true)
})
it('uses only the client endpoint without a seed and reports recommendation failures', async () => {
  mocks.client.mockRejectedValueOnce(new Error('offline'))
  const { result } = renderHook(() => useRecommendationsData({ agreementNetId: 'a', clientNetId: 'c' }))
  await waitFor(() => expect(result.current.state.error).toBe('offline'))
  expect(mocks.client).toHaveBeenCalledOnce()
  expect(mocks.related).not.toHaveBeenCalled()
  expect(mocks.seed).not.toHaveBeenCalled()
  expect(result.current.state.products).toEqual([])
})
