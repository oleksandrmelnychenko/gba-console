import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest, ApiError } from '../../../shared/api/apiClient'
import { previewStockReport, getStockReportPreviewPage, exportStockReportPreview } from './reportsApi'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import type { ReportDataset } from '../types'
vi.mock('../../../shared/api/apiClient', async original => ({ ...await original<typeof import('../../../shared/api/apiClient')>(), apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
const session = { ResultId: '11111111-2222-3333-4444-555555555555', RequestSha256: 'b'.repeat(64), ResultSha256: 'a'.repeat(64), ExpiresAtUtc: '2030-01-01T00:15:00Z' }
const configuration = { version: 1, axisMode: 'flexible', allowedRows: [0, 5], allowedColumns: [0, 5], minimumRows: 1, maximumRows: 2, allowRowReorder: true, rowLayouts: [], columnLayouts: [], mutuallyExclusiveRows: [], period: { required: false, supported: true, maximumDays: null, maximumMonths: null, minimumDate: null }, variants: [] }
const dataset: ReportDataset = { ...reportDatasets[0], configuration }
const request = () => ({ ...defaultDatasetRequest(reportDatasets[0], '2026-10-01', '2026-10-21'), sorted: { ...defaultDatasetRequest(reportDatasets[0], '', '').sorted, Row: [{ type: 5, key: 'Product', label: 'Товар' }], Col: [] } })
function page(offset = 0) { return { ...session, PreviewVersion: 2, DocumentURL: '', PdfDocumentURL: '', Preview: {
  Version: 1, RequestSha256: session.RequestSha256, ResultSha256: session.ResultSha256, PresentationOnly: true,
  Page: { Offset: offset, Limit: 50, TotalVisibleRows: 51, ReturnedRows: 1, HasMore: offset === 0 },
  RowSchema: [{ Caption: 'Товар' }], ColumnSchema: [{ Caption: 'Сума' }],
  Rows: [{ Ordinal: offset, SourceIndex: offset + 12, Values: [{ Caption: 'Товар А' }] }],
  Columns: [{ Ordinal: 0, SourceIndex: 3, Values: [{ Caption: 'Сума' }] }],
  Cells: [{ RowSourceIndex: offset + 12, ColumnSourceIndex: 3, Value: { Kind: 'decimal', Value: '1234.5', Provenance: 'producerCell' } }],
} } }
beforeEach(() => api.mockReset())
describe('immutable report preview client', () => {
  it('negotiates v2, reads further pages by ID, and exports the same complete snapshot without rerunning report SQL', async () => {
    api.mockResolvedValueOnce({ Version: 2, MaximumPageRows: 200, TimeToLiveSeconds: 900, ExplicitExport: true }).mockResolvedValueOnce(page())
    const result = await previewStockReport(request(), dataset)
    expect(result.preview.ResultSession).toEqual(session)
    expect(api).toHaveBeenNthCalledWith(2, '/report/stocks/preview', expect.objectContaining({ query: { previewVersion: 2, rowOffset: 0, rowLimit: 50 } }))
    api.mockResolvedValueOnce(page(50))
    expect((await getStockReportPreviewPage(session, request(), 50)).Page.Offset).toBe(50)
    expect(api).toHaveBeenLastCalledWith(`/report/stocks/preview/${session.ResultId}`, { query: { rowOffset: 50, rowLimit: 50 }, signal: undefined })
    api.mockResolvedValueOnce({ ...session, DocumentURL: '/whole.xlsx', PdfDocumentURL: '/whole.pdf' })
    expect((await exportStockReportPreview(session)).document.DocumentURL).toBe('/whole.xlsx')
    expect(api).toHaveBeenLastCalledWith(`/report/stocks/preview/${session.ResultId}/export`, { method: 'POST', body: {}, dedupe: false })
    expect(api.mock.calls.filter(([path]) => path === '/report/stocks/preview')).toHaveLength(1)
  })
  it('falls back only when capability discovery explicitly returns404, never on auth or unsupported protocol', async () => {
    api.mockRejectedValueOnce(new ApiError('missing', 404, null)).mockResolvedValueOnce(page())
    await previewStockReport(request(), dataset)
    expect(api).toHaveBeenLastCalledWith('/report/stocks/preview', expect.objectContaining({ query: { rowOffset: 0, rowLimit: 50 } }))
    api.mockReset().mockRejectedValueOnce(new ApiError('denied', 403, null))
    await expect(previewStockReport(request(), dataset)).rejects.toThrow('denied')
    expect(api).toHaveBeenCalledTimes(1)
  })
  it('refuses changed snapshot identity, expired IDs and different page offsets without recalculation', async () => {
    api.mockResolvedValueOnce({ ...page(50), RequestSha256: 'c'.repeat(64), Preview: { ...page(50).Preview, RequestSha256: 'c'.repeat(64) } })
    await expect(getStockReportPreviewPage(session, request(), 50)).rejects.toThrow('інший розрахунок')
    api.mockResolvedValueOnce(page(0))
    await expect(getStockReportPreviewPage(session, request(), 50)).rejects.toThrow('іншу сторінку')
    api.mockRejectedValueOnce(new ApiError('expired', 404, null))
    await expect(exportStockReportPreview(session)).rejects.toThrow('автоматичний перерахунок не виконувався')
    expect(api.mock.calls.some(([path]) => path === '/report/stocks/preview')).toBe(false)
  })
})
