import { expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { fenixCapability, fenixResult, fenixScope } from '../testing/originalFenixDiscountAnalysisFixtures'
import { getFenixDiscountCapability, readFenixDiscountAnalysis } from './originalFenixDiscountAnalysisApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
it('reads own static capability without pretending to call a readiness or choices endpoint', async () => {
  vi.clearAllMocks(); vi.mocked(apiRequest).mockResolvedValue(fenixCapability); const controller = new AbortController()
  expect((await getFenixDiscountCapability(controller.signal)).NormalInputsReadinessVerified).toBe(false)
  expect(apiRequest).toHaveBeenCalledWith('/report/originals/discount-analysis/capabilities', { signal: controller.signal })
})
it('posts the exact detached unfiltered scope with cancellation and dedupe disabled', async () => {
  vi.clearAllMocks(); vi.mocked(apiRequest).mockResolvedValue(fenixResult()); const controller = new AbortController()
  await readFenixDiscountAnalysis(fenixScope(), controller.signal)
  expect(apiRequest).toHaveBeenCalledWith('/report/originals/discount-analysis/preview', { method: 'POST', body: fenixScope(), dedupe: false, signal: controller.signal })
})
it('rejects changed result date and invalid input before network dispatch', async () => {
  vi.clearAllMocks(); vi.mocked(apiRequest).mockResolvedValue({ ...fenixResult(), Through: '2026-10-01' })
  await expect(readFenixDiscountAnalysis(fenixScope())).rejects.toThrow(); vi.clearAllMocks()
  await expect(readFenixDiscountAnalysis({ ...fenixScope(), Through: '' })).rejects.toThrow(); expect(apiRequest).not.toHaveBeenCalled()
})
