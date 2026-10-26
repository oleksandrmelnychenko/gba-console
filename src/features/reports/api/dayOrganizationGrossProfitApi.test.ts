import { documentPreviewPayload } from '../data/currentFinancialDocumentAxes.test-fixtures'
import { financialDataset, axisFields } from '../data/financialAxes.test-fixtures'
import { currentFinancialDataset, currentFinancialRequest } from '../data/currentFinancialAxes.test-fixtures'
import { productTimeDataset, productTimeRequest } from '../data/currentFinancialProductTimeAxes.test-fixtures'
import { requestProfitReadMode } from '../data/profitReadMode'
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

it('requires current capability before generation, preview or saving client/agreement settings', async () => {
  const request = currentFinancialRequest(), before = structuredClone(request)
  for (const dataset of [undefined, financialDataset]) {
    await expect(createStockReport(request, dataset)).rejects.toThrow()
    await expect(previewStockReport(request, dataset)).rejects.toThrow()
    await expect(saveServerReportTemplate({ Name: 'Клієнти', Data: request }, undefined, dataset)).rejects.toThrow()
  }
  const incompatible = { ...request, profitReadMode: 1 }
  await expect(createStockReport(incompatible, currentFinancialDataset)).rejects.toThrow('Поточних документів GBA')
  await expect(saveServerReportTemplate({ Name: 'Клієнти', Data: incompatible }, undefined, currentFinancialDataset)).rejects.toThrow()
  expect(apiRequest).not.toHaveBeenCalled()
  vi.mocked(apiRequest).mockResolvedValue({ document: {} })
  await createStockReport(request, currentFinancialDataset)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/stocks/generate', expect.objectContaining({ body: request }))
  vi.mocked(apiRequest).mockResolvedValue({ Id: '10000000-0000-4000-8000-000000000035', Revision: 1, Name: 'Клієнти',
    Data: { DataSource: 35, From: request.from, To: request.to, Sorted: request.sorted, Selections: request.selections,
      ProfitReadMode: 0, DayOrganizationBasis: 0 } })
  const saved = await saveServerReportTemplate({ Name: 'Клієнти', Data: request }, undefined, currentFinancialDataset)
  expect(saved.Data.sorted).toEqual(request.sorted)
  expect(requestProfitReadMode(saved.Data)).toBe(0)
  expect(request).toEqual(before)
})

it.each([[[5], [2]], [[0, 5], []]])('keeps product/time axes %j / %j in generate/save and rejects old-server requests before dispatch', async (rows, cols) => {
  const request = productTimeRequest(rows, cols), before = structuredClone(request)
  for (const dataset of [undefined, financialDataset, currentFinancialDataset]) {
    await expect(createStockReport(request, dataset)).rejects.toThrow('не підтвердив')
    await expect(previewStockReport(request, dataset)).rejects.toThrow('не підтвердив')
    await expect(saveServerReportTemplate({ Name: 'Товари', Data: request }, undefined, dataset)).rejects.toThrow('не підтвердив')
  }
  expect(apiRequest).not.toHaveBeenCalled()
  vi.mocked(apiRequest).mockResolvedValue({ document: {} })
  await createStockReport(request, productTimeDataset)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/stocks/generate', expect.objectContaining({ body: request }))
  vi.mocked(apiRequest).mockResolvedValue({ Id: '10000000-0000-4000-8000-000000000035', Revision: 1, Name: 'Товари',
    Data: { DataSource: 35, From: request.from, To: request.to, Sorted: request.sorted, Selections: request.selections,
      ProfitReadMode: 0, DayOrganizationBasis: 0 } })
  const saved = await saveServerReportTemplate({ Name: 'Товари', Data: request }, undefined, productTimeDataset)
  expect(saved.Data.sorted).toEqual(request.sorted)
  expect(saved.Data.from).toBe(request.from)
  expect(saved.Data.to).toBe(request.to)
  expect(request).toEqual(before)
})

it('BUG-1453 previews date and organization rows by month without losing axes or money', async () => {
  const request = productTimeRequest([3, 4], [2])
  await expect(previewStockReport(request, productTimeDataset)).rejects.toThrow()
  expect(apiRequest).not.toHaveBeenCalled()
  const dataset = { ...productTimeDataset, currentFinancialProductTimeAxes: {
    ...productTimeDataset.currentFinancialProductTimeAxes as object, maximumTotalDimensionsWithColumns: 3,
  } }
  vi.mocked(apiRequest).mockImplementation(async path => path.endsWith('/capabilities')
    ? { Version: 2, ExplicitExport: true, MaximumPageRows: 50, TimeToLiveSeconds: 300 }
    : { Preview: { ...documentPreviewPayload([3, 4], [2]), RequestSha256: 'b'.repeat(64) }, ResultSha256: 'a'.repeat(64), ResultId: '11111111-2222-3333-4444-555555555555',
      PreviewVersion: 2, RequestSha256: 'b'.repeat(64), ExpiresAtUtc: '2030-01-01T00:00:00Z' })
  const result = await previewStockReport(request, dataset)
  expect(apiRequest).toHaveBeenCalledWith('/report/stocks/preview', expect.objectContaining({ body: request }))
  expect(result.preview.RowSchema).toMatchObject([{ Identity: 'Day' }, { Identity: 'Organization' }])
  expect(result.preview.ColumnSchema.map(field => field.Identity)).toEqual(['Month', '$measureGroup', '$measure'])
  expect(result.preview.Cells[0].Value.Value).toBe('-7.00')
})
