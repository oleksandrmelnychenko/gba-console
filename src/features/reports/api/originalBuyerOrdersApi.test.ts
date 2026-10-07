import { expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { capability, response } from '../testing/buyerOrdersFixtures'
import { buyerOrdersRequest } from '../data/originalBuyerOrders'
import { getBuyerOrdersCapability, readBuyerOrders } from './originalBuyerOrdersApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
it('buyerOrders API sends explicit own POST scope without source access or deduplication', async () => {
  vi.clearAllMocks(); vi.mocked(apiRequest).mockResolvedValue(response()); const controller = new AbortController()
  const query = buyerOrdersRequest(capability, '2026-09-01', '2026-09-30'); const result = await readBuyerOrders(query, controller.signal)
  expect(result.Available).toBe(true); expect(apiRequest).toHaveBeenCalledWith('/report/originals/buyer-orders/preview',
    { method: 'POST', body: query, dedupe: false, signal: controller.signal })
})
it('buyerOrders capability refuses a foreign server original before exposing generation', async () => {
  vi.clearAllMocks(); vi.mocked(apiRequest).mockResolvedValue({ ...capability, SourceId: 'other' }); await expect(getBuyerOrdersCapability()).rejects.toThrow()
  expect(apiRequest).toHaveBeenCalledWith('/report/originals/buyer-orders/capabilities?world=fenix', { signal: undefined })
})
