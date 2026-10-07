import { expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { wipCapability, wipResult } from '../testing/originalWorkInProgressFixtures'
import { wipRequest } from '../data/originalWorkInProgress'
import { getWipCapability, readWip } from './originalWorkInProgressApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const q = () => wipRequest(wipCapability, '2026-09-01', '2026-09-30', { Divisions: [], ProductGroups: [], CostArticles: [] })
it('own capability and nondedup preview use exact request signal without a price lookup', async () => {
  vi.clearAllMocks(); const stop = new AbortController(), r = wipResult(); vi.mocked(apiRequest).mockResolvedValueOnce(wipCapability).mockResolvedValueOnce(r)
  expect(await getWipCapability(stop.signal)).toEqual(wipCapability); expect(apiRequest).toHaveBeenLastCalledWith('/report/originals/work-in-progress/capabilities', { signal: stop.signal })
  expect(await readWip(q(), stop.signal)).toEqual(r); expect(apiRequest).toHaveBeenLastCalledWith('/report/originals/work-in-progress/preview', { method: 'POST', body: q(), dedupe: false, signal: stop.signal }); expect(apiRequest).toHaveBeenCalledTimes(2)
})
it('foreign capability and forged article filter response are refused', async () => {
  vi.clearAllMocks(); vi.mocked(apiRequest).mockResolvedValueOnce({ ...wipCapability, World: 'amg' }); await expect(getWipCapability()).rejects.toThrow()
  vi.mocked(apiRequest).mockResolvedValueOnce({ ...wipResult(), CostArticles: ['F'.repeat(32)] }); await expect(readWip(q())).rejects.toThrow()
})
