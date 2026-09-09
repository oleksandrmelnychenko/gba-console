import { describe, expect, it } from 'vitest'
import { marginComparisonConfigurationError, marginComparisonOptions, requestMarginComparison } from './marginComparison'
import { revenueExactId } from './revenueComparison'
import { datasetConfigurationError, datasetMeasurements, datasetPresetRequest, defaultDatasetRequest } from './reportDatasets'
import { flattenCheckedMeasurements } from './reportOptions'
import { marginDataset, marginRequest } from './marginComparison.test-fixtures'
import type { ReportRequestBody } from '../types'
const fail = (data: ReportRequestBody) => expect(marginComparisonConfigurationError(data, marginDataset)).toBeTruthy()
const select = (Data: unknown, Value: unknown = 0) => ({ IsChecked: true, SelectedField: { Type: 9, Name: 'Contract' }, FilterCondition: { Type: 2, Name: 'InList' }, Values: [{ Data, Name: 'Договір', Value }] })
describe('source20 exact request contract', () => {
  it.each(Array.from({ length: 15 }, (_, i) => i + 1))('keeps selected subset %i in caller order through builder reload', mask => {
    const data = marginRequest(); data.sorted.Measurements = data.sorted.Measurements.filter(m => mask & (1 << (m.Type - 55))).reverse()
    expect(datasetConfigurationError(data, marginDataset)).toBeNull()
    expect(flattenCheckedMeasurements(datasetMeasurements(marginDataset, data.sorted.Measurements)).map(m => m.Type)).toEqual(data.sorted.Measurements.map(m => m.Type))
  })
  it('rejects an unchecked duplicate instead of accepting ambiguous field selection', () => {
    const data = marginRequest(); data.sorted.Measurements = [data.sorted.Measurements[0], data.sorted.Measurements[1], { ...data.sorted.Measurements[0], IsChecked: false }]
    expect(datasetConfigurationError(data, marginDataset)).toBeTruthy()
  })
  it.each([
    ['2026-07-01', '2026-07-31', '2026-06-01', '2026-06-30'],
    ['2026-06-15', '2026-07-15', '2026-07-01', '2026-07-31'],
    ['2026-03-28', '2026-03-30', '2026-10-24', '2026-10-26'],
    ['1900-01-01', '1900-01-01', '9998-12-31', '9998-12-31'],
    ['2026-07-01', '2026-07-31', '2026-07-01', '2026-07-31'],
  ])('preserves independent literal windows %s/%s vs %s/%s', (from, to, previousFrom, previousTo) => {
    const data = marginRequest(); Object.assign(data, { from, to }); Object.assign(data.marginComparison as object, { From: previousFrom, To: previousTo }); const before = structuredClone(data)
    expect(datasetConfigurationError(data, marginDataset)).toBeNull(); expect(data).toEqual(before)
  })
  it.each(['Version', 'From', 'To', 'BaseResource', 'RoundingPolicy'])('requires exact option %s', field => {
    const data = marginRequest(); delete (data.marginComparison as Record<string, unknown>)[field]; fail(data)
  })
  it.each(['oneC', 'OneC', 'valuationClientAgreementId', 'Ordering', 'topGroups', 'Threshold', 'hideZero', 'AbcClassification', 'Xyz', 'comparison', 'RevenueComparison', 'BuyerSalesShare', 'ReturnComparison', 'RateComparison'])('rejects unsupported %s before applying settings', key => {
    const data = Object.assign(marginRequest(), { [key]: {} }); fail(data)
  })
  it.each(['1899-12-31', '9999-01-01', '2026-02-29', '2026-2-01', '', '2026-07-01T00:00:00Z'])('rejects invalid civil date %s', from => {
    const data = marginRequest(); data.from = from; fail(data)
  })
  it('rejects extra nested options and duplicate aliases; accepts one case-insensitive set', () => {
    const data = marginRequest(); const options = data.marginComparison as Record<string, unknown>
    expect(marginComparisonOptions({ ...options, extra: 1 })).toBeNull(); expect(marginComparisonOptions({ ...options, version: 1 })).toBeNull()
    data.MarginComparison = structuredClone(options); fail(data); delete data.marginComparison
    expect(marginComparisonConfigurationError(data)).toBeNull()
    expect(marginComparisonOptions(Object.fromEntries(Object.entries(options).map(([k, v]) => [k.toLowerCase(), v])))).toEqual(options)
  })
  it.each([0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19])('refuses MarginComparison on old source%i', dataSource => {
    const data = marginRequest(); data.dataSource = dataSource; expect(marginComparisonConfigurationError(data)).toBeTruthy()
    delete data.marginComparison; expect(marginComparisonConfigurationError(data)).toBeNull()
  })
  it('requires fixed axes, nonempty active known measures and raw list at most4', () => {
    const data = marginRequest(); data.sorted.Row.reverse(); fail(data); data.sorted.Row.reverse()
    data.sorted.Col = [data.sorted.Row[0]]; fail(data); data.sorted.Col = []
    data.sorted.Measurements = data.sorted.Measurements.map(m => ({ ...m, IsChecked: false })); fail(data)
    data.sorted.Measurements = marginRequest().sorted.Measurements; data.sorted.Measurements.push({ ...data.sorted.Measurements[0], IsChecked: false }); fail(data)
    data.sorted.Measurements = [{ ...data.sorted.Measurements[0], Type: 32, IsChecked: false }, data.sorted.Measurements[1]]; fail(data)
  })
  it('keeps explicit options, filters and aliases in preset clones, without inferring previous dates', () => {
    const data = marginRequest(); data.selections = [select('{"Id":"9223372036854775807"}')] as unknown as typeof data.selections
    const preset = datasetPresetRequest(marginDataset, 'sale-margin-period-comparison', data)!.Data
    expect(requestMarginComparison(preset)).toEqual(data.marginComparison); expect(preset.selections).toEqual(data.selections); expect(preset.selections).not.toBe(data.selections)
    expect(defaultDatasetRequest(marginDataset, data.from, data.to).marginComparison).toMatchObject({ From: '', To: '' })
    data.MarginComparison = data.marginComparison; fail(datasetPresetRequest(marginDataset, 'sale-margin-period-comparison', data)!.Data)
  })
  it.each([1, 2147483648, Number.MAX_SAFE_INTEGER, '9007199254740993', '9223372036854775807'])('preserves exact positive identity %s', Id => {
    for (const Data of [{ Id, AgreementId: 900 }, JSON.stringify({ id: Id })]) {
      expect(revenueExactId(Data)).toBe(String(Id)); const data = marginRequest(); data.selections = [select(Data)] as unknown as typeof data.selections; expect(datasetConfigurationError(data, marginDataset)).toBeNull()
    }
  })
  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '9223372036854775808', '01', '1e3', {}, { Id: 1, id: 2 }, '{"Id":1,"Id":2}', '{"Id":1,"iD":2}', JSON.stringify(JSON.stringify({ Id: 1 })), '1', '"1"', null])('rejects lossy or ambiguous identity %j', raw => {
    const Data = typeof raw === 'number' || typeof raw === 'string' && raw !== '1' && /^[-\d]/.test(raw) ? { Id: raw } : raw
    expect(revenueExactId(Data)).toBeNull()
  })
  it.each([2147483648, -2147483649, 1.5, null, '9', {}])('refuses non-Int32 descriptive Value %j even on disabled rows', Value => {
    const data = marginRequest(); data.selections = [{ ...select({ Id: 201 }, Value), IsChecked: false }] as unknown as typeof data.selections; fail(data)
  })
  it('retains disabled original indices and omitted/null active flags for AND/OR trees', () => {
    const data = marginRequest(); data.selections = [{ IsChecked: false, SelectedField: { Type: 1000 } }, { ...select({ Id: 201 }, -2147483648), IsChecked: null }] as unknown as typeof data.selections
    data.filterExpression = { Version: 1, Root: { Kind: 2, Children: [{ Kind: 3, SelectionIndex: 0 }, { Kind: 3, SelectionIndex: 1 }] } }
    expect(datasetConfigurationError(data, marginDataset)).toBeNull()
    data.filterExpression = { Version: 1, Root: { Kind: 3, SelectionIndex: 0 } }; fail(data)
  })
})

it.each([1, 2, 6, 9])('preserves exact saved identities for permitted field%i', Type => {
  const data = marginRequest()
  data.selections = [{ ...select('{"Id":"9007199254740993"}'), SelectedField: { Type, Name: 'Exact' } }] as unknown as typeof data.selections
  expect(datasetConfigurationError(data, marginDataset)).toBeNull()
  expect(data.selections[0].Values[0].Data).toBe('{"Id":"9007199254740993"}')
})

it('accepts exactly2000 raw repeated filter entries without changing exact IDs', () => {
  const data = marginRequest()
  data.selections = [select({Id:'9007199254740993'})] as unknown as typeof data.selections
  data.selections[0].Values = Array.from({length:2000},()=>data.selections[0].Values[0])
  expect(marginComparisonConfigurationError(data,marginDataset)).toBeNull()
})
