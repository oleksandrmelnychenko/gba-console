import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { createStockReport, previewStockReport, searchDatasetReportValues } from './reportsApi'
import { getReportDatasets, getServerReportTemplates } from './reportWorkspaceApi'
import { groupedCashDataset, groupedCashRequest } from '../data/groupedCashPeriod.test-fixtures'
import { requestGroupedCashPeriod } from '../data/groupedCashPeriod'
import { currentVparivaniePreview } from '../data/currentVparivanie.test-fixtures'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => api.mockReset())
it('normalizes the capability and submits the identical eight-field request through preview and file generation', async () => {
  api.mockResolvedValue([groupedCashDataset]); await expect(getReportDatasets()).resolves.toEqual([groupedCashDataset])
  const data = groupedCashRequest()
  api.mockResolvedValue({ document: {} }); await createStockReport(data)
  expect(api).toHaveBeenLastCalledWith('/report/stocks/generate', expect.objectContaining({ method: 'POST', body: data }))
  const Preview = currentVparivaniePreview(); Preview.Request.DataSource = 'NativeCashPeriod'
  Reflect.deleteProperty(Preview, 'CurrentVparivanieProducts')
  api.mockResolvedValue({ Preview }); await previewStockReport(data)
  expect(api).toHaveBeenLastCalledWith('/report/stocks/preview', expect.objectContaining({ method: 'POST', body: data }))
  expect(data.cashPeriod).toBeUndefined()
})
it('round-trips Pascal saved grouped scope without creating a scalar account identity', async () => {
  const data = groupedCashRequest()
  api.mockResolvedValue([{ Id: crypto.randomUUID(), Revision: 1, Name: 'Grouped cash', Data: {
    DataSource: 40, From: data.from, To: data.to, Sorted: data.sorted, Selections: [], GroupedCashPeriod: data.groupedCashPeriod,
  } }])
  const [saved] = await getServerReportTemplates()
  expect(requestGroupedCashPeriod(saved.Data)).toEqual(data.groupedCashPeriod); expect(saved.Data.cashPeriod).toBeUndefined()
})
it('uses only the four current native account filters and preserves exact Int64 lookup strings', async () => {
  api.mockResolvedValue([{ Id: '9223372036854775807', Name: 'Synthetic account' }])
  const params = { value: '', offset: 0, limit: 30 }
  await expect(searchDatasetReportValues(40, 29, params)).resolves.toEqual([{ Id: '9223372036854775807', Name: 'Synthetic account' }])
  await expect(searchDatasetReportValues(40, 6, params)).rejects.toThrow('недоступний')
  expect(api).toHaveBeenCalledOnce()
})
it('rejects a wrong inline dataset and missing capability before displaying or generating files', async () => {
  const Preview = currentVparivaniePreview(); Preview.Request.DataSource = 'NativeAccountBalances'
  Reflect.deleteProperty(Preview, 'CurrentVparivanieProducts'); api.mockResolvedValue({ Preview })
  await expect(previewStockReport(groupedCashRequest())).rejects.toThrow('іншого набору')
  api.mockResolvedValue([{ ...groupedCashDataset, groupedCashPeriod: undefined }])
  await expect(getReportDatasets()).rejects.toThrow('некоректний список')
})
