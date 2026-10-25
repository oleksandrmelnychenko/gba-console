import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../shared/i18n/I18nProvider'
import { getProductByNetId, getProductReservationByNetId } from './api/productsApi'
import type { Product, ProductReservation } from './types'
import { useProductDetailData } from './useProductDetailData'

vi.mock('./api/productsApi', () => ({ getProductByNetId: vi.fn(), getProductReservationByNetId: vi.fn() }))
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}
beforeEach(() => vi.resetAllMocks())
const render = (netId: string | undefined = 'first') => renderHook(({ id }) => useProductDetailData(id), { initialProps: { id: netId }, wrapper: I18nProvider })

it('starts both requests immediately and shows the product before slow reserves', async () => {
  const product = deferred<Product | null>(), reservation = deferred<ProductReservation>()
  vi.mocked(getProductByNetId).mockReturnValue(product.promise)
  vi.mocked(getProductReservationByNetId).mockReturnValue(reservation.promise)
  const { result } = render()
  expect(getProductByNetId).toHaveBeenCalledTimes(1)
  expect(getProductReservationByNetId).toHaveBeenCalledTimes(1)
  await act(async () => product.resolve({ NetUid: 'first', CurrentPrice: 42 }))
  expect(result.current.product?.CurrentPrice).toBe(42)
  expect(result.current.isLoading).toBe(false)
  expect(result.current.reservationLoading).toBe(true)
  await act(async () => reservation.resolve({ TotalReservedUK: 12 }))
  expect(result.current.reservation).toEqual({ TotalReservedUK: 12 })
  expect(result.current.reservationLoading).toBe(false)
})

it('keeps a usable product when reserves fail and retries both on refresh', async () => {
  vi.mocked(getProductByNetId).mockResolvedValue({ NetUid: 'first' })
  vi.mocked(getProductReservationByNetId).mockRejectedValueOnce(new Error('Reserves unavailable'))
  const { result } = render()
  await waitFor(() => expect(result.current.reservationError).toBe('Reserves unavailable'))
  expect(result.current.product?.NetUid).toBe('first')
  expect(result.current.error).toBeNull()
  vi.mocked(getProductReservationByNetId).mockResolvedValue({ TotalReservedUK: 8 })
  await act(async () => result.current.reload())
  expect(result.current.reservation).toEqual({ TotalReservedUK: 8 })
  expect(result.current.reservationError).toBeNull()
  expect(getProductByNetId).toHaveBeenCalledTimes(2)
})

it('aborts both previous requests and ignores late results after switching products', async () => {
  const product = deferred<Product | null>(), reservation = deferred<ProductReservation>()
  vi.mocked(getProductByNetId).mockReturnValueOnce(product.promise).mockResolvedValue({ NetUid: 'second' })
  vi.mocked(getProductReservationByNetId).mockReturnValueOnce(reservation.promise).mockResolvedValue({ TotalReservedUK: 2 })
  const { result, rerender, unmount } = render()
  const productSignal = vi.mocked(getProductByNetId).mock.calls[0][1]
  const reserveSignal = vi.mocked(getProductReservationByNetId).mock.calls[0][1]
  rerender({ id: 'second' })
  expect(productSignal?.aborted).toBe(true)
  expect(reserveSignal?.aborted).toBe(true)
  await waitFor(() => expect(result.current.product?.NetUid).toBe('second'))
  await act(async () => { product.resolve({ NetUid: 'first' }); reservation.resolve({ TotalReservedUK: 999 }) })
  expect(result.current.product?.NetUid).toBe('second')
  expect(result.current.reservation.TotalReservedUK).toBe(2)
  unmount()
  expect(vi.mocked(getProductByNetId).mock.calls.at(-1)?.[1]?.aborted).toBe(true)
})

it('clears the previous product while a new product loads and reports product failure', async () => {
  const next = deferred<Product | null>()
  vi.mocked(getProductByNetId).mockResolvedValueOnce({ NetUid: 'first' }).mockReturnValueOnce(next.promise)
  vi.mocked(getProductReservationByNetId).mockResolvedValue({})
  const { result, rerender } = render()
  await waitFor(() => expect(result.current.product?.NetUid).toBe('first'))
  rerender({ id: 'second' })
  expect(result.current.product).toBeNull()
  await act(async () => next.reject(new Error('Product unavailable')))
  expect(result.current.isLoading).toBe(false)
  expect(result.current.error).toBe('Product unavailable')
})

it('does not request an absent product and accepts an edited product snapshot', async () => {
  const { result, rerender } = render('')
  expect(getProductByNetId).not.toHaveBeenCalled()
  vi.mocked(getProductByNetId).mockResolvedValue({ NetUid: 'first' })
  vi.mocked(getProductReservationByNetId).mockResolvedValue({})
  rerender({ id: 'first' })
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  act(() => result.current.setProduct({ NetUid: 'first', Description: 'Edited' }))
  expect(result.current.product?.Description).toBe('Edited')
  expect(getProductByNetId).toHaveBeenCalledTimes(1)
})
