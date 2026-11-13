import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '../../shared/api/apiClient'
import { loadProcurementWithRetry, procurementLoadError, procurementRetryNotice } from './procurementLoadError'

const t = (value: string) => value
const preparing = () => new ApiError('План закупівлі ще готується. Повторіть запит за хвилину.', 503, null)

beforeEach(() => { vi.useFakeTimers(); vi.spyOn(console, 'warn').mockImplementation(() => {}) })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

it('shows the server message of a 503 and a Ukrainian text when the server sent a code', () => {
  expect(procurementLoadError(preparing(), 'fallback', t)).toBe('План закупівлі ще готується. Повторіть запит за хвилину.')
  expect(procurementLoadError(Object.assign(new Error('cart_business_data_not_ready'), { status: 503 }), 'fallback', t))
    .toBe('План закупівлі ще готується. Повторіть запит за хвилину.')
  expect(procurementRetryNotice(preparing(), t)).toBe('План закупівлі ще готується. Повторіть запит за хвилину. Автоматично повторимо запит за 20 с.')
})
it('keeps the Ukrainian generic text for other failures', () => {
  expect(procurementLoadError(new ApiError('Internal Server Error', 500, null), 'Не вдалося сформувати план закупівлі', t)).toBe('Не вдалося сформувати план закупівлі')
})
it('retries a preparing plan once after 20 seconds', async () => {
  const load = vi.fn().mockRejectedValueOnce(preparing()).mockResolvedValueOnce('plan')
  const onPreparing = vi.fn()
  const result = loadProcurementWithRetry(load, new AbortController().signal, onPreparing)
  await vi.advanceTimersByTimeAsync(19_999)
  expect(onPreparing).toHaveBeenCalledOnce()
  expect(load).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(1)
  await expect(result).resolves.toBe('plan')
  expect(load).toHaveBeenCalledTimes(2)
})
it('gives up after the single retry and does not retry other failures', async () => {
  const again = preparing()
  const load = vi.fn().mockRejectedValueOnce(preparing()).mockRejectedValueOnce(again)
  const result = loadProcurementWithRetry(load, new AbortController().signal, () => {})
  const settled = expect(result).rejects.toBe(again)
  await vi.advanceTimersByTimeAsync(20_000)
  await settled
  expect(load).toHaveBeenCalledTimes(2)
  const other = vi.fn().mockRejectedValue(new ApiError('boom', 500, null))
  await expect(loadProcurementWithRetry(other, new AbortController().signal, () => {})).rejects.toThrow('boom')
  expect(other).toHaveBeenCalledOnce()
})
it('stops waiting when the request is aborted', async () => {
  const controller = new AbortController()
  const load = vi.fn().mockRejectedValue(preparing())
  const result = loadProcurementWithRetry(load, controller.signal, () => {})
  const settled = expect(result).rejects.toBeInstanceOf(ApiError)
  await vi.advanceTimersByTimeAsync(5)
  controller.abort()
  await settled
  await vi.advanceTimersByTimeAsync(30_000)
  expect(load).toHaveBeenCalledOnce()
})
