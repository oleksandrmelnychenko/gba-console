import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { CASH_MOVEMENT_DEFINITIONS, createCashMovementRequest } from '../data/cashMovement'
import { cashMovementCapability, cashMovementReport } from '../data/cashMovement.test-fixtures'
import { getCashMovementCapabilities, previewCashMovement } from './cashMovementApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => api.mockReset())
it.each(['receipts', 'payouts'] as const)('uses exact %s capability and one preview with caller cancellation', async kind => {
  const capability = cashMovementCapability(kind), report = cashMovementReport(kind), controller = new AbortController()
  api.mockResolvedValueOnce(capability).mockResolvedValueOnce(report)
  expect(await getCashMovementCapabilities(kind, controller.signal)).toEqual(capability)
  expect(await previewCashMovement(capability, report.Period, controller.signal)).toBe(report)
  expect(api).toHaveBeenNthCalledWith(1, `${CASH_MOVEMENT_DEFINITIONS[kind].Route}/capabilities`, { signal: controller.signal, dedupe: false })
  expect(api).toHaveBeenNthCalledWith(2, `${CASH_MOVEMENT_DEFINITIONS[kind].Route}/preview`, {
    method: 'POST', body: createCashMovementRequest(capability, report.Period), signal: controller.signal, dedupe: false,
  })
  expect(api).toHaveBeenCalledTimes(2)
})
it('rejects wrong capability and invalid period before submission', async () => {
  api.mockResolvedValueOnce(cashMovementCapability('payouts'))
  await expect(getCashMovementCapabilities('receipts')).rejects.toThrow('цієї форми')
  api.mockReset()
  await expect(previewCashMovement({ ...cashMovementCapability(), Executable: false }, '2026-Q3')).rejects.toThrow('Сервер не підтвердив')
  await expect(previewCashMovement(cashMovementCapability(), '2026-09')).rejects.toThrow('Оберіть допустимий')
  expect(api).not.toHaveBeenCalled()
})
it('refuses stale periods and does not retry an ambiguous or refused calculation', async () => {
  api.mockResolvedValueOnce(cashMovementReport('receipts', '2026-Q2'))
  await expect(previewCashMovement(cashMovementCapability(), '2026-Q3')).rejects.toThrow('іншу форму чи період')
  api.mockRejectedValueOnce(new Error('Refused'))
  await expect(previewCashMovement(cashMovementCapability(), '2026-Q3')).rejects.toThrow('Refused')
  expect(api).toHaveBeenCalledTimes(2)
})
