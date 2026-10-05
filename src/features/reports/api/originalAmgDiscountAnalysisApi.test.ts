import { expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { amgCapability, amgResult, amgScope } from '../testing/originalAmgDiscountAnalysisFixtures'
import { getAmgDiscountAnalysisCapability, readAmgDiscountAnalysis } from './originalAmgDiscountAnalysisApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
it('reads own static capability without pretending to call a readiness or choices endpoint', async () => {
  vi.clearAllMocks(); vi.mocked(apiRequest).mockResolvedValue(amgCapability); const controller = new AbortController()
  expect((await getAmgDiscountAnalysisCapability(controller.signal)).NormalInputsReadinessVerified).toBe(false)
  expect(apiRequest).toHaveBeenCalledWith('/report/originals/amg/discount-analysis/capabilities', { signal: controller.signal })
})
it('posts the exact detached unfiltered scope with cancellation and dedupe disabled', async () => {
  vi.clearAllMocks(); vi.mocked(apiRequest).mockResolvedValue(amgResult()); const controller = new AbortController()
  await readAmgDiscountAnalysis(amgScope(), controller.signal)
  expect(apiRequest).toHaveBeenCalledWith('/report/originals/amg/discount-analysis/preview', { method: 'POST', body: amgScope(), dedupe: false, signal: controller.signal })
})
it('rejects changed result date and invalid input before network dispatch', async () => {
  vi.clearAllMocks(); vi.mocked(apiRequest).mockResolvedValue({ ...amgResult(), Through: '2026-10-01' })
  await expect(readAmgDiscountAnalysis(amgScope())).rejects.toThrow(); vi.clearAllMocks()
  await expect(readAmgDiscountAnalysis({ ...amgScope(), Through: '' })).rejects.toThrow(); expect(apiRequest).not.toHaveBeenCalled()
})
