import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { createStockReport } from './reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from './reportWorkspaceApi'
import { salesXyzDataset, salesXyzRequest } from '../data/salesXyz.test-fixtures'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => vi.mocked(apiRequest).mockReset())
it('accepts actual capability and passes XYZ request bytes without synthesizing units', async () => {
  vi.mocked(apiRequest).mockResolvedValueOnce([salesXyzDataset])
  expect(await getReportDatasets()).toEqual([salesXyzDataset])
  const body = salesXyzRequest(), before = structuredClone(body)
  vi.mocked(apiRequest).mockResolvedValueOnce({ DocumentURL: '/reports/xyz.xlsx' })
  await createStockReport(body)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/stocks/generate', { method: 'POST', body })
  expect(body).toEqual(before)
})
it.each(['Xyz', 'Bounds', 'Comparison', 'Ordering', 'Row', 'Measurements'])('rejects malformed %s before generation I/O', field => {
  const body = salesXyzRequest()
  if (field === 'Xyz') body.xyz = { unknown: true }
  if (field === 'Bounds') (body.xyz as { Bounds: unknown }).Bounds = { XLower: 0 }
  if (field === 'Comparison') body.comparison = { Version: 1, From: '2026-01-01', To: '2026-02-01' }
  if (field === 'Ordering') body.ordering = { Version: 1 }
  if (field === 'Row') body.sorted.Row.reverse()
  if (field === 'Measurements') body.sorted.Measurements = []
  return expect(createStockReport(body)).rejects.toThrow().then(() => expect(apiRequest).not.toHaveBeenCalled())
})
it('refuses an incomplete or contradictory public XYZ capability', async () => {
  vi.mocked(apiRequest).mockResolvedValue([{ ...salesXyzDataset, Xyz: { ...salesXyzDataset.Xyz as object, SourceParityVerified: true } }])
  await expect(getReportDatasets()).rejects.toThrow()
})
it('normalizes saved Pascal XYZ and clones exact bounds, dates, filters and revision', async () => {
  const data = salesXyzRequest(), { xyz, ...rest } = data
  const template = { Id: '018cefd0-2554-4999-a404-043bcb957be3', Name: 'XYZ збережений', Revision: 7, Data: { From: rest.from, To: rest.to, Sorted: rest.sorted, Selections: rest.selections, DataSource: 15, Xyz: xyz } }
  vi.mocked(apiRequest).mockResolvedValueOnce([template])
  const loaded = await getServerReportTemplates()
  expect(loaded[0]).toMatchObject({ Id: template.Id, Name: template.Name, Revision: 7, Data: { ...rest, Xyz: xyz } })
  expect(loaded[0].Data.Xyz).not.toBe(xyz)
  vi.mocked(apiRequest).mockResolvedValueOnce({ ...template, Revision: 8 })
  const saved = await saveServerReportTemplate(loaded[0])
  expect(saved.Revision).toBe(8)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/templates/save', { method: 'POST', body: loaded[0] })
})
