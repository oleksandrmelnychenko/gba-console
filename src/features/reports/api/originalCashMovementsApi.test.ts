import { expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { cashMovementsRequest } from '../data/originalCashMovements'
import { cashMovementsCapability, cashMovementsResponse } from '../testing/originalCashMovementsFixtures'
import { getCashMovementsCapability, readCashMovements } from './originalCashMovementsApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
it('uses fixed-world capability and exact POST body with all eight selectors and original abort signal', async () => {
  vi.clearAllMocks(); const abort = new AbortController(), request = cashMovementsRequest(cashMovementsCapability, '2026-09-10', '2026-09-12')
  vi.mocked(apiRequest).mockResolvedValueOnce(cashMovementsCapability).mockResolvedValueOnce(cashMovementsResponse())
  expect(await getCashMovementsCapability(abort.signal)).toEqual(cashMovementsCapability)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/originals/cash-movements/capabilities', { signal: abort.signal })
  expect((await readCashMovements(request, abort.signal)).Available).toBe(true)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/originals/cash-movements/preview', { method: 'POST', body: request, dedupe: false, signal: abort.signal })
})
it('rejects a foreign original capability instead of enabling a similarly named legacy form', async () => {
  vi.clearAllMocks(); vi.mocked(apiRequest).mockResolvedValue({ ...cashMovementsCapability, World: 'amg' })
  await expect(getCashMovementsCapability()).rejects.toThrow()
})
it('a stale date echo is refused before display or exports', async () => {
  vi.clearAllMocks(); vi.mocked(apiRequest).mockResolvedValue({ ...cashMovementsResponse(), Through: '2026-09-11' })
  await expect(readCashMovements(cashMovementsRequest(cashMovementsCapability, '2026-09-10', '2026-09-12'))).rejects.toThrow()
})
