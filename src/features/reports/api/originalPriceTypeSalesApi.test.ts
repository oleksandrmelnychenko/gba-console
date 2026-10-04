import { expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { salesCapability, salesResponse, salesType } from '../testing/priceTypeSalesFixtures'
import { priceSalesRequest } from '../data/originalPriceTypeSales'
import { getPriceSalesCapability, getPriceSalesTypes, readPriceSales } from './originalPriceTypeSalesApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
it('own capability named type lookup and nondedup preview carry the exact caller signal and full request', async () => {
  vi.clearAllMocks(); const stop = new AbortController(), r = salesResponse(), request = priceSalesRequest(salesCapability, r.From, r.Through, salesType, { Counterparties: [], Products: [], Projects: [], Divisions: [] })
  const names = [{ Key: salesType, Caption: 'Наш тип ціни' }]; vi.mocked(apiRequest).mockResolvedValueOnce(salesCapability).mockResolvedValueOnce(names).mockResolvedValueOnce(r)
  expect(await getPriceSalesCapability(stop.signal)).toEqual(salesCapability); expect(apiRequest).toHaveBeenLastCalledWith('/report/originals/price-type-sales/capabilities', { signal: stop.signal })
  expect(await getPriceSalesTypes(stop.signal)).toEqual(names); expect(apiRequest).toHaveBeenLastCalledWith('/report/originals/price-type-sales/price-types', { signal: stop.signal })
  expect(await readPriceSales(request, stop.signal)).toEqual(r); expect(apiRequest).toHaveBeenLastCalledWith('/report/originals/price-type-sales/preview', { method: 'POST', body: request, dedupe: false, signal: stop.signal })
})
it('foreign capability unnamed raw type references and a forged four-selector result never reach the screen', async () => {
  vi.clearAllMocks(); vi.mocked(apiRequest).mockResolvedValueOnce({ ...salesCapability, World: 'amg' }); await expect(getPriceSalesCapability()).rejects.toThrow()
  vi.mocked(apiRequest).mockResolvedValueOnce([{ Key: salesType, Caption: '' }]); await expect(getPriceSalesTypes()).rejects.toThrow()
  vi.mocked(apiRequest).mockResolvedValueOnce({ ...salesResponse(), Projects: ['F'.repeat(32)] }); await expect(readPriceSales(priceSalesRequest(salesCapability, '2026-09-10', '2026-09-12', salesType, { Counterparties: [], Products: [], Projects: [], Divisions: [] }))).rejects.toThrow()
})
