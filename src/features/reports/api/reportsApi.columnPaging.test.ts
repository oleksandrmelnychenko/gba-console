import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { exportStockReportPreview, getStockReportPreviewPage, previewStockReport } from './reportsApi'
import { documentDataset, documentPreviewPayload, documentRequest } from '../data/currentFinancialDocumentAxes.test-fixtures'
vi.mock('../../../shared/api/apiClient', async original => ({ ...await original<typeof import('../../../shared/api/apiClient')>(), apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
const session = { ResultId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', RequestSha256: 'b'.repeat(64), ResultSha256: 'a'.repeat(64), ExpiresAtUtc: '2030-01-01T00:00:00Z' }
const pagingCapability = { Version: 2, MaximumPageRows: 200, TimeToLiveSeconds: 900, ExplicitExport: true,
  ColumnPaging: true, MaximumPageColumns: 256, MaximumResultColumns: 16000, MaximumOccupiedCells: 1000000, MaximumResponseBytes: 1048576 }
const legacyCapability = { Version: 2, MaximumPageRows: 200, TimeToLiveSeconds: 900, ExplicitExport: true }

function windowed(offset: number, returned: number, total: number, limit = 256) {
  const base = documentPreviewPayload()
  const columns = Array.from({ length: returned }, (_, index) => ({ ...structuredClone(base.Columns[0]), Ordinal: offset + index, SourceIndex: offset + index }))
  return { ...session, PreviewVersion: 2, Preview: { ...base, RequestSha256: session.RequestSha256,
    Page: { ...base.Page, ColumnOffset: offset, ColumnLimit: limit, TotalColumns: total, ReturnedColumns: returned, HasMoreColumns: offset + returned < total },
    Columns: columns, Cells: returned ? [{ ...base.Cells[0], ColumnSourceIndex: offset }] : [] } }
}
const query = (path: string) => api.mock.calls.find(([called]) => called === path)?.[1]?.query

beforeEach(() => api.mockReset())

describe('preview column paging transport', () => {
  it('asks for the first column window when the server advertises column paging', async () => {
    api.mockImplementation(async path => path === '/report/stocks/preview/capabilities' ? pagingCapability : windowed(0, 256, 3660))
    const { preview } = await previewStockReport(documentRequest(), documentDataset)
    expect(query('/report/stocks/preview')).toEqual({ rowOffset: 0, rowLimit: 50, previewVersion: 2, columnOffset: 0, columnLimit: 256 })
    expect(preview.Page).toMatchObject({ ColumnOffset: 0, ReturnedColumns: 256, TotalColumns: 3660, HasMoreColumns: true })
  })

  it('keeps the old request shape for a server without column paging', async () => {
    const legacy = windowed(0, 1, 1)
    const page = { ...legacy.Preview.Page } as Record<string, unknown>
    for (const key of ['ColumnOffset', 'ColumnLimit', 'TotalColumns', 'ReturnedColumns', 'HasMoreColumns']) delete page[key]
    api.mockImplementation(async path => path === '/report/stocks/preview/capabilities' ? legacyCapability : { ...legacy, Preview: { ...legacy.Preview, Page: page } })
    await previewStockReport(documentRequest(), documentDataset)
    expect(query('/report/stocks/preview')).toEqual({ rowOffset: 0, rowLimit: 50, previewVersion: 2 })
  })

  it('refuses a malformed column capability before calculating', async () => {
    api.mockImplementation(async path => path === '/report/stocks/preview/capabilities' ? { ...pagingCapability, MaximumPageColumns: 0 } : windowed(0, 1, 1))
    await expect(previewStockReport(documentRequest(), documentDataset)).rejects.toThrow('Непідтримувана версія перегляду звіту.')
    expect(api.mock.calls.some(([path]) => path === '/report/stocks/preview')).toBe(false)
  })

  it('reads an existing result window by offset and accepts a server-shortened window', async () => {
    api.mockResolvedValueOnce(windowed(256, 150, 3660))
    const page = await getStockReportPreviewPage(session, documentRequest(), 0, undefined, { offset: 256, limit: 256 })
    expect(api).toHaveBeenCalledWith(`/report/stocks/preview/${session.ResultId}`, expect.objectContaining({
      query: { rowOffset: 0, rowLimit: 50, columnOffset: 256, columnLimit: 256 } }))
    expect(page.Page.ReturnedColumns).toBe(150)
    expect(page.Columns.at(-1)?.SourceIndex).toBe(405)
    api.mockResolvedValueOnce(windowed(512, 256, 3660))
    await expect(getStockReportPreviewPage(session, documentRequest(), 0, undefined, { offset: 406, limit: 256 }))
      .rejects.toThrow('Сервер повернув інше вікно колонок звіту.')
    await expect(getStockReportPreviewPage(session, documentRequest(), 0, undefined, { offset: 0, limit: 257 }))
      .rejects.toThrow('Некоректне вікно колонок звіту.')
  })

  it('sends the export layout only when one was chosen', async () => {
    api.mockResolvedValue({ ...session, DocumentURL: '/wide.xlsx', PdfDocumentURL: '' })
    await exportStockReportPreview(session)
    await exportStockReportPreview(session, 'table')
    await exportStockReportPreview(session, 'sheets')
    const exports = api.mock.calls.filter(([path]) => path === `/report/stocks/preview/${session.ResultId}/export`)
    expect(exports.map(([, options]) => options?.query)).toEqual([undefined, { layout: 'table' }, { layout: 'sheets' }])
    await expect(exportStockReportPreview(session, 'wide' as 'table')).rejects.toThrow('Некоректний вигляд файла звіту.')
  })
})
