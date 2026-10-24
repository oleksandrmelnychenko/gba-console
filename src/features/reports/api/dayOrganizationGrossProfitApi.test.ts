import { financialDataset, axisFields } from '../data/financialAxes.test-fixtures'
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

it.each([[[3], [4]], [[4], [3]]])('dispatches axes %j / %j unchanged only with server capability, including template save', async (rows, cols) => {
  const request = defaultDatasetRequest(financialDataset, '2026-10-17', '2026-10-17')
  request.sorted.Row = axisFields(rows); request.sorted.Col = axisFields(cols)
  request.profitReadMode = 0
  const before = structuredClone(request)
  await expect(createStockReport(request)).rejects.toThrow()
  await expect(previewStockReport(request)).rejects.toThrow()
  await expect(saveServerReportTemplate({ Name: 'Матриця', Data: request })).rejects.toThrow()
  expect(apiRequest).not.toHaveBeenCalled()
  vi.mocked(apiRequest).mockResolvedValue({ document: {} })
  await createStockReport(request, financialDataset)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/stocks/generate', expect.objectContaining({ body: request }))
  vi.mocked(apiRequest).mockResolvedValue({ Id: '10000000-0000-4000-8000-000000000035', Revision: 1, Name: 'Матриця',
    Data: { DataSource: 35, From: request.from, To: request.to, Sorted: request.sorted, Selections: request.selections,
      ProfitReadMode: 0, DayOrganizationBasis: request.dayOrganizationBasis, WorkbookPresentation: request.workbookPresentation } })
  const saved = await saveServerReportTemplate({ Name: 'Матриця', Data: request }, undefined, financialDataset)
  expect(saved.Data.sorted.Row.map(field => field.type)).toEqual(rows)
  expect(saved.Data.sorted.Col.map(field => field.type)).toEqual(cols)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/templates/save', expect.objectContaining({ body: expect.objectContaining({ Data: request }) }))
  expect(request).toEqual(before)
})
