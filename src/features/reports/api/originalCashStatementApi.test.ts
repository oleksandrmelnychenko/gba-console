import { expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { cashRequest } from '../data/originalCashStatement'
import { cashCapabilityFixture, cashResultFixture } from '../data/originalCashStatement.fixtures'
import { getOriginalCashCapability, readOriginalCashStatement } from './originalCashStatementApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
it('own capability and closed full period request use dedicated cash route with original abort signal', async () => {
  vi.clearAllMocks(); const capability = cashCapabilityFixture(), request = cashRequest(capability, '2026-09-01', '2026-09-30', [], false), signal = new AbortController().signal
  vi.mocked(apiRequest).mockResolvedValueOnce(capability).mockResolvedValueOnce(cashResultFixture())
  expect(await getOriginalCashCapability(signal)).toEqual(capability); expect(await readOriginalCashStatement(request, signal)).toMatchObject({ Available: true })
  expect(apiRequest).toHaveBeenNthCalledWith(1, '/report/originals/cash-statement/capabilities?world=fenix', { signal })
  expect(apiRequest).toHaveBeenNthCalledWith(2, '/report/originals/cash-statement/preview', { method: 'POST', body: request, signal, dedupe: false })
})
it('transport refuses substituted original currency conversion and foreign response period', async () => {
  vi.clearAllMocks(); const capability = cashCapabilityFixture(), request = cashRequest(capability, '2026-09-01', '2026-09-30', [], false)
  vi.mocked(apiRequest).mockResolvedValueOnce({ ...capability, AppliesFxConversion: true }).mockResolvedValueOnce({ ...cashResultFixture(), Through: '2026-10-01' })
  await expect(getOriginalCashCapability()).rejects.toThrow(); await expect(readOriginalCashStatement(request)).rejects.toThrow()
})
