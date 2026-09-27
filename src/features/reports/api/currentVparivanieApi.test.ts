import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { createStockReport, previewStockReport, searchDatasetReportValues } from './reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from './reportWorkspaceApi'
import { currentVparivanieDataset, currentVparivaniePreview, currentVparivanieRequest, exactSelection } from '../data/currentVparivanie.test-fixtures'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => api.mockReset())
it('loads only advertised current semantics and refuses forged capability on another source', async () => {
  api.mockResolvedValue([currentVparivanieDataset])
  await expect(getReportDatasets()).resolves.toEqual([currentVparivanieDataset])
  api.mockResolvedValue([{ ...currentVparivanieDataset, DataSource: 36 }])
  await expect(getReportDatasets()).rejects.toThrow('некоректний список')
  api.mockResolvedValue([{ ...currentVparivanieDataset, currentVparivanie: undefined }])
  await expect(getReportDatasets()).rejects.toThrow('некоректний список')
})
it('uses one preview calculation for raw cells, attrs and both export links', async () => {
  const request = currentVparivanieRequest()
  api.mockResolvedValue({ DocumentURL: '/report/run.xlsx', PdfDocumentURL: '/report/run.pdf', Preview: currentVparivaniePreview() })
  const result = await previewStockReport(request)
  expect(api).toHaveBeenCalledOnce()
  expect(api).toHaveBeenCalledWith('/report/stocks/preview', { method: 'POST', query: { rowOffset: 0, rowLimit: 50 }, body: request })
  expect(result.result.document).toEqual({ DocumentURL: '/report/run.xlsx', PdfDocumentURL: '/report/run.pdf' })
  expect(result.preview.CurrentVparivanieProducts?.ResultSha256).toBe(result.preview.ResultSha256)
})
it('retains exact group InGroup and all dynamic column identities across saved wire templates', async () => {
  const data = { ...currentVparivanieRequest(), selections: [exactSelection(4, 6)] }
  const wire = { Id: 'synthetic-template', Revision: 1, Name: 'Матриця', Data: { DataSource: 39,
    From: data.from, To: data.to, Sorted: data.sorted, Selections: data.selections } }
  api.mockResolvedValue([wire])
  const [template] = await getServerReportTemplates()
  expect(template.Data).toEqual(data)
  api.mockResolvedValue(wire)
  await saveServerReportTemplate(template)
  expect(api).toHaveBeenLastCalledWith('/report/templates/save', { method: 'POST', body: { Id: wire.Id, Revision: 1, Name: wire.Name, Data: data } })
})
it('refuses malformed manager references and unbounded requests before any HTTP call or template save', async () => {
  const invalid = { ...currentVparivanieRequest(), selections: [exactSelection(1), exactSelection(60)] }
  await expect(createStockReport(invalid)).rejects.toThrow('Оберіть товари')
  await expect(previewStockReport({ ...invalid, selections: [] })).rejects.toThrow('Оберіть товари')
  await expect(saveServerReportTemplate({ Name: 'Invalid', Data: invalid })).rejects.toThrow('Оберіть товари')
  expect(api).not.toHaveBeenCalled()
})
it('preserves native bigint lookup identities and rejects unavailable unrelated lookup without HTTP', async () => {
  api.mockResolvedValue([{ Id: '9223372036854775807', Name: 'Synthetic' }])
  await expect(searchDatasetReportValues(39, 4, { offset: 0, limit: 30, value: ' s ' })).resolves.toEqual([{ Id: '9223372036854775807', Name: 'Synthetic' }])
  api.mockClear()
  await expect(searchDatasetReportValues(39, 10, { offset: 0, limit: 30, value: 's' })).rejects.toThrow('недоступний')
  expect(api).not.toHaveBeenCalled()
  api.mockResolvedValue([{ Id: Number('9223372036854775807'), Name: 'Rounded' }])
  await expect(searchDatasetReportValues(39, 1, { offset: 0, limit: 30, value: 's' })).rejects.toThrow('некоректні значення')
})

it('refuses another dataset preview instead of showing its cells under current-matrix filters', async () => {
  const Preview = currentVparivaniePreview()
  Preview.Request.DataSource = 'NativeVparivanie'
  Reflect.deleteProperty(Preview,'CurrentVparivanieProducts')
  api.mockResolvedValue({DocumentURL:'/report/other.xlsx',Preview})
  await expect(previewStockReport(currentVparivanieRequest())).rejects.toThrow('іншого набору')
  expect(api).toHaveBeenCalledOnce()
})
