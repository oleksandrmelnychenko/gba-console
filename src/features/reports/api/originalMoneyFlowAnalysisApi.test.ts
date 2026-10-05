import { expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { moneyFlowRequest } from '../data/originalMoneyFlowAnalysis'
import { moneyFlowCapability, moneyFlowResponse } from '../testing/originalMoneyFlowAnalysisFixtures'
import { getMoneyFlowCapability, readMoneyFlow } from './originalMoneyFlowAnalysisApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
it('uses fixed Fenix routes, exact four-default POST scope and the original abort signal', async () => {
  vi.clearAllMocks(); const abort = new AbortController(), request = moneyFlowRequest(moneyFlowCapability, '2026-09-10', '2026-09-12')
  vi.mocked(apiRequest).mockResolvedValueOnce(moneyFlowCapability).mockResolvedValueOnce(moneyFlowResponse())
  expect(await getMoneyFlowCapability(abort.signal)).toEqual(moneyFlowCapability)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/originals/money-flow-analysis/capabilities', { signal: abort.signal })
  expect((await readMoneyFlow(request, abort.signal)).Available).toBe(true)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/originals/money-flow-analysis/preview', { method: 'POST', body: request, dedupe: false, signal: abort.signal })
})
it('foreign capabilities and stale preview scopes are refused before screen or completed files', async () => {
  vi.clearAllMocks(); vi.mocked(apiRequest).mockResolvedValue({ ...moneyFlowCapability, World: 'amg' })
  await expect(getMoneyFlowCapability()).rejects.toThrow()
  vi.mocked(apiRequest).mockResolvedValue({ ...moneyFlowResponse(), From: '2026-09-09' })
  await expect(readMoneyFlow(moneyFlowRequest(moneyFlowCapability, '2026-09-10', '2026-09-12'))).rejects.toThrow()
})
