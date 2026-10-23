import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { searchAnalysisValues } from './currentVparivanieAnalysisApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from './reportWorkspaceApi'
import { createStockReport, previewStockReport, getStockReportPreviewPage } from './reportsApi'
import { analysisDataset, analysisPreview, analysisRequest } from '../data/currentVparivanieAnalysis.test-fixtures'
import { currentVparivanieRequest } from '../data/currentVparivanie.test-fixtures'
vi.mock('../../../shared/api/apiClient', async original => ({ ...await original<typeof import('../../../shared/api/apiClient')>(), apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => api.mockReset())
it('loads the real server capability and upgrades dataset-aware legacy generation to the complete analysis', async () => {
  api.mockResolvedValueOnce([analysisDataset])
  const [dataset] = await getReportDatasets()
  api.mockResolvedValueOnce({ DocumentURL: '/report.xlsx' })
  await createStockReport(currentVparivanieRequest(), dataset)
  expect(api).toHaveBeenLastCalledWith('/report/stocks/generate', expect.objectContaining({ body: expect.objectContaining({ currentVparivanieAnalysis: { version: 1 }, currentVparivanieFullScope: true }) }))
})
it('keeps sale and return identities distinct and uses server canonical selection data including textual Top', async () => {
  api.mockResolvedValueOnce([{ id: 'sale:123', name: 'ВН123 23.10.2026 14:35', data: '{"kind":"sale","id":123}' },
    { id: 'return:123', name: 'ПВ123 23.10.2026 15:00', data: '{"kind":"return","id":123}' }])
  expect(await searchAnalysisValues(12, '123', '2026-10-01', '2026-10-23', '50')).toEqual([
    { id: 'sale:123', name: 'ВН123 23.10.2026 14:35', data: { kind: 'sale', id: 123 } },
    { id: 'return:123', name: 'ПВ123 23.10.2026 15:00', data: { kind: 'return', id: 123 } },
  ])
  expect(api).toHaveBeenCalledWith('/report/datasets/current-vparivanie/analysis/lookup', expect.objectContaining({ query: { field: 12, value: '123', offset: 0, limit: 30, from: '2026-10-01', to: '2026-10-23', buyerId: '50' } }))
  api.mockResolvedValueOnce([{ id: 'top:X9', name: 'X9', data: '{"name":"X9"}' }])
  expect((await searchAnalysisValues(3, '', '', ''))[0].data).toEqual({ name: 'X9' })
})
it.each(['{"Id":9223372036854775807}', 'null', '[]', '{bad'])('refuses invalid or rounded lookup data %s', async data => {
  api.mockResolvedValue([{ id: 'x', name: 'x', data }])
  await expect(searchAnalysisValues(1, '', '', '')).rejects.toThrow()
})
it('roundtrips analysis mode in saved definitions without erasing axes or canonical filter values', async () => {
  const request = analysisRequest()
  const wire = { Id: 'saved', Revision: 1, Name: 'Grouped', UpdatedAtUtc: '2026-10-23T12:00:00Z', Data: {
    DataSource: 39, From: request.from, To: request.to, Sorted: request.sorted, Selections: request.selections,
    CurrentVparivanieAnalysis: { version: 1 }, CurrentVparivanieFullScope: true,
  } }
  api.mockResolvedValueOnce([wire])
  const [template] = await getServerReportTemplates()
  expect(template.Data).toEqual(request)
  api.mockResolvedValueOnce(wire)
  await saveServerReportTemplate(template)
  expect(api).toHaveBeenLastCalledWith('/report/templates/save', expect.objectContaining({ body: expect.objectContaining({ Data: request }) }))
})
it('binds preview and pagination to the same grouped result and refuses a missing coverage proof', async () => {
  const preview = analysisPreview(), request = analysisRequest()
  api.mockResolvedValueOnce({ Preview: preview })
  expect((await previewStockReport(request)).preview.currentVparivanieAnalysis?.allSalesFilterScope).toBe(true)
  const session = { ResultId: '11111111-2222-3333-4444-555555555555', RequestSha256: preview.RequestSha256, ResultSha256: preview.ResultSha256, ExpiresAtUtc: '2030-01-01T00:00:00Z' }
  api.mockResolvedValueOnce({ ...session, PreviewVersion: 2, Preview: preview })
  expect((await getStockReportPreviewPage(session, request, 0)).ResultSession).toEqual(session)
  preview.currentVparivanieAnalysis.fieldCoverage = []
  api.mockResolvedValueOnce({ Preview: preview })
  await expect(previewStockReport(request)).rejects.toThrow('покриття')
})
