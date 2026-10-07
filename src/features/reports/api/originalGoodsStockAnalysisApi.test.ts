import { expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { goodsAnalysisCapability, goodsAnalysisResponse } from '../testing/originalGoodsStockAnalysisFixtures'
import { goodsAnalysisRequest } from '../data/originalGoodsStockAnalysis'
import { getGoodsAnalysisCapability, readGoodsAnalysis } from './originalGoodsStockAnalysisApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
it('uses its fixed-world capability and exact POST scope with original cancellation signal', async () => {
  vi.clearAllMocks(); const stop = new AbortController(), request = goodsAnalysisRequest(goodsAnalysisCapability, '2026-09-10', '2026-09-12')
  vi.mocked(apiRequest).mockResolvedValueOnce(goodsAnalysisCapability).mockResolvedValueOnce(goodsAnalysisResponse())
  expect(await getGoodsAnalysisCapability(stop.signal)).toEqual(goodsAnalysisCapability)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/originals/goods-stock-analysis/capabilities', { signal: stop.signal })
  expect((await readGoodsAnalysis(request, stop.signal)).Available).toBe(true)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/originals/goods-stock-analysis/preview', { method: 'POST', body: request, dedupe: false, signal: stop.signal })
})
it('refuses a foreign-world capability before enabling this original', async () => {
  vi.clearAllMocks(); vi.mocked(apiRequest).mockResolvedValue({ ...goodsAnalysisCapability, World: 'amg' })
  await expect(getGoodsAnalysisCapability()).rejects.toThrow()
})
