import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { createStockReport, previewStockReport } from './reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from './reportWorkspaceApi'
import { presentedCashDataset, presentedCashRequest, workbookPreview } from '../data/workbookPresentation.test-fixtures'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => api.mockReset())

it('normalizes the current explicit capability and submits identical selectors for files and preview', async () => {
  api.mockResolvedValue([presentedCashDataset]); await expect(getReportDatasets()).resolves.toEqual([presentedCashDataset])
  const request = presentedCashRequest(), copy = structuredClone(request)
  api.mockResolvedValue({ document: {} }); await createStockReport(request)
  expect(api).toHaveBeenLastCalledWith('/report/stocks/generate', expect.objectContaining({ body: request }))
  api.mockResolvedValue({ Preview: workbookPreview() }); const result = await previewStockReport(request)
  expect(api).toHaveBeenLastCalledWith('/report/stocks/preview', expect.objectContaining({ body: request }))
  expect(result.preview.WorkbookPresentation?.selection).toEqual(request.workbookPresentation)
  expect(request).toEqual(copy)
})
it('rejects unknown selector versions and ambiguous aliases before any request dispatch', async () => {
  await expect(createStockReport({ ...presentedCashRequest(), WorkbookPresentation: {} })).rejects.toThrow()
  await expect(createStockReport({ ...presentedCashRequest(), workbookPresentation: { version: 2, additionalFields: [], ordering: null } })).rejects.toThrow()
  expect(api).not.toHaveBeenCalled()
})
it('rejects a server preview with changed field order or no proof despite a genuine-looking file link', async () => {
  const wrong = workbookPreview(); wrong.workbookPresentation.selection.additionalFields = [33, 30]
  wrong.workbookPresentation.fields.reverse(); wrong.workbookPresentation.rows[0].values.reverse()
  api.mockResolvedValue({ document: { DocumentURL: '/files/old.xlsx' }, Preview: wrong })
  await expect(previewStockReport(presentedCashRequest())).rejects.toThrow('додаткові поля')
  const absent = workbookPreview(); Reflect.deleteProperty(absent, 'workbookPresentation')
  api.mockResolvedValue({ Preview: absent }); await expect(previewStockReport(presentedCashRequest())).rejects.toThrow()
})
it('preserves a saved Pascal selector without losing its exact ordered subset or inventing another grouping', async () => {
  const request = presentedCashRequest()
  api.mockResolvedValue([{ Id: crypto.randomUUID(), Revision: 1, Name: 'Каса', Data: {
    DataSource: 40, From: request.from, To: request.to, Sorted: request.sorted, Selections: [],
    GroupedCashPeriod: request.groupedCashPeriod, WorkbookPresentation: { Version: 1, AdditionalFields: [33, 30], Ordering: null },
  } }])
  const [saved] = await getServerReportTemplates()
  expect(saved.Data.WorkbookPresentation).toEqual({ Version: 1, AdditionalFields: [33, 30], Ordering: null })
  expect(saved.Data.sorted.Row.map(row => row.type)).toEqual([40])
  api.mockImplementation(async (_path, options) => ({ ...(options?.body as object), Id: saved.Id, Revision: 2,
    Data: { DataSource: 40, From: request.from, To: request.to, Sorted: request.sorted, Selections: [],
      GroupedCashPeriod: request.groupedCashPeriod, WorkbookPresentation: saved.Data.WorkbookPresentation } }))
  await saveServerReportTemplate(saved)
  expect(api).toHaveBeenLastCalledWith('/report/templates/save', expect.objectContaining({ body: expect.objectContaining({ Data: saved.Data }) }))
})
it('refuses unsupported current capability shape rather than enabling display fields by a version label', async () => {
  api.mockResolvedValue([{ ...presentedCashDataset, workbookPresentation: { version: 1, additionalFields: [], orderings: [] } }])
  await expect(getReportDatasets()).rejects.toThrow('некоректний список')
  api.mockResolvedValue([{ ...presentedCashDataset, WorkbookPresentation: presentedCashDataset.workbookPresentation }])
  await expect(getReportDatasets()).rejects.toThrow('некоректний список')
})
