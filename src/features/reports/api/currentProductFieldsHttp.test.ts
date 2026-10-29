import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getReportDatasets, getServerReportTemplates } from './reportWorkspaceApi'
import { getStockReportPreviewPage, previewStockReport } from './reportsApi'
import fixture from '../data/currentProductFields.server-fixture.json'
import detailFixture from '../data/documentDetails.server-fixture.json'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => { api.mockReset() })
it('accepts actual v2 product HTTP capability and cached page proofs without changing money, state or ordered attributes', async () => {
  api.mockResolvedValue([{ ...detailFixture.dataset, workbookPresentation: fixture.capability }]); const [dataset] = await getReportDatasets()
  api.mockResolvedValue([{ Id: 'server-product-fixture', Revision: 1, UpdatedAtUtc: '2026-10-29T00:00:00Z', Name: 'Поточні поля', Data: fixture.request }])
  const [template] = await getServerReportTemplates(), request = template.Data
  api.mockResolvedValueOnce({ Version: 2, ExplicitExport: true, MaximumPageRows: 200, TimeToLiveSeconds: 900 }).mockResolvedValueOnce(fixture.page0)
  const first = await previewStockReport(request, dataset)
  expect(api).toHaveBeenLastCalledWith('/report/stocks/preview', expect.objectContaining({ query: { rowOffset: 0, rowLimit: 5, previewVersion: 2 }, body: request }))
  expect(first.preview.WorkbookPresentation?.selection.additionalFields).toEqual([66, 2, 65, 3])
  expect(first.preview.WorkbookPresentation?.rows[0].values.map(value => value.state)).toEqual(['known', 'known', 'known', 'known'])
  expect(first.preview.Cells).toEqual(fixture.page0.Preview.Cells)
  api.mockResolvedValue(fixture.page1)
  const next = await getStockReportPreviewPage(first.preview.ResultSession!, request, 1)
  expect(api).toHaveBeenLastCalledWith(`/report/stocks/preview/${fixture.page0.ResultId}`, expect.objectContaining({ query: { rowOffset: 1, rowLimit: 5 } }))
  expect(next.WorkbookPresentation?.rows[0].values.map(value => value.state)).toEqual(['null', 'known', 'null', 'known'])
  expect(next.WorkbookPresentation?.rows[0].values[1].values).toEqual(['A-2'])
  expect(next.Cells).toEqual(fixture.page1.Preview.Cells)
  expect(next.Totals?.Values).toEqual(first.preview.Totals?.Values)
  expect(next.ResultSha256).toBe(first.preview.ResultSha256)
  expect(next.WorkbookPresentation?.rows[0].rowKeySha256).not.toBe(first.preview.WorkbookPresentation?.rows[0].rowKeySha256)
})
