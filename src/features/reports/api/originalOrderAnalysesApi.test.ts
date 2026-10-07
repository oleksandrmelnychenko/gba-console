import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getOriginalOrderAnalysisCapability, readOriginalOrderAnalysisChoices, readOriginalOrderAnalyses } from './originalOrderAnalysesApi'
import { orderCapabilityFixture, orderChoicesWireFixture, orderRequestFixture, orderResultWireFixture } from '../data/originalOrderAnalyses.fixtures'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => vi.clearAllMocks())
it.each([0, 1, 2] as const)('kind %s uses dedicated permission-routed OUR capability choices and preview with exact scope', async kind => {
  const request = orderRequestFixture(kind), signal = new AbortController().signal
  vi.mocked(apiRequest).mockResolvedValueOnce(orderCapabilityFixture(kind)).mockResolvedValueOnce(orderChoicesWireFixture(request)).mockResolvedValueOnce(orderResultWireFixture(request))
  await getOriginalOrderAnalysisCapability(kind, signal); await readOriginalOrderAnalysisChoices(request, signal); await readOriginalOrderAnalyses(request, signal)
  expect(apiRequest).toHaveBeenNthCalledWith(1, `/report/originals/order-analyses/capabilities?world=fenix&kind=${kind}`, { signal })
  expect(apiRequest).toHaveBeenNthCalledWith(2, '/report/originals/order-analyses/choices', { method: 'POST', body: request, signal, dedupe: false })
  expect(apiRequest).toHaveBeenNthCalledWith(3, '/report/originals/order-analyses/preview', { method: 'POST', body: request, signal, dedupe: false })
})
it('rejects capability from another report and stale choices from a different inclusive endpoint', async () => {
  vi.mocked(apiRequest).mockResolvedValueOnce(orderCapabilityFixture(2)).mockResolvedValueOnce(orderChoicesWireFixture({ ...orderRequestFixture(), Through: '2026-10-05' }))
  await expect(getOriginalOrderAnalysisCapability(1)).rejects.toThrow(); await expect(readOriginalOrderAnalysisChoices(orderRequestFixture())).rejects.toThrow()
})
