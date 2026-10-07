import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { originalRevenueCapability, originalRevenueReport } from '../data/originalRevenue.test-fixtures'
import { getOriginalRevenueCapabilities, previewOriginalRevenue } from './originalRevenueApi'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => api.mockReset())
it('uses the dedicated capability and one caller-isolated month request for client rows, server totals and both files', async () => {
  const capability = originalRevenueCapability(), result = originalRevenueReport(), controller = new AbortController()
  api.mockResolvedValueOnce(capability).mockResolvedValueOnce(result)
  expect(await getOriginalRevenueCapabilities(controller.signal)).toBe(capability)
  expect(await previewOriginalRevenue(capability, '2026-09')).toBe(result)
  expect(api).toHaveBeenNthCalledWith(1, '/report/constructors/revenue-comparison/capabilities', { signal: controller.signal })
  expect(api).toHaveBeenNthCalledWith(2, '/report/constructors/revenue-comparison/preview', { method: 'POST', dedupe: false,
    body: { Version: 1, SourceIdentity: capability.SourceIdentity, Month: '2026-09' } })
  expect(api).toHaveBeenCalledTimes(2)
})
it('does no request for an invalid month or unexecutable capability', async () => {
  await expect(previewOriginalRevenue(originalRevenueCapability(), '2026-13')).rejects.toThrow('Оберіть')
  await expect(previewOriginalRevenue({ ...originalRevenueCapability(), Executable: false }, '2026-09')).rejects.toThrow('Сервер не підтвердив')
  expect(api).not.toHaveBeenCalled()
})
it('rejects a native32 capability or stale result month before exposing the returned export links', async () => {
  api.mockResolvedValueOnce({ ...originalRevenueCapability(), SourceIdentity: { World: 'fenix', SourceId: 'native:32', DefinitionSha256: 'a'.repeat(64) } })
  await expect(getOriginalRevenueCapabilities()).rejects.toThrow('Сервер не підтвердив')
  api.mockResolvedValueOnce(originalRevenueReport('2026-08'))
  await expect(previewOriginalRevenue(originalRevenueCapability(), '2026-09')).rejects.toThrow('некоректний результат')
})
