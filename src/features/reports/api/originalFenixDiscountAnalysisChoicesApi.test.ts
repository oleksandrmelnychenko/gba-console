import { expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getFenixDiscountReadiness, readFenixDiscountAnalysis, readFenixDiscountChoices } from './originalFenixDiscountAnalysisApi'
import { selectedFenixDiscountRequest } from '../data/originalFenixDiscountAnalysisChoices'
import { fenixNames, fenixReadiness } from '../testing/originalFenixDiscountAnalysisChoicesFixtures'
import { fenixParty, fenixResult, fenixScope } from '../testing/originalFenixDiscountAnalysisFixtures'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
it('uses only own readiness and choices routes with the original abort signal and independent raw selector echo', async () => {
  vi.clearAllMocks(); const controller = new AbortController(); vi.mocked(apiRequest).mockResolvedValueOnce(fenixReadiness()).mockResolvedValueOnce(fenixNames())
  await getFenixDiscountReadiness(controller.signal); await readFenixDiscountChoices(fenixScope(), controller.signal)
  expect(apiRequest).toHaveBeenNthCalledWith(1, '/report/originals/discount-analysis/readiness', { signal: controller.signal })
  expect(apiRequest).toHaveBeenNthCalledWith(2, '/report/originals/discount-analysis/choices', { method: 'POST', body: fenixScope(), dedupe: false, signal: controller.signal })
})
it('forwards the selected current witness to preview and refuses a response from an earlier witness', async () => {
  vi.clearAllMocks(); const request = selectedFenixDiscountRequest(fenixScope().Through, { Контрагент: [fenixParty], Номенклатура: [] }, fenixNames())
  vi.mocked(apiRequest).mockResolvedValueOnce(fenixResult(request)).mockResolvedValueOnce({ ...fenixResult(request), ChoicesWitnessSha256: 'e'.repeat(64) })
  await readFenixDiscountAnalysis(request); expect(vi.mocked(apiRequest).mock.calls[0][1]?.body).toEqual(request)
  await expect(readFenixDiscountAnalysis(request)).rejects.toThrow()
})
