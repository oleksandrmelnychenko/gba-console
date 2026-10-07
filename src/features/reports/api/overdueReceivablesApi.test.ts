import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { createOverdueReceivablesRequest } from '../data/overdueReceivables'
import { overdueReceivablesCapability, overdueReceivablesReport } from '../data/overdueReceivables.test-fixtures'
import { getOverdueReceivablesCapabilities, previewOverdueReceivables } from './overdueReceivablesApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => api.mockReset())
it('uses exact overdue capability and one authorized monthly preview with caller cancellation', async () => {
  const capability = overdueReceivablesCapability(), report = overdueReceivablesReport(), controller = new AbortController()
  api.mockResolvedValueOnce(capability).mockResolvedValueOnce(report)
  expect(await getOverdueReceivablesCapabilities(controller.signal)).toEqual(capability)
  expect(await previewOverdueReceivables(capability, report.Month, controller.signal)).toBe(report)
  expect(api).toHaveBeenNthCalledWith(1, '/report/constructors/overdue-receivables/capabilities', { signal: controller.signal, dedupe: false })
  expect(api).toHaveBeenNthCalledWith(2, '/report/constructors/overdue-receivables/preview', { method: 'POST',
    body: createOverdueReceivablesRequest(capability, report.Month), signal: controller.signal, dedupe: false })
  expect(api).toHaveBeenCalledTimes(2)
})
it('does not submit an invalid period or unimplemented capability', async () => {
  await expect(previewOverdueReceivables({ ...overdueReceivablesCapability(), RuntimeImplemented: false }, '2026-09')).rejects.toThrow('Сервер не підтвердив')
  await expect(previewOverdueReceivables(overdueReceivablesCapability(), '2026-Q3')).rejects.toThrow('Оберіть допустимий')
  expect(api).not.toHaveBeenCalled()
})
it('refuses another period and does not retry refused or ambiguous previews', async () => {
  api.mockResolvedValueOnce(overdueReceivablesReport('2026-08'))
  await expect(previewOverdueReceivables(overdueReceivablesCapability(), '2026-09')).rejects.toThrow('інший місячний період')
  api.mockRejectedValueOnce(new Error('Refused'))
  await expect(previewOverdueReceivables(overdueReceivablesCapability(), '2026-09')).rejects.toThrow('Refused')
  expect(api).toHaveBeenCalledTimes(2)
})
