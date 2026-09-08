import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { createStockReport, searchDatasetReportValues } from './reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from './reportWorkspaceApi'
import { buyerShareDataset, buyerShareRequest } from '../data/buyerSalesShare.test-fixtures'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => vi.mocked(apiRequest).mockReset())
it('accepts actual source17 capabilities and serializes only explicit independent parameters', async () => {
  vi.mocked(apiRequest).mockResolvedValueOnce([buyerShareDataset]); expect(await getReportDatasets()).toEqual([buyerShareDataset])
  const body = buyerShareRequest(), before = structuredClone(body)
  vi.mocked(apiRequest).mockResolvedValueOnce({ DocumentURL: '/reports/revenue.xlsx' }); await createStockReport(body)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/stocks/generate', { method: 'POST', body }); expect(body).toEqual(before)
})
it.each(['BuyerSalesShare', 'BaseResource', 'Extra', 'Comparison', 'RevenueComparison', 'Ordering', 'Row', 'Measurements'])('rejects malformed %s before generation AND direct template I/O', async field => {
  const body = buyerShareRequest()
  if (field === 'BuyerSalesShare') body.buyerSalesShare = { unknown: true }
  if (field === 'BaseResource') (body.buyerSalesShare as { BaseResource: number }).BaseResource = 2
  if (field === 'Extra') Object.assign(body.buyerSalesShare as object, { Extra: true })
  if (field === 'Comparison') body.comparison = { Version: 1, From: '2026-01-01', To: '2026-02-01' }
  if (field === 'RevenueComparison') body.revenueComparison = { Version: 1 }
  if (field === 'Ordering') body.ordering = { Version: 1 }
  if (field === 'Row') body.sorted.Row.reverse()
  if (field === 'Measurements') body.sorted.Measurements = []
  await expect(createStockReport(body)).rejects.toThrow(); await expect(saveServerReportTemplate({ Id: crypto.randomUUID(), Name: 'invalid', Data: body })).rejects.toThrow(); expect(apiRequest).not.toHaveBeenCalled()
})
it('rejects altered capability policies and source17 options on previous dataset capabilities', async () => {
  for (const value of [{ ...buyerShareDataset, BuyerSalesShare: { ...buyerShareDataset.BuyerSalesShare as object, SourceParityVerified: true } }, { ...buyerShareDataset, DataSource: 15 }]) {
    vi.mocked(apiRequest).mockResolvedValueOnce([value]); await expect(getReportDatasets()).rejects.toThrow()
  }
})
it('clones saved options, literal legacy identity layer, selected order and revision across update', async () => {
  const data = buyerShareRequest(); data.sorted.Measurements.reverse()
  data.selections = [{ IsChecked: true, SelectedField: { Type: 9, Name: 'Contract' }, FilterCondition: { Type: 2, Name: 'InList' }, Values: [{ Data: '{"Id":"9007199254740993"}', Value: 0, Name: 'ExactCA' }] }] as unknown as typeof data.selections
  const template = { Id: crypto.randomUUID(), Name: 'Виручка', Revision: 7, Data: { From: data.from, To: data.to, Sorted: data.sorted, Selections: data.selections, DataSource: 17, BuyerSalesShare: data.buyerSalesShare } }
  vi.mocked(apiRequest).mockResolvedValueOnce([template]); const [loaded] = await getServerReportTemplates()
  expect(loaded.Data.BuyerSalesShare).toEqual(data.buyerSalesShare); expect(loaded.Data.BuyerSalesShare).not.toBe(data.buyerSalesShare)
  expect(loaded.Data.selections).toEqual(data.selections); expect(loaded.Data.selections).not.toBe(data.selections); expect(loaded.Data.sorted).not.toBe(data.sorted)
  vi.mocked(apiRequest).mockResolvedValueOnce({ ...template, Revision: 8 }); expect((await saveServerReportTemplate(loaded)).Revision).toBe(8)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/templates/save', { method: 'POST', body: loaded })
})
it('keeps duplicate saved aliases visible until rejection rather than silently picking one', async () => {
  const data = buyerShareRequest(), template = { Id: crypto.randomUUID(), Name: 'bad', Revision: 1, Data: { From: data.from, To: data.to, Sorted: data.sorted, Selections: [], DataSource: 17, BuyerSalesShare: data.buyerSalesShare, buyerSalesShare: data.buyerSalesShare } }
  vi.mocked(apiRequest).mockResolvedValueOnce([template]); const [loaded] = await getServerReportTemplates(); vi.mocked(apiRequest).mockClear()
  await expect(saveServerReportTemplate(loaded)).rejects.toThrow(/двічі/); expect(apiRequest).not.toHaveBeenCalled()
})
it('accepts safe numeric or exact digit-string native lookup IDs without rounding and keeps old lookup guard', async () => {
  const params = { value: '9007199254740993', offset: 0, limit: 30 }, item = { Id: '9007199254740993', Name: 'Договір' }
  vi.mocked(apiRequest).mockResolvedValueOnce([item]); expect(await searchDatasetReportValues(17, 9, params)).toEqual([item])
  vi.mocked(apiRequest).mockResolvedValueOnce([{ ...item, Id: 9007199254740992 }]); await expect(searchDatasetReportValues(17, 9, params)).rejects.toThrow()
  vi.mocked(apiRequest).mockResolvedValueOnce([item]); await expect(searchDatasetReportValues(15, 9, params)).rejects.toThrow()
})

it('freezes generation and save inputs before awaited transport', async () => {
  const data = buyerShareRequest(), before = structuredClone(data)
  let finish: ((value: unknown) => void) | undefined
  vi.mocked(apiRequest).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const generated = createStockReport(data)
  const sent = vi.mocked(apiRequest).mock.calls[0][1]!.body as typeof data
  expect(sent).not.toBe(data); expect(sent.sorted).not.toBe(data.sorted)
  Object.assign(data.buyerSalesShare as object, { From: '2020-01-01' }); data.sorted.Measurements.reverse()
  expect(sent).toEqual(before)
  finish!({ DocumentURL: '/reports/share.xlsx' }); await generated
  const template = { Id: crypto.randomUUID(), Name: 'Заморожені параметри', Revision: 2, Data: buyerShareRequest() }
  const expected = structuredClone(template)
  vi.mocked(apiRequest).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const saving = saveServerReportTemplate(template)
  const savedBody = vi.mocked(apiRequest).mock.calls[1][1]!.body as typeof template
  template.Data.sorted.Measurements.length = 0; Object.assign(template.Data.buyerSalesShare as object, { To: '2020-01-01' })
  expect(savedBody).toEqual(expected); expect(savedBody.Data).not.toBe(template.Data)
  finish!({ Id: expected.Id, Name: expected.Name, Revision: 3, Data: { DataSource: 17, From: expected.Data.from, To: expected.Data.to, Sorted: expected.Data.sorted, Selections: expected.Data.selections, BuyerSalesShare: expected.Data.buyerSalesShare } })
  expect((await saving).Revision).toBe(3)
})
