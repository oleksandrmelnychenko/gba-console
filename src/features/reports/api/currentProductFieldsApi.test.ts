import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { createStockReport, previewStockReport } from './reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from './reportWorkspaceApi'
import { productDataset, productPreview, productRequest } from '../data/currentProductFields.test-fixtures'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => { api.mockReset() })
it('binds a normal preview and export to the selected ordered product fields without rewriting financial axes', async () => {
  api.mockResolvedValue([productDataset]); await expect(getReportDatasets()).resolves.toEqual([productDataset])
  const request = productRequest('grossProfit'), original = structuredClone(request)
  api.mockResolvedValue({ Preview: productPreview() }); const result = await previewStockReport(request)
  expect(result.preview.WorkbookPresentation?.selection.additionalFields).toEqual([66, 2])
  api.mockResolvedValue({ document: {} }); await createStockReport(request)
  expect(api).toHaveBeenLastCalledWith('/report/stocks/generate', expect.objectContaining({ body: request }))
  expect(request).toEqual(original)
})
it('restores then saves Pascal-case template selector and period without losing its ordered fields', async () => {
  const request = productRequest()
  api.mockResolvedValue([{ Id: crypto.randomUUID(), Revision: 1, Name: 'Товарні реквізити', Data: {
    DataSource: 2, ReportProfile: 'sales', From: request.from, To: request.to, Sorted: request.sorted, Selections: [],
    WorkbookPresentation: { Version: 2, AdditionalFields: [66, 2], Ordering: null },
  } }])
  const [saved] = await getServerReportTemplates()
  expect(saved.Data.WorkbookPresentation).toEqual({ Version: 2, AdditionalFields: [66, 2], Ordering: null })
  expect(saved.Data.sorted.Row.map(row => row.type)).toEqual([7])
  saved.Data.from = '2026-09-01'
  api.mockResolvedValue({ Id: saved.Id, Revision: 2, Name: saved.Name, Data: { DataSource: 2, ReportProfile: 'sales', From: saved.Data.from, To: saved.Data.to, Sorted: saved.Data.sorted, Selections: [], WorkbookPresentation: saved.Data.WorkbookPresentation } })
  await saveServerReportTemplate(saved)
  expect(api).toHaveBeenLastCalledWith('/report/templates/save', expect.objectContaining({ body: expect.objectContaining({ Data: saved.Data }) }))
})
it('refuses unknown profile or missing row before dispatch, and changed response order after dispatch', async () => {
  await expect(createStockReport(productRequest('unknown'))).rejects.toThrow()
  const noProduct = productRequest(); noProduct.sorted.Row = [{ type: 4, key: 'Organization', label: 'Організація' }]
  await expect(createStockReport(noProduct)).rejects.toThrow('Додайте')
  expect(api).not.toHaveBeenCalled()
  const raw = productPreview(); raw.workbookPresentation.selection.additionalFields.reverse(); raw.workbookPresentation.fields.reverse(); raw.workbookPresentation.rows[0].values.reverse()
  api.mockResolvedValue({ Preview: raw }); await expect(previewStockReport(productRequest())).rejects.toThrow()
})
