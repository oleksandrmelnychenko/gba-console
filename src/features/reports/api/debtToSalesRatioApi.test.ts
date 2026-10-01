import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getDebtToSalesRatioCapabilities, previewDebtToSalesRatio } from './debtToSalesRatioApi'
import { createDebtToSalesRatioRequest } from '../data/debtToSalesRatio'
import { debtRatioCapability, debtRatioReport } from '../data/debtToSalesRatio.test-fixtures'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => api.mockReset())

it('requires the explicit original capability and submits only source identity/month to one preview and export run', async () => {
  const capability = debtRatioCapability(), response = debtRatioReport()
  response.Cells[2].Value = '21.238938053097345132743362832'
  api.mockResolvedValueOnce(capability).mockResolvedValueOnce(response)
  expect(await getDebtToSalesRatioCapabilities()).toEqual(capability)
  expect(await previewDebtToSalesRatio(capability, '2026-09')).toBe(response)
  expect(response.Cells[2].Value).toBe('21.238938053097345132743362832')
  expect(api).toHaveBeenNthCalledWith(1, '/report/constructors/debt-to-sales-ratio/capabilities', { signal: undefined })
  const request = createDebtToSalesRatioRequest(capability, '2026-09')
  expect(Object.keys(request)).toEqual(['Version', 'SourceIdentity', 'Month'])
  expect(api).toHaveBeenNthCalledWith(2, '/report/constructors/debt-to-sales-ratio/preview', { method: 'POST', body: request })
  expect(api).toHaveBeenCalledTimes(2)
})

it('does not post without executable capability or with a day/filter-style period', async () => {
  await expect(previewDebtToSalesRatio({ ...debtRatioCapability(), Executable: false }, '2026-09')).rejects.toThrow('Сервер не підтвердив')
  await expect(previewDebtToSalesRatio(debtRatioCapability(), '2026-09-01')).rejects.toThrow('Оберіть місяць')
  expect(api).not.toHaveBeenCalled()
})

it('rejects another constructor capability and another month result including its file links', async () => {
  api.mockResolvedValue({ ...debtRatioCapability(), SourceIdentity: { World: 'fenix', SourceId: 'wrong', DefinitionSha256: 'a'.repeat(64) } })
  await expect(getDebtToSalesRatioCapabilities()).rejects.toThrow('Сервер не підтвердив')
  api.mockResolvedValue(debtRatioReport('2026-08'))
  await expect(previewDebtToSalesRatio(debtRatioCapability(), '2026-09')).rejects.toThrow('інший місячний період')
})
