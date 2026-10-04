import { expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { statementCapability, statementResponse } from '../testing/counterpartyStatementFixtures'
import { statementRequest } from '../data/originalCounterpartyStatement'
import { getStatementCapability, readStatement } from './originalCounterpartyStatementApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
it('own capability and non-dedup preview use exact routes original signal and full three-filter request', async () => {
  vi.clearAllMocks(); const stop = new AbortController(), r = statementResponse(), request = statementRequest(statementCapability, r.From, r.Through)
  vi.mocked(apiRequest).mockResolvedValueOnce(statementCapability).mockResolvedValueOnce(r)
  expect(await getStatementCapability(stop.signal)).toEqual(statementCapability)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/originals/counterparty-statement/capabilities', { signal: stop.signal })
  expect(await readStatement(request, stop.signal)).toEqual(r)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/originals/counterparty-statement/preview', { method: 'POST', body: request, dedupe: false, signal: stop.signal })
})
it('foreign capabilities and mismatched filter responses never reach the statement screen', async () => {
  vi.clearAllMocks(); vi.mocked(apiRequest).mockResolvedValueOnce({ ...statementCapability, World: 'amg' })
  await expect(getStatementCapability()).rejects.toThrow()
  vi.mocked(apiRequest).mockResolvedValueOnce({ ...statementResponse(), Agreements: ['F'.repeat(32)] })
  await expect(readStatement(statementRequest(statementCapability, '2026-09-10', '2026-09-12'))).rejects.toThrow()
})
