import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { createSalesMarginRequest } from '../data/salesMargin'
import { salesMarginCapability, salesMarginReport } from '../data/salesMargin.test-fixtures'
import { getSalesMarginCapabilities, previewSalesMargin } from './salesMarginApi'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => api.mockReset())

it('uses the exact capability and one preview payload with caller cancellation and server formatted output', async () => {
  const capability = salesMarginCapability(), report = salesMarginReport(), controller = new AbortController()
  api.mockResolvedValueOnce(capability).mockResolvedValueOnce(report)
  expect(await getSalesMarginCapabilities(controller.signal)).toEqual(capability)
  expect(await previewSalesMargin(capability, '2026-09', controller.signal)).toBe(report)
  expect(api).toHaveBeenNthCalledWith(1, '/report/constructors/sales-margin/capabilities', { signal: controller.signal, dedupe: false })
  const request = createSalesMarginRequest(capability, '2026-09')
  expect(Object.keys(request)).toEqual(['Version', 'SourceIdentity', 'Month'])
  expect(api).toHaveBeenNthCalledWith(2, '/report/constructors/sales-margin/preview', {
    method: 'POST', body: request, signal: controller.signal, dedupe: false,
  })
  expect(report.Cells[2].FormattedValue).toBe('20.00')
  expect(api).toHaveBeenCalledTimes(2)
})

it('does not submit without the exact executable capability or with an invalid month', async () => {
  await expect(previewSalesMargin({ ...salesMarginCapability(), Executable: false }, '2026-09')).rejects.toThrow('Сервер не підтвердив')
  await expect(previewSalesMargin(salesMarginCapability(), '2026-09-01')).rejects.toThrow('Оберіть місяць')
  expect(api).not.toHaveBeenCalled()
})

it('rejects stale scope and has no automatic preview retry after refusal', async () => {
  api.mockResolvedValueOnce(salesMarginReport('2026-08'))
  await expect(previewSalesMargin(salesMarginCapability(), '2026-09')).rejects.toThrow('інший місячний період')
  api.mockRejectedValueOnce(new Error('Refused'))
  await expect(previewSalesMargin(salesMarginCapability(), '2026-09')).rejects.toThrow('Refused')
  expect(api).toHaveBeenCalledTimes(2)
})
