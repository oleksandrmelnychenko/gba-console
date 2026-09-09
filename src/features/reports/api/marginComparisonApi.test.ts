import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { createStockReport, searchDatasetReportValues } from './reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from './reportWorkspaceApi'
import { actualMarginRequestWire, marginDataset, marginRequest } from '../data/marginComparison.test-fixtures'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => vi.mocked(apiRequest).mockReset())
it('accepts frozen source20 capabilities and serializes only explicit independent parameters', async () => {
  vi.mocked(apiRequest).mockResolvedValueOnce([marginDataset]); expect(await getReportDatasets()).toEqual([marginDataset])
  const body = marginRequest(), before = structuredClone(body)
  vi.mocked(apiRequest).mockResolvedValueOnce({ DocumentURL: '/reports/revenue.xlsx' }); await createStockReport(body)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/stocks/generate', { method: 'POST', body }); expect(body).toEqual(before)
})
it.each(['MarginComparison', 'BaseResource', 'Extra', 'Comparison', 'RevenueComparison', 'BuyerSalesShare', 'Ordering', 'Row', 'Measurements'])('rejects malformed %s before generation AND direct template I/O', async field => {
  const body = marginRequest()
  if (field === 'MarginComparison') body.marginComparison = { unknown: true }
  if (field === 'BaseResource') (body.marginComparison as { BaseResource: number }).BaseResource = 2
  if (field === 'Extra') Object.assign(body.marginComparison as object, { Extra: true })
  if (field === 'Comparison') body.comparison = { Version: 1, From: '2026-01-01', To: '2026-02-01' }
  if (field === 'RevenueComparison') body.revenueComparison = {}
  if (field === 'BuyerSalesShare') body.buyerSalesShare = {}
  if (field === 'Ordering') body.ordering = { Version: 1 }
  if (field === 'Row') body.sorted.Row.reverse()
  if (field === 'Measurements') body.sorted.Measurements = []
  await expect(createStockReport(body)).rejects.toThrow(); await expect(saveServerReportTemplate({ Id: crypto.randomUUID(), Name: 'invalid', Data: body })).rejects.toThrow(); expect(apiRequest).not.toHaveBeenCalled()
})
it('rejects altered capability policies and source20 options on previous dataset capabilities', async () => {
  for (const value of [{ ...marginDataset, MarginComparison: { ...marginDataset.MarginComparison as object, SourceParityVerified: true } }, { ...marginDataset, DataSource: 15 }]) {
    vi.mocked(apiRequest).mockResolvedValueOnce([value]); await expect(getReportDatasets()).rejects.toThrow()
  }
})
it('clones saved options, literal legacy identity layer, selected order and revision across update', async () => {
  const data = marginRequest(); data.sorted.Measurements.reverse()
  data.selections = [{ IsChecked: true, SelectedField: { Type: 9, Name: 'Contract' }, FilterCondition: { Type: 2, Name: 'InList' }, Values: [{ Data: '{"Id":"9007199254740993"}', Value: 0, Name: 'ExactCA' }] }] as unknown as typeof data.selections
  const template = { Id: crypto.randomUUID(), Name: 'Маржа', Revision: 7, Data: { From: data.from, To: data.to, Sorted: data.sorted, Selections: data.selections, DataSource: 20, MarginComparison: data.marginComparison } }
  vi.mocked(apiRequest).mockResolvedValueOnce([template]); const [loaded] = await getServerReportTemplates()
  expect(loaded.Data.MarginComparison).toEqual(data.marginComparison); expect(loaded.Data.MarginComparison).not.toBe(data.marginComparison)
  expect(loaded.Data.selections).toEqual(data.selections); expect(loaded.Data.selections).not.toBe(data.selections); expect(loaded.Data.sorted).not.toBe(data.sorted)
  vi.mocked(apiRequest).mockResolvedValueOnce({ ...template, Revision: 8 }); expect((await saveServerReportTemplate(loaded)).Revision).toBe(8)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/templates/save', { method: 'POST', body: loaded })
})
it('keeps duplicate saved aliases visible until rejection rather than silently picking one', async () => {
  const data = marginRequest(), template = { Id: crypto.randomUUID(), Name: 'bad', Revision: 1, Data: { From: data.from, To: data.to, Sorted: data.sorted, Selections: [], DataSource: 20, MarginComparison: data.marginComparison, marginComparison: data.marginComparison } }
  vi.mocked(apiRequest).mockResolvedValueOnce([template]); const [loaded] = await getServerReportTemplates(); vi.mocked(apiRequest).mockClear()
  await expect(saveServerReportTemplate(loaded)).rejects.toThrow(/двічі/); expect(apiRequest).not.toHaveBeenCalled()
})
it('accepts exact digit-string native lookup IDs without rounding and keeps old lookup guard', async () => {
  const params = { value: '9007199254740993', offset: 0, limit: 30 }, item = { Id: '9007199254740993', Name: 'Договір' }
  vi.mocked(apiRequest).mockResolvedValueOnce([item]); expect(await searchDatasetReportValues(20, 9, params)).toEqual([item])
  vi.mocked(apiRequest).mockResolvedValueOnce([{ ...item, Id: 9007199254740992 }]); await expect(searchDatasetReportValues(20, 9, params)).rejects.toThrow()
  vi.mocked(apiRequest).mockResolvedValueOnce([item]); await expect(searchDatasetReportValues(15, 9, params)).rejects.toThrow()
})

it('freezes generation and save inputs before awaited transport', async () => {
  const data = marginRequest(), before = structuredClone(data)
  let finish: ((value: unknown) => void) | undefined
  vi.mocked(apiRequest).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const generated = createStockReport(data)
  const sent = vi.mocked(apiRequest).mock.calls[0][1]!.body as typeof data
  expect(sent).not.toBe(data); expect(sent.sorted).not.toBe(data.sorted)
  Object.assign(data.marginComparison as object, { From: '2020-01-01' }); data.sorted.Measurements.reverse()
  expect(sent).toEqual(before)
  finish!({ DocumentURL: '/reports/share.xlsx' }); await generated
  const template = { Id: crypto.randomUUID(), Name: 'Заморожені параметри', Revision: 2, Data: marginRequest() }
  const expected = structuredClone(template)
  vi.mocked(apiRequest).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const saving = saveServerReportTemplate(template)
  const savedBody = vi.mocked(apiRequest).mock.calls[1][1]!.body as typeof template
  template.Data.sorted.Measurements.length = 0; Object.assign(template.Data.marginComparison as object, { To: '2020-01-01' })
  expect(savedBody).toEqual(expected); expect(savedBody.Data).not.toBe(template.Data)
  finish!({ Id: expected.Id, Name: expected.Name, Revision: 3, Data: { DataSource: 20, From: expected.Data.from, To: expected.Data.to, Sorted: expected.Data.sorted, Selections: expected.Data.selections, MarginComparison: expected.Data.marginComparison } })
  expect((await saving).Revision).toBe(3)
})

it.each([1, 2, 6, 9])('requires literal source20 string ID before JSON precision is lost for lookup field%i', async field => {
  const params = { value: '9007199254740993', offset: 0, limit: 30 }, item = { Id: '9007199254740993', Name: 'Точний відбір' }
  vi.mocked(apiRequest).mockResolvedValueOnce([item]); expect(await searchDatasetReportValues(20, field, params)).toEqual([item])
  for (const Id of [123, 9007199254740992, '9223372036854775808', '01']) {
    vi.mocked(apiRequest).mockResolvedValueOnce([{ ...item, Id }]); await expect(searchDatasetReportValues(20, field, params)).rejects.toThrow()
  }
})

it.each([0, false, [], {}, '2026-2-01', '2026-02-29'])('rejects noncanonical current date token %j before any I/O', async from => {
  const body = Object.assign(marginRequest(), {from})
  await expect(createStockReport(body)).rejects.toThrow()
  await expect(saveServerReportTemplate({Name:'invalid',Data:body})).rejects.toThrow()
  expect(apiRequest).not.toHaveBeenCalled()
})
it('rejects active and unchecked duplicate metrics before generation and save I/O', async () => {
  const body = marginRequest(); body.sorted.Measurements = [body.sorted.Measurements[0], {...body.sorted.Measurements[0],IsChecked:false}]
  await expect(createStockReport(body)).rejects.toThrow()
  await expect(saveServerReportTemplate({Name:'invalid',Data:body})).rejects.toThrow()
  expect(apiRequest).not.toHaveBeenCalled()
})
it.each(['Groupings','Measurements','Filters'])('rejects a capability with altered exact %s fields', async key => {
  const value = structuredClone(marginDataset)
  if (key === 'Groupings') value.Groupings.reverse()
  if (key === 'Measurements') value.Measurements[0].Name = 'Інший показник'
  if (key === 'Filters') value.Filters[0].Type = 14
  vi.mocked(apiRequest).mockResolvedValueOnce([value])
  await expect(getReportDatasets()).rejects.toThrow()
})

it.each([true, false])('rejects more than2000 raw filter entries even repeated or disabled (%s) before I/O', async enabled => {
  const body = marginRequest()
  body.selections = Array.from({length:2}, () => ({IsChecked:enabled,SelectedField:{Type:9,Name:'Contract'},FilterCondition:{Type:2,Name:'InList'},Values:Array.from({length:1001}, () => ({Data:{Id:201},Name:'same contract',Value:0}))}))
  await expect(createStockReport(body)).rejects.toThrow(/2 000/)
  await expect(saveServerReportTemplate({Name:'too many entries',Data:body})).rejects.toThrow(/2 000/)
  expect(apiRequest).not.toHaveBeenCalled()
})

it('normalizes actual C# serialized request casing and nullable flags without changing selected fields', async () => {
  const wire = {Id:crypto.randomUUID(),Revision:1,UpdatedAtUtc:'2026-09-09T12:00:00Z',Name:'Фактичний формат сервера',Data:structuredClone(actualMarginRequestWire)}
  vi.mocked(apiRequest).mockResolvedValueOnce([wire])
  const [loaded] = await getServerReportTemplates()
  expect(loaded.Data.MarginComparison).toEqual(actualMarginRequestWire.MarginComparison)
  expect(loaded.Data.sorted).toEqual(actualMarginRequestWire.Sorted)
  expect(loaded.Data.from).toBe('2026-07-01')
  expect(loaded.Data.to).toBe('2026-07-31')
  vi.mocked(apiRequest).mockResolvedValueOnce({DocumentURL:'/reports/margin.xlsx'})
  await expect(createStockReport(loaded.Data)).resolves.toMatchObject({document:{DocumentURL:'/reports/margin.xlsx'}})
})
