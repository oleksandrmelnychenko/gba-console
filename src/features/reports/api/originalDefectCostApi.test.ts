import { expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { defectCostCapability, defectCostResponse } from '../testing/originalDefectCostFixtures'
import { defectCostRequest } from '../data/originalDefectCost'
import { getDefectCostCapability, readDefectCost } from './originalDefectCostApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
it('uses only own capability and POST preview with detached exact scope and original signal', async () => {
  vi.clearAllMocks(); const stop = new AbortController(), request = defectCostRequest(defectCostCapability, '2026-09-10', '2026-09-12')
  vi.mocked(apiRequest).mockResolvedValueOnce(defectCostCapability).mockResolvedValueOnce(defectCostResponse())
  expect(await getDefectCostCapability(stop.signal)).toEqual(defectCostCapability)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/originals/defect-cost/capabilities', { signal: stop.signal })
  expect((await readDefectCost(request, stop.signal)).Available).toBe(true)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/originals/defect-cost/preview', { method: 'POST', body: request, dedupe: false, signal: stop.signal })
})
it('rejects the custom defect ratio or a foreign capability instead of substituting its wire', async () => {
  vi.clearAllMocks(); vi.mocked(apiRequest).mockResolvedValue({ ...defectCostCapability, SourceId: 'another-source', World: 'amg' })
  await expect(getDefectCostCapability()).rejects.toThrow()
})
it('invalid selector input is refused before API dispatch', async () => {
  vi.clearAllMocks(); const request = defectCostRequest(defectCostCapability, '2026-09-10', '2026-09-12')
  await expect(readDefectCost({ ...request, Divisions: ['human caption'] })).rejects.toThrow()
  expect(apiRequest).not.toHaveBeenCalled()
})
