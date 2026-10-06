import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { createStockReport, searchDatasetReportValues } from './reportsApi'
import { getReportDatasets, saveServerReportTemplate } from './reportWorkspaceApi'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { grossDataset } from '../data/recordedSaleGrossProfit.test-fixtures'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => vi.clearAllMocks())

it('accepts source30 dataset and preserves exact decimal-string lookup IDs', async () => {
  vi.mocked(apiRequest).mockResolvedValueOnce([grossDataset])
  expect(await getReportDatasets()).toEqual([grossDataset])
  vi.mocked(apiRequest).mockResolvedValueOnce([{ Id: '9223372036854775807', Name: 'Договір' }])
  expect(await searchDatasetReportValues(30, 9, { value: 'Договір', offset: 0, limit: 25 }))
    .toEqual([{ Id: '9223372036854775807', Name: 'Договір' }])
  vi.mocked(apiRequest).mockResolvedValueOnce([{ Id: Number('9223372036854775807'), Name: 'Округлений договір' }])
  await expect(searchDatasetReportValues(30, 9, { value: '', offset: 0, limit: 25 })).rejects.toThrow(/значення/)
})

it('blocks periods longer than 31 days before generation or template save', async () => {
  const data = defaultDatasetRequest(grossDataset, '2026-08-01', '2026-09-01')
  await expect(createStockReport(data)).rejects.toThrow(/31/)
  await expect(saveServerReportTemplate({ Name: 'Gross', Data: data })).rejects.toThrow(/31/)
  expect(apiRequest).not.toHaveBeenCalled()
})
