import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getOriginalStockAvailabilityCapability, readOriginalStockAvailability } from './originalStockAvailabilityApi'
import { stockCapabilityFixture, stockRequestFixture, stockResultFixture } from '../data/originalStockAvailability.fixtures'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => vi.clearAllMocks())
it('uses exact authenticated fixed-Fenix routes without capability query and keeps caller cancellation on POST', async () => {
  const controller = new AbortController(), request = stockRequestFixture()
  vi.mocked(apiRequest).mockResolvedValueOnce(stockCapabilityFixture()).mockResolvedValueOnce(stockResultFixture(request))
  await getOriginalStockAvailabilityCapability(controller.signal); await readOriginalStockAvailability(request, controller.signal)
  expect(apiRequest).toHaveBeenNthCalledWith(1, '/report/originals/fenix/stock-availability/capabilities', { signal: controller.signal })
  expect(apiRequest).toHaveBeenNthCalledWith(2, '/report/originals/fenix/stock-availability/preview', { method: 'POST', body: request, signal: controller.signal, dedupe: false })
  expect(request.At).toBe('2026-10-06 12:34:56')
})
it('foreign capability and old point result cannot borrow original14 identity', async () => {
  vi.mocked(apiRequest).mockResolvedValueOnce({ ...stockCapabilityFixture(), World: 'amg' })
  await expect(getOriginalStockAvailabilityCapability()).rejects.toThrow()
  vi.mocked(apiRequest).mockResolvedValueOnce({ ...stockResultFixture(), At: '2026-10-06 12:34:57' })
  await expect(readOriginalStockAvailability(stockRequestFixture())).rejects.toThrow()
})
