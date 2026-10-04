import { expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { debtCapability, debtResponse } from '../testing/counterpartyDebtFixtures'
import { debtRequest } from '../data/originalCounterpartyDebt'
import { getDebtCapability, readDebt } from './originalCounterpartyDebtApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
it('capability route is own Fenix original with no native dataset alias', async () => {
  vi.mocked(apiRequest).mockResolvedValue(debtCapability); const signal = new AbortController().signal
  expect(await getDebtCapability(signal)).toEqual(debtCapability); expect(apiRequest).toHaveBeenLastCalledWith('/report/originals/counterparty-debt/capabilities', { signal })
})
it('preview carries exact scope only in body and disables cross-attempt dedupe', async () => {
  const request = debtRequest(debtCapability, debtResponse().AsOf), signal = new AbortController().signal
  vi.mocked(apiRequest).mockResolvedValue(debtResponse()); await readDebt(request, signal)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/originals/counterparty-debt/preview', { method: 'POST', body: request, dedupe: false, signal })
})
