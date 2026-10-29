import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getReportDatasets, getServerReportTemplates } from './reportWorkspaceApi'
import { createStockReport, previewStockReport } from './reportsApi'
import fixture from '../data/documentDetails.server-fixture.json'
import { documentDetailsError } from '../data/reportDocumentDetails'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => api.mockReset())
it.each(['sales', 'grossProfit'] as const)('accepts actual server HTTP %s metadata, exact sale/return identities, financial cells and template wire', async profile => {
  api.mockResolvedValue([fixture.dataset]); const [dataset] = await getReportDatasets()
  api.mockResolvedValue([{ Id: 'server-detail-fixture', Revision: 1, UpdatedAtUtc: '2026-10-29T00:00:00Z', Name: 'Деталі', Data: fixture[profile].request }])
  const [saved] = await getServerReportTemplates(), request = saved.Data
  expect(documentDetailsError(request, dataset)).toBeNull()
  expect(request.sorted.Row.map(row => row.type)).toEqual([5, 84])
  api.mockResolvedValue({ Preview: fixture[profile].preview })
  // This retained fixture is the HTTP Preview DTO, not the cached-session envelope.
  const result = await previewStockReport(request)
  expect(result.preview.Rows.map(row => row.Values[1].Identity?.Value)).toEqual(['R:1:1:1', 'S:1:1:1', 'S:1:1:2'])
  expect(result.preview.Cells).toEqual(fixture[profile].preview.Cells)
  expect(result.preview.Totals).toEqual(fixture[profile].preview.Totals)
  expect(result.preview.Cells.filter(cell => cell.ColumnSourceIndex === 2).map(cell => cell.Value)).toEqual([
    { Kind: 'null', Value: null, Provenance: 'producerCell' }, { Kind: 'null', Value: null, Provenance: 'producerCell' }, { Kind: 'null', Value: null, Provenance: 'producerCell' },
  ])
  api.mockResolvedValue({ document: {} }); await createStockReport(request, dataset)
  expect(api).toHaveBeenLastCalledWith('/report/stocks/generate', expect.objectContaining({ body: request }))
})
