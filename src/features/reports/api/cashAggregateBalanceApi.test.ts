import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { cashAggregateCapability, cashAggregateReport } from '../data/cashAggregateBalance.test-fixtures'
import { getCashAggregateBalanceCapabilities, previewCashAggregateBalance } from './cashAggregateBalanceApi'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => api.mockReset())
it('uses the dedicated capability and one caller-isolated explicit date request for grouped cells and both files', async () => {
  const capability = cashAggregateCapability(), result = cashAggregateReport(), controller = new AbortController()
  api.mockResolvedValueOnce(capability).mockResolvedValueOnce(result)
  expect(await getCashAggregateBalanceCapabilities(controller.signal)).toBe(capability)
  expect(await previewCashAggregateBalance(capability, '2026-09-30')).toBe(result)
  expect(api).toHaveBeenNthCalledWith(1, '/report/constructors/cash-aggregate-balance/capabilities', { signal: controller.signal })
  expect(api).toHaveBeenNthCalledWith(2, '/report/constructors/cash-aggregate-balance/preview', { method: 'POST', dedupe: false,
    body: { Version: 1, SourceIdentity: capability.SourceIdentity, Period: '2026-09-30' } })
  expect(api).toHaveBeenCalledTimes(2)
})
it('does no request for a non-date period or unexecutable capability', async () => {
  await expect(previewCashAggregateBalance(cashAggregateCapability(), '2026-Q3')).rejects.toThrow('Оберіть дату')
  await expect(previewCashAggregateBalance({ ...cashAggregateCapability(), Executable: false }, '2026-09-30')).rejects.toThrow('Сервер не підтвердив')
  expect(api).not.toHaveBeenCalled()
})
it('rejects another constructor identity or mismatched account comparison dates including export links', async () => {
  api.mockResolvedValueOnce({ ...cashAggregateCapability(), SourceIdentity: { World: 'fenix', SourceId: 'native:40', DefinitionSha256: 'a'.repeat(64) } })
  await expect(getCashAggregateBalanceCapabilities()).rejects.toThrow('Сервер не підтвердив')
  api.mockResolvedValueOnce(cashAggregateReport('2026-09-29'))
  await expect(previewCashAggregateBalance(cashAggregateCapability(), '2026-09-30')).rejects.toThrow('некоректний результат')
})
