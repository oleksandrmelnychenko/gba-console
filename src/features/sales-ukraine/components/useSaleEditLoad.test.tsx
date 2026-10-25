import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useSaleEditLoad } from './useSaleEditLoad'

const mocks = vi.hoisted(() => ({ load: vi.fn(), t: (value: string) => value }))
vi.mock('../api/salesUkraineApi', () => ({ getShiftedSaleById: mocks.load }))
vi.mock('../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: mocks.t }) }))
beforeEach(() => { mocks.load.mockReset(); mocks.t = value => value })
afterEach(cleanup)

it('uses the latest error translation and observer without restarting a pending read', async () => {
  let resolve!: (value: null) => void
  mocks.load.mockReturnValue(new Promise<null>(done => { resolve = done }))
  const first = vi.fn()
  const latest = vi.fn()
  const { rerender } = renderHook(({ dispatch }) => useSaleEditLoad('sale-1', dispatch), { initialProps: { dispatch: first } })
  mocks.t = () => 'translated failure'
  rerender({ dispatch: latest })
  await act(async () => resolve(null))
  expect(mocks.load).toHaveBeenCalledOnce()
  expect(first).toHaveBeenCalledExactlyOnceWith({ type: 'loadStarted' })
  expect(latest).toHaveBeenCalledExactlyOnceWith({ type: 'loadFailed', error: 'translated failure' })
})

it('reports a read error and retries with fresh data when the edit session reopens', async () => {
  mocks.load.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ NetUid: 'sale-1' })
  const dispatch = vi.fn()
  const first = renderHook(() => useSaleEditLoad('sale-1', dispatch))
  await act(async () => {})
  expect(dispatch).toHaveBeenLastCalledWith({ type: 'loadFailed', error: 'offline' })
  first.unmount()
  renderHook(() => useSaleEditLoad('sale-1', dispatch))
  await act(async () => {})
  expect(mocks.load).toHaveBeenCalledTimes(2)
  expect(dispatch).toHaveBeenLastCalledWith({ type: 'loadSucceeded', sale: { NetUid: 'sale-1' } })
})
