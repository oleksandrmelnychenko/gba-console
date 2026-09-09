import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { rateDataset, rateRequest } from '../data/rateComparison.test-fixtures'
import { createStockReport, searchDatasetReportValues } from './reportsApi'
import { getReportDatasets, normalizeSavedTemplate, saveServerReportTemplate } from './reportWorkspaceApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => vi.clearAllMocks())
it('accepts declared source19 capability without a generic filter or interval', async () => {
  vi.mocked(apiRequest).mockResolvedValue([rateDataset]); expect(await getReportDatasets()).toEqual([rateDataset])
})
it.each(['sourceParityVerified', 'totalsSupported', 'rateDecimals', 'lookupFields', 'dateSemantics'])('rejects changed capability %s', field => {
  const capability = { ...rateDataset.rateComparison as object, [field]: 'changed' }
  vi.mocked(apiRequest).mockResolvedValue([{ ...rateDataset, rateComparison: capability }]); return expect(getReportDatasets()).rejects.toThrow()
})
it.each([{ PeriodSupported: true }, { PeriodRequired: true }, { Filters: [{ Type: 39, Name: 'Series' }] }, { DataSource: 18 }])('rejects incompatible dataset %#', patch => {
  vi.mocked(apiRequest).mockResolvedValue([{ ...rateDataset, ...patch }]); return expect(getReportDatasets()).rejects.toThrow()
})
it.each([39, 40])('reads exact native string identities for field%i', async field => {
  vi.mocked(apiRequest).mockResolvedValue([{ Id: '9007199254740993', Name: 'Точна серія' }])
  expect((await searchDatasetReportValues(19, field, { value: 'EUR', limit: 30, offset: 0 }))[0].Id).toBe('9007199254740993')
  expect(apiRequest).toHaveBeenCalledWith('/report/datasets/lookup', { query: { dataSource: 19, field, value: 'EUR', limit: 30, offset: 0 }, signal: undefined })
})
it.each([1, '01', '9223372036854775808'])('rejects malformed lookup ID %s', async Id => {
  vi.mocked(apiRequest).mockResolvedValue([{ Id, Name: 'bad' }]); await expect(searchDatasetReportValues(19, 39, { value: '', limit: 30, offset: 0 })).rejects.toThrow()
})
it.each(['option', 'duplicate', 'period', 'filter', 'measure'])('blocks malformed %s before generate or direct template I/O', async field => {
  const data = rateRequest()
  if (field === 'option') Object.assign(data.rateComparison!, { Extra: true })
  if (field === 'duplicate') data.RateComparison = data.rateComparison
  if (field === 'period') data.from = '2026-07-31'
  if (field === 'filter') data.selections = [{} as never]
  if (field === 'measure') data.sorted.Measurements[0].Type = 47
  await expect(createStockReport(data)).rejects.toThrow(); await expect(saveServerReportTemplate({ Id: crypto.randomUUID(), Name: 'Курс', Revision: 0, Data: data })).rejects.toThrow(); expect(apiRequest).not.toHaveBeenCalled()
})
it('preserves PascalCase wire options and refuses alias conflict without rewriting data', () => {
  const data = rateRequest(), wire = { Id: crypto.randomUUID(), Name: 'Курс', Revision: 1, UpdatedAtUtc: '2026-09-09T00:00:00Z', Data: { DataSource: 19, From: '', To: '', Sorted: data.sorted, Selections: [], RateComparison: data.rateComparison } }
  const result = normalizeSavedTemplate(wire)
  expect(result.Data.RateComparison).toEqual(data.rateComparison); expect(result.Data.RateComparison).not.toBe(data.rateComparison); expect(result.Data.sorted).not.toBe(data.sorted)
})
it('snapshots generation and save bodies before awaiting API completion', async () => {
  let finish: (value: unknown) => void = () => undefined
  vi.mocked(apiRequest).mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const data = rateRequest(), expected = structuredClone(data), generating = createStockReport(data)
  Object.assign(data.rateComparison!, { RateDefinitionId: '1' }); data.sorted.Measurements.reverse()
  expect(vi.mocked(apiRequest).mock.calls[0][1]?.body).toEqual(expected); finish({ Document: {} }); await generating
  const template = { Id: crypto.randomUUID(), Name: 'Курс', Revision: 0, Data: rateRequest() }, expectedTemplate = structuredClone(template), saving = saveServerReportTemplate(template)
  Object.assign(template.Data.rateComparison!, { RateDefinitionId: '2' }); template.Data.sorted.Measurements.pop()
  expect(vi.mocked(apiRequest).mock.calls[1][1]?.body).toEqual(expectedTemplate)
  finish({ Id: template.Id, Name: 'Курс', Revision: 1, Data: { DataSource: 19, From: '', To: '', Sorted: expectedTemplate.Data.sorted, Selections: [], RateComparison: expectedTemplate.Data.rateComparison } }); await saving
})

it.each([0, false, 1, true, [], {}])('refuses nonempty/non-null top-level date token %j before I/O', async token => {
  for (const field of ['from', 'to']) { const data = rateRequest(); Object.assign(data, { [field]: token }); await expect(createStockReport(data)).rejects.toThrow() }
  expect(apiRequest).not.toHaveBeenCalled()
})

it('rejects a duplicate metric even when the duplicate is unchecked before any I/O', async () => {
  const data = rateRequest(); data.sorted.Measurements = [data.sorted.Measurements[0], { ...data.sorted.Measurements[0], IsChecked: false }]
  await expect(createStockReport(data)).rejects.toThrow(); await expect(saveServerReportTemplate({ Id: crypto.randomUUID(), Name: 'Курс', Revision: 0, Data: data })).rejects.toThrow(); expect(apiRequest).not.toHaveBeenCalled()
})
