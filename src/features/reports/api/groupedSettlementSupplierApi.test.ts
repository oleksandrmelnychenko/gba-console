import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getReportDatasets } from './reportWorkspaceApi'
import { createStockReport, previewStockReport, searchDatasetReportValues } from './reportsApi'
import { groupedSettlementSupplierDataset as dataset, groupedSettlementSupplierRequest as request, supplierSelection } from '../data/groupedSettlementSupplier.test-fixtures'
import { currentVparivaniePreview } from '../data/currentVparivanie.test-fixtures'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => api.mockReset())
it('normalizes the new capability without changing the native dataset or current draft scope', async () => {
  api.mockResolvedValue([dataset])
  await expect(getReportDatasets()).resolves.toEqual([dataset])
})
it.each([17, 18])('reads only exact native supplier field %s through the existing lookup route', async field => {
  api.mockResolvedValue([{ Id: '9223372036854775807', Name: 'Synthetic native supplier identity' }])
  await expect(searchDatasetReportValues(41, field, { value: 'Synthetic', offset: 0, limit: 30 })).resolves.toMatchObject([{ Id: '9223372036854775807' }])
  expect(api).toHaveBeenLastCalledWith('/report/datasets/lookup', expect.objectContaining({
    query: { dataSource: 41, field, value: 'Synthetic', offset: 0, limit: 30 },
  }))
  await expect(searchDatasetReportValues(41, 19, { value: '', offset: 0, limit: 30 })).rejects.toThrow('недоступний')
  expect(api).toHaveBeenCalledOnce()
})
it('shares exact supplier request and untouched server NULLs between inline preview and XLSX/PDF generation', async () => {
  const data = request(); delete data.sourceBuyerSubtree
  data.selections = [supplierSelection(17, '9007199254740993'), supplierSelection(18, '9223372036854775807')]
  const Preview = currentVparivaniePreview()
  Reflect.deleteProperty(Preview, 'CurrentVparivanieProducts'); Preview.Request.DataSource = 'NativeSettlementPeriod'
  Preview.Cells[0].Value.Value = null
  api.mockResolvedValue({ Preview })
  const resultPreview = await previewStockReport(data)
  expect(resultPreview.preview.Cells).toEqual(Preview.Cells)
  expect(resultPreview.preview.Cells[0].Value.Value).toBeNull()
  expect(api.mock.calls[0][1]?.body).toEqual(data)
  api.mockResolvedValue({ DocumentURL: '/files/suppliers.xlsx', PdfDocumentURL: '/files/suppliers.pdf' })
  const result = await createStockReport(data)
  expect(api.mock.calls[1][1]?.body).toEqual(data)
  expect(result.document).toMatchObject({ DocumentURL: '/files/suppliers.xlsx', PdfDocumentURL: '/files/suppliers.pdf' })
  expect(data).not.toHaveProperty('sourceBuyerSubtree')
})
