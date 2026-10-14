import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { normalizeNativeReportPreview } from '../data/nativeReportPreview'
import { settlementModeDataset as dataset } from '../data/settlementReadMode.test-fixtures'
import { createStockReport, previewStockReport, validateStockReportRequest } from './reportsApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => vi.clearAllMocks())
function response(mode?: unknown, source = 'NativeSettlementPeriod') {
  return { Preview: { Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true,
    Request: { DataSource: source, IsCurrentSnapshot: false, HasPeriod: true, ...(mode !== undefined ? { SettlementReadMode: mode } : {}) },
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 0, ReturnedRows: 0, HasMore: false },
    RowSchema: [], ColumnSchema: [], Rows: [], Columns: [], Cells: [] } }
}
const request = (mode?: unknown) => {
  const body = { ...defaultDatasetRequest(dataset, '2025-01-01', '2026-09-30'), settlementReadMode: mode }
  if (mode === undefined) delete body.settlementReadMode
  return body
}

it.each([0, 1])('submits explicit mode %s unchanged and accepts the matching server echo', async mode => {
  const body = request(mode)
  vi.mocked(apiRequest).mockResolvedValue(response(mode))
  const result = await previewStockReport(body, dataset)
  expect(result.preview.Request?.SettlementReadMode).toBe(mode)
  expect(vi.mocked(apiRequest).mock.calls[0][1]?.body).toEqual(body)
  expect(vi.mocked(apiRequest).mock.calls[0][1]?.body).not.toBe(body)
})

it.each([undefined, null, 1])('refuses an older or different server echo %s for an explicit current-documents request', async echo => {
  vi.mocked(apiRequest).mockResolvedValue(response(echo))
  await expect(previewStockReport(request(0), dataset)).rejects.toThrow('інше джерело розрахунку взаєморозрахунків')
})

it('submits the new default grouped Fenix buyer request with current documents', async () => {
  vi.mocked(apiRequest).mockResolvedValue(response(0))
  await expect(previewStockReport(defaultDatasetRequest(dataset, '2025-01-01', '2026-09-30'), dataset))
    .resolves.toMatchObject({ preview: { Request: { SettlementReadMode: 0 } } })
  expect(vi.mocked(apiRequest).mock.calls[0][1]?.body).toMatchObject({ settlementReadMode: 0 })
})

it('keeps legacy requests legacy and refuses a server that claims an explicit mode for them', async () => {
  vi.mocked(apiRequest).mockResolvedValue(response())
  await expect(previewStockReport(request(), dataset)).resolves.toMatchObject({ preview: { Request: { DataSource: 'NativeSettlementPeriod' } } })
  expect(vi.mocked(apiRequest).mock.calls[0][1]?.body).not.toHaveProperty('settlementReadMode')
  vi.mocked(apiRequest).mockResolvedValue(response(0))
  await expect(previewStockReport(request(), dataset)).rejects.toThrow('інше джерело')
})

it('fails before I/O for malformed, duplicated or misplaced modes', async () => {
  await expect(createStockReport(request('0'))).rejects.toThrow('Некоректне')
  await expect(createStockReport({ ...request(0), SettlementReadMode: 0 })).rejects.toThrow('двічі')
  await expect(createStockReport({ ...request(0), sourceBuyerSubtree: undefined })).rejects.toThrow('«Покупці»')
  expect(() => validateStockReportRequest({ ...request(0), from: '2024-12-01' })).toThrow('120')
  expect(apiRequest).not.toHaveBeenCalled()
})

it('reads strict numeric echo aliases and refuses duplicate or malformed evidence', () => {
  const payload = response(0)
  const { SettlementReadMode: _mode, ...rest } = payload.Preview.Request
  void _mode
  expect(normalizeNativeReportPreview({ Preview: { ...payload.Preview, Request: { ...rest, settlementReadMode: 1 } } }).Request?.SettlementReadMode).toBe(1)
  expect(normalizeNativeReportPreview(response(null)).Request).not.toHaveProperty('SettlementReadMode')
  for (const request of [{ ...payload.Preview.Request, settlementReadMode: 0 }, { ...rest, SETTLEMENTREADMODE: 0 },
    { ...rest, SettlementReadMode: '0' }, { ...rest, SettlementReadMode: 2 }])
    expect(() => normalizeNativeReportPreview({ Preview: { ...payload.Preview, Request: request } })).toThrow('джерело розрахунку взаєморозрахунків')
})
