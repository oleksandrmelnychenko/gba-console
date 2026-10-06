import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { createStockReport, previewStockReport, searchDatasetReportValues } from './reportsApi'
import { saveServerReportTemplate } from './reportWorkspaceApi'
import { defaultDatasetRequest } from '../data/reportDatasets'
import type { ReportDataset } from '../types'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => vi.clearAllMocks())

const dataset: ReportDataset = {
  DataSource: 35, Name: 'Валовий прибуток GBA за днем та організацією', Description: '',
  PeriodRequired: true, PeriodSupported: true,
  Groupings: [{ Type: 3, Name: 'День' }, { Type: 4, Name: 'Організація' }],
  Measurements: [2, 3, 4, 6, 7, 8, 10, 12, 14, 15].map(Type => ({ Type, Name: `${Type}` })),
  Filters: [0, 1, 2, 6, 9].map(Type => ({ Type, Name: `${Type}` })), Limitations: [],
}

it('keeps source35 exact Int64 lookup identities as decimal strings', async () => {
  vi.mocked(apiRequest).mockResolvedValueOnce([{ Id: '9223372036854775807', Name: 'Організація' }])
  expect(await searchDatasetReportValues(35, 0, { value: '', offset: 0, limit: 10 }))
    .toEqual([{ Id: '9223372036854775807', Name: 'Організація' }])
  vi.mocked(apiRequest).mockResolvedValueOnce([{ Id: Number('9223372036854775807'), Name: 'Округлено' }])
  await expect(searchDatasetReportValues(35, 0, { value: '', offset: 0, limit: 10 })).rejects.toThrow(/значення/)
})

it('checks generation, preview and template save before any request', async () => {
  const data = defaultDatasetRequest(dataset, '2026-08-01', '2026-09-01')
  await expect(createStockReport(data)).rejects.toThrow(/31/)
  await expect(previewStockReport(data)).rejects.toThrow(/31/)
  await expect(saveServerReportTemplate({ Name: 'Day profit', Data: data })).rejects.toThrow(/31/)
  expect(apiRequest).not.toHaveBeenCalled()
})
