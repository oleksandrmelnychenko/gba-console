import { expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { lotAnalysisCapability, lotAnalysisResponse } from '../testing/originalLotBalanceAnalysisFixtures'
import { lotAnalysisRequest } from '../data/originalLotBalanceAnalysis'
import { getLotAnalysisCapability, readLotAnalysis } from './originalLotBalanceAnalysisApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
it('uses its fixed-world capability and exact POST scope with original cancellation signal', async () => {
  vi.clearAllMocks(); const stop = new AbortController(), request = lotAnalysisRequest(lotAnalysisCapability, '2026-09-10', '2026-09-12')
  vi.mocked(apiRequest).mockResolvedValueOnce(lotAnalysisCapability).mockResolvedValueOnce(lotAnalysisResponse())
  expect(await getLotAnalysisCapability(stop.signal)).toEqual(lotAnalysisCapability)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/originals/lot-balance-analysis/capabilities', { signal: stop.signal })
  expect((await readLotAnalysis(request, stop.signal)).Available).toBe(true)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/originals/lot-balance-analysis/preview', { method: 'POST', body: request, dedupe: false, signal: stop.signal })
})
it('refuses a foreign-world capability before enabling this original', async () => {
  vi.clearAllMocks(); vi.mocked(apiRequest).mockResolvedValue({ ...lotAnalysisCapability, World: 'amg' })
  await expect(getLotAnalysisCapability()).rejects.toThrow()
})
