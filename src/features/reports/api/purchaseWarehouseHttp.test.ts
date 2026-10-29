import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getReportDatasets, getServerReportTemplates } from './reportWorkspaceApi'
import { getStockReportPreviewPage, previewStockReport, searchDatasetReportValues } from './reportsApi'
import fixture from '../data/purchaseWarehouse.server-fixture.json'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => { api.mockReset() })

it('accepts actual receipt metadata, eligible numeric warehouse lookup and unchanged cached financial cells', async () => {
  api.mockResolvedValue([fixture.dataset])
  const [dataset] = await getReportDatasets()
  expect(dataset.Groupings.find(field => field.Type === 29)).toMatchObject({ Name: 'Склад надходження' })
  expect(dataset.Filters.find(field => field.Type === 21)).toMatchObject({ Name: 'Склад надходження' })
  expect(dataset.Filters.find(field => field.Type === 21)?.hierarchy).toBeUndefined()
  api.mockResolvedValue(fixture.lookup)
  const values = await searchDatasetReportValues(3, 21, { value: '', offset: 0, limit: 30 })
  expect(values).toEqual(fixture.lookup)
  expect(api).toHaveBeenLastCalledWith('/report/datasets/lookup', expect.objectContaining({ query: { dataSource: 3, field: 21, value: '', offset: 0, limit: 30 } }))
  expect(values.every(value => typeof value.Id === 'number' && Number.isSafeInteger(value.Id) && value.Id > 0)).toBe(true)
  api.mockResolvedValue([{ Id: 'receipt-warehouse-wire', Revision: 1, Name: 'Склад надходження', Data: fixture.request }])
  const [template] = await getServerReportTemplates()
  api.mockResolvedValueOnce({ Version: 2, ExplicitExport: true, MaximumPageRows: 200, TimeToLiveSeconds: 900 }).mockResolvedValueOnce(fixture.page0)
  const first = await previewStockReport(template.Data, dataset)
  expect(first.preview.Cells).toEqual(fixture.page0.Preview.Cells)
  expect(first.preview.Totals?.Values).toEqual(fixture.page0.Preview.Totals.Values)
  expect(first.preview.Rows).toEqual(fixture.page0.Preview.Rows)
  api.mockResolvedValue(fixture.page1)
  const next = await getStockReportPreviewPage(first.preview.ResultSession!, template.Data, fixture.page1.Preview.Page.Offset)
  expect(next.Cells).toEqual(fixture.page1.Preview.Cells)
  expect(next.Rows).toEqual(fixture.page1.Preview.Rows)
  expect(next.ResultSha256).toBe(first.preview.ResultSha256)
  expect(next.Totals?.Values).toEqual(first.preview.Totals?.Values)
})
