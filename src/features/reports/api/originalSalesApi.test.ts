import { expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { salesCapability, salesResponse } from '../testing/originalSalesFixtures'
import { salesRequest } from '../data/originalSales'
import { getSalesCapability, readSales } from './originalSalesApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const q = () => salesRequest(salesCapability, '2026-09-10', '2026-09-12', { Counterparties: [], Products: [], Projects: [], Divisions: [] })
it('own capability and nondedup preview use exact request signal without a price lookup', async () => {
  vi.clearAllMocks(); const stop = new AbortController(), r = salesResponse(); vi.mocked(apiRequest).mockResolvedValueOnce(salesCapability).mockResolvedValueOnce(r)
  expect(await getSalesCapability(stop.signal)).toEqual(salesCapability); expect(apiRequest).toHaveBeenLastCalledWith('/report/originals/sales/capabilities', { signal: stop.signal })
  expect(await readSales(q(), stop.signal)).toEqual(r); expect(apiRequest).toHaveBeenLastCalledWith('/report/originals/sales/preview', { method: 'POST', body: q(), dedupe: false, signal: stop.signal }); expect(apiRequest).toHaveBeenCalledTimes(2)
})
it('foreign capability and forged project filter response are refused', async () => {
  vi.clearAllMocks(); vi.mocked(apiRequest).mockResolvedValueOnce({ ...salesCapability, World: 'amg' }); await expect(getSalesCapability()).rejects.toThrow()
  vi.mocked(apiRequest).mockResolvedValueOnce({ ...salesResponse(), Projects: ['F'.repeat(32)] }); await expect(readSales(q())).rejects.toThrow()
})
