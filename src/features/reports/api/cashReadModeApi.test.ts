import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { formatKyivBusinessDate } from '../../../shared/date/dateTime'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { normalizeNativeReportPreview } from '../data/nativeReportPreview'
import { cashModeDataset as dataset } from '../data/cashReadMode.test-fixtures'
import { cashPeriodManagementRequest } from '../data/cashPeriod.test-fixtures'
import { createStockReport, previewStockReport, validateStockReportRequest } from './reportsApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => vi.clearAllMocks())
function response(mode?: unknown, source = 'NativeCashPeriod') {
  return { Preview: { Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true,
    Request: { DataSource: source, IsCurrentSnapshot: false, HasPeriod: true, ...(mode !== undefined ? { CashReadMode: mode } : {}) },
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 0, ReturnedRows: 0, HasMore: false },
    RowSchema: [], ColumnSchema: [], Rows: [], Columns: [], Cells: [] } }
}
const request = (mode?: unknown) => {
  if (mode !== undefined) return { ...defaultDatasetRequest(dataset, '2025-01-01', formatKyivBusinessDate()), cashReadMode: mode }
  const legacy = defaultDatasetRequest(dataset, '2026-09-01', '2026-09-30')
  delete legacy.cashReadMode
  return legacy
}

it.each([0, 1])('submits explicit mode %s unchanged and accepts the matching server echo', async mode => {
  const body = request(mode)
  vi.mocked(apiRequest).mockResolvedValue(response(mode))
  const result = await previewStockReport(body, dataset)
  expect(result.preview.Request?.CashReadMode).toBe(mode)
  expect(vi.mocked(apiRequest).mock.calls[0][1]?.body).toEqual(body)
  expect(vi.mocked(apiRequest).mock.calls[0][1]?.body).not.toBe(body)
})

it.each([undefined, null, 1])('refuses an older or different server echo %s for an explicit current-documents request', async echo => {
  vi.mocked(apiRequest).mockResolvedValue(response(echo))
  await expect(previewStockReport(request(0), dataset)).rejects.toThrow('Сервер повернув інше джерело розрахунку коштів.')
})

it('submits the new default grouped request with current documents', async () => {
  const body = defaultDatasetRequest(dataset, '2025-01-01', formatKyivBusinessDate())
  vi.mocked(apiRequest).mockResolvedValue(response(0))
  await expect(previewStockReport(body, dataset)).resolves.toMatchObject({ preview: { Request: { CashReadMode: 0 } } })
  expect(vi.mocked(apiRequest).mock.calls[0][1]?.body).toMatchObject({ cashReadMode: 0 })
})

it('keeps legacy requests legacy and refuses a server that claims an explicit mode for them', async () => {
  vi.mocked(apiRequest).mockResolvedValue(response())
  await expect(previewStockReport(request(), dataset)).resolves.toMatchObject({ preview: { Request: { DataSource: 'NativeCashPeriod' } } })
  expect(vi.mocked(apiRequest).mock.calls[0][1]?.body).not.toHaveProperty('cashReadMode')
  vi.mocked(apiRequest).mockResolvedValue(response(0))
  await expect(previewStockReport(request(), dataset)).rejects.toThrow('інше джерело розрахунку коштів')
})

it('fails before I/O for malformed, duplicated or misplaced modes', async () => {
  await expect(createStockReport(request('0'))).rejects.toThrow('Некоректне')
  await expect(createStockReport({ ...request(0), CashReadMode: 0 })).rejects.toThrow('двічі')
  await expect(createStockReport({ ...cashPeriodManagementRequest(), cashReadMode: 0 })).rejects.toThrow('кількома рахунками')
  expect(() => validateStockReportRequest({ ...request(0), from: '2024-12-01' })).toThrow('120')
  expect(() => validateStockReportRequest({ ...request(), from: '2025-01-01' })).toThrow('31')
  expect(apiRequest).not.toHaveBeenCalled()
})

it('reads strict numeric echo aliases and refuses duplicate or malformed evidence', () => {
  const payload = response(0)
  const { CashReadMode: _mode, ...rest } = payload.Preview.Request
  void _mode
  expect(normalizeNativeReportPreview({ Preview: { ...payload.Preview, Request: { ...rest, cashReadMode: 1 } } }).Request?.CashReadMode).toBe(1)
  expect(normalizeNativeReportPreview(response(null)).Request).not.toHaveProperty('CashReadMode')
  for (const request of [{ ...payload.Preview.Request, cashReadMode: 0 }, { ...rest, CASHREADMODE: 0 },
    { ...rest, CashReadMode: '0' }, { ...rest, CashReadMode: 2 }])
    expect(() => normalizeNativeReportPreview({ Preview: { ...payload.Preview, Request: request } })).toThrow('Сервер повернув некоректне джерело розрахунку коштів.')
})
