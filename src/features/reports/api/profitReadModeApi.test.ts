import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { profitDayDataset, profitSupplierDataset } from '../data/profitReadMode.test-fixtures'
import { normalizeNativeReportPreview } from '../data/nativeReportPreview'
import { createStockReport, previewStockReport } from './reportsApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => vi.clearAllMocks())
function response(mode: unknown = 0, source = 'NativeDayOrganizationGrossProfit') {
  return { Preview: { Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true,
    Request: { DataSource: source, ProfitReadMode: mode, IsCurrentSnapshot: false, HasPeriod: true },
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 0, ReturnedRows: 0, HasMore: false },
    RowSchema: [], ColumnSchema: [], Rows: [], Columns: [], Cells: [] } }
}
it.each([profitDayDataset, profitSupplierDataset])('submits immutable explicit mode for source $DataSource and binds preview source', async dataset => {
  const request = { ...defaultDatasetRequest(dataset, '2026-09-01', '2026-09-30'), profitReadMode: 0 }
  vi.mocked(apiRequest).mockResolvedValue(response(0, dataset.DataSource === 35 ? 'NativeDayOrganizationGrossProfit' : 'NativeSupplierGrossProfit'))
  const result = await previewStockReport(request)
  expect(result.preview.Request?.ProfitReadMode).toBe(0)
  expect(vi.mocked(apiRequest).mock.calls[0][1]?.body).toEqual(request)
  expect(vi.mocked(apiRequest).mock.calls[0][1]?.body).not.toBe(request)
})
it.each([undefined, null, 1, '0', true])('refuses missing, mismatched or malformed response mode %s', async actual => {
  const payload = response(actual); payload.Preview.Request.ProfitReadMode = actual
  vi.mocked(apiRequest).mockResolvedValue(payload)
  const request = { ...defaultDatasetRequest(profitDayDataset, '2026-09-01', '2026-09-30'), profitReadMode: 0 }
  await expect(previewStockReport(request)).rejects.toThrow('джерело розрахунку')
})
it('rejects wrong dataset proof and a response claiming explicit mode for an old request', async () => {
  const request = defaultDatasetRequest(profitDayDataset, '2026-09-01', '2026-09-30')
  vi.mocked(apiRequest).mockResolvedValue(response(0, 'NativeCashPeriod'))
  await expect(previewStockReport({ ...request, profitReadMode: 0 })).rejects.toThrow('інше джерело')
  vi.mocked(apiRequest).mockResolvedValue(response())
  await expect(previewStockReport(request)).rejects.toThrow('інше джерело')
})
it('fails before I/O for nonnumeric or conflicting mode aliases', async () => {
  const request = defaultDatasetRequest(profitDayDataset, '2026-09-01', '2026-09-30')
  await expect(createStockReport({ ...request, profitReadMode: '0' })).rejects.toThrow('Некоректне')
  await expect(createStockReport({ ...request, profitReadMode: 0, ProfitReadMode: 0 })).rejects.toThrow('двічі')
  expect(apiRequest).not.toHaveBeenCalled()
})
it('preserves strict numeric response aliases and refuses duplicate evidence', () => {
  const payload = response()
  const { ProfitReadMode: _mode, ...rest } = payload.Preview.Request; void _mode
  const camel = { ...payload, Preview: { ...payload.Preview, Request: { ...rest, profitReadMode: 0 } } }
  expect(normalizeNativeReportPreview(camel).Request?.ProfitReadMode).toBe(0)
  expect(() => normalizeNativeReportPreview({ ...payload, Preview: { ...payload.Preview, Request: { ...payload.Preview.Request, profitReadMode: 0 } } })).toThrow('джерело')
})
