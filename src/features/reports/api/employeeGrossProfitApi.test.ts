import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { createEmployeeGrossProfitRequest } from '../data/employeeGrossProfit'
import { employeeGrossProfitCapability, employeeGrossProfitReport } from '../data/employeeGrossProfit.test-fixtures'
import { getEmployeeGrossProfitCapabilities, previewEmployeeGrossProfit } from './employeeGrossProfitApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => api.mockReset())
it('uses exact employee capability and one authorized monthly preview with caller cancellation', async () => {
  const capability = employeeGrossProfitCapability(), report = employeeGrossProfitReport(), controller = new AbortController()
  api.mockResolvedValueOnce(capability).mockResolvedValueOnce(report)
  expect(await getEmployeeGrossProfitCapabilities(controller.signal)).toEqual(capability)
  expect(await previewEmployeeGrossProfit(capability, report.Month, controller.signal)).toBe(report)
  expect(api).toHaveBeenNthCalledWith(1, '/report/constructors/employee-gross-profit/capabilities', { signal: controller.signal, dedupe: false })
  expect(api).toHaveBeenNthCalledWith(2, '/report/constructors/employee-gross-profit/preview', { method: 'POST',
    body: createEmployeeGrossProfitRequest(capability, report.Month), signal: controller.signal, dedupe: false })
  expect(api).toHaveBeenCalledTimes(2)
})
it('does not submit an invalid period or unimplemented capability', async () => {
  await expect(previewEmployeeGrossProfit({ ...employeeGrossProfitCapability(), RuntimeImplemented: false }, '2026-09')).rejects.toThrow('Сервер не підтвердив')
  await expect(previewEmployeeGrossProfit(employeeGrossProfitCapability(), '2026-Q3')).rejects.toThrow('Оберіть допустимий')
  expect(api).not.toHaveBeenCalled()
})
it('refuses another period and does not retry refused or ambiguous previews', async () => {
  api.mockResolvedValueOnce(employeeGrossProfitReport('2026-08'))
  await expect(previewEmployeeGrossProfit(employeeGrossProfitCapability(), '2026-09')).rejects.toThrow('інший місячний період')
  api.mockRejectedValueOnce(new Error('Refused'))
  await expect(previewEmployeeGrossProfit(employeeGrossProfitCapability(), '2026-09')).rejects.toThrow('Refused')
  expect(api).toHaveBeenCalledTimes(2)
})
