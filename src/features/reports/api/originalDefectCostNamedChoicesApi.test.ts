import { expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { defectCostRequest } from '../data/originalDefectCost'
import { defectCostCapability, defectCostChoices } from '../testing/originalDefectCostFixtures'
import { readDefectCostChoices } from './originalDefectCostApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
it('loads only ordinary named choices with detached scope original abort signal and no dedupe', async () => {
  vi.clearAllMocks(); const stop = new AbortController(), request = defectCostRequest(defectCostCapability, '2026-09-10', '2026-09-12')
  vi.mocked(apiRequest).mockResolvedValue(defectCostChoices(request)); const result = await readDefectCostChoices(request, stop.signal)
  expect(result.Available).toBe(true); expect(apiRequest).toHaveBeenCalledWith('/report/originals/defect-cost/choices', { method: 'POST', body: request, dedupe: false, signal: stop.signal })
  const body = vi.mocked(apiRequest).mock.calls[0][1]?.body; expect(body).not.toBe(request)
})
it('invalid scope is rejected before named metadata API dispatch', async () => {
  vi.clearAllMocks(); const request = defectCostRequest(defectCostCapability, '2026-09-10', '2026-09-12')
  await expect(readDefectCostChoices({ ...request, Divisions: ['human caption'] })).rejects.toThrow(); expect(apiRequest).not.toHaveBeenCalled()
})
it('foreign echoed scope is rejected after the original named choice response', async () => {
  vi.clearAllMocks(); const request = defectCostRequest(defectCostCapability, '2026-09-10', '2026-09-12')
  vi.mocked(apiRequest).mockResolvedValue({ ...defectCostChoices(request), World: 'amg' }); await expect(readDefectCostChoices(request)).rejects.toThrow()
})
