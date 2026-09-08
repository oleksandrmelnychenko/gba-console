import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { createStockReport, searchDatasetReportValues } from './reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from './reportWorkspaceApi'
import { revenueDataset, revenueRequest } from '../data/revenueComparison.test-fixtures'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => vi.mocked(apiRequest).mockReset())
it('accepts actual source16 capabilities and serializes only explicit independent parameters', async () => {
  vi.mocked(apiRequest).mockResolvedValueOnce([revenueDataset]); expect(await getReportDatasets()).toEqual([revenueDataset])
  const body = revenueRequest(), before = structuredClone(body)
  vi.mocked(apiRequest).mockResolvedValueOnce({ DocumentURL: '/reports/revenue.xlsx' }); await createStockReport(body)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/stocks/generate', { method: 'POST', body }); expect(body).toEqual(before)
})
it.each(['RevenueComparison', 'BaseResource', 'Extra', 'Comparison', 'Ordering', 'Row', 'Measurements'])('rejects malformed %s before generation AND direct template I/O', async field => {
  const body = revenueRequest()
  if (field === 'RevenueComparison') body.revenueComparison = { unknown: true }
  if (field === 'BaseResource') (body.revenueComparison as { BaseResource: number }).BaseResource = 2
  if (field === 'Extra') Object.assign(body.revenueComparison as object, { Extra: true })
  if (field === 'Comparison') body.comparison = { Version: 1, From: '2026-01-01', To: '2026-02-01' }
  if (field === 'Ordering') body.ordering = { Version: 1 }
  if (field === 'Row') body.sorted.Row.reverse()
  if (field === 'Measurements') body.sorted.Measurements = []
  await expect(createStockReport(body)).rejects.toThrow(); await expect(saveServerReportTemplate({ Id: crypto.randomUUID(), Name: 'invalid', Data: body })).rejects.toThrow(); expect(apiRequest).not.toHaveBeenCalled()
})
it('rejects altered capability policies and source16 options on previous dataset capabilities', async () => {
  for (const value of [{ ...revenueDataset, RevenueComparison: { ...revenueDataset.RevenueComparison as object, SourceParityVerified: true } }, { ...revenueDataset, DataSource: 15 }]) {
    vi.mocked(apiRequest).mockResolvedValueOnce([value]); await expect(getReportDatasets()).rejects.toThrow()
  }
})
it('clones saved options, literal legacy identity layer, selected order and revision across update', async () => {
  const data = revenueRequest(); data.sorted.Measurements.reverse()
  data.selections = [{ IsChecked: true, SelectedField: { Type: 9, Name: 'Contract' }, FilterCondition: { Type: 2, Name: 'InList' }, Values: [{ Data: '{"Id":"9007199254740993"}', Value: 0, Name: 'ExactCA' }] }] as unknown as typeof data.selections
  const template = { Id: crypto.randomUUID(), Name: 'Виручка', Revision: 7, Data: { From: data.from, To: data.to, Sorted: data.sorted, Selections: data.selections, DataSource: 16, RevenueComparison: data.revenueComparison } }
  vi.mocked(apiRequest).mockResolvedValueOnce([template]); const [loaded] = await getServerReportTemplates()
  expect(loaded.Data.RevenueComparison).toEqual(data.revenueComparison); expect(loaded.Data.RevenueComparison).not.toBe(data.revenueComparison)
  expect(loaded.Data.selections).toEqual(data.selections); expect(loaded.Data.selections).not.toBe(data.selections); expect(loaded.Data.sorted).not.toBe(data.sorted)
  vi.mocked(apiRequest).mockResolvedValueOnce({ ...template, Revision: 8 }); expect((await saveServerReportTemplate(loaded)).Revision).toBe(8)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/templates/save', { method: 'POST', body: loaded })
})
it('keeps duplicate saved aliases visible until rejection rather than silently picking one', async () => {
  const data = revenueRequest(), template = { Id: crypto.randomUUID(), Name: 'bad', Revision: 1, Data: { From: data.from, To: data.to, Sorted: data.sorted, Selections: [], DataSource: 16, RevenueComparison: data.revenueComparison, revenueComparison: data.revenueComparison } }
  vi.mocked(apiRequest).mockResolvedValueOnce([template]); const [loaded] = await getServerReportTemplates(); vi.mocked(apiRequest).mockClear()
  await expect(saveServerReportTemplate(loaded)).rejects.toThrow(/двічі/); expect(apiRequest).not.toHaveBeenCalled()
})
it('accepts safe numeric or exact digit-string native lookup IDs without rounding and keeps old lookup guard', async () => {
  const params = { value: '9007199254740993', offset: 0, limit: 30 }, item = { Id: '9007199254740993', Name: 'Договір' }
  vi.mocked(apiRequest).mockResolvedValueOnce([item]); expect(await searchDatasetReportValues(16, 9, params)).toEqual([item])
  vi.mocked(apiRequest).mockResolvedValueOnce([{ ...item, Id: 9007199254740992 }]); await expect(searchDatasetReportValues(16, 9, params)).rejects.toThrow()
  vi.mocked(apiRequest).mockResolvedValueOnce([item]); await expect(searchDatasetReportValues(15, 9, params)).rejects.toThrow()
})
