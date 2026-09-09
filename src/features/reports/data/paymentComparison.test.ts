import { describe, expect, it } from 'vitest'
import { paymentComparisonConfigurationError, paymentComparisonOptions, requestPaymentComparison } from './paymentComparison'
import { paymentComparisonExactId } from './paymentComparison'
import { datasetConfigurationError, datasetMeasurements, datasetPresetRequest, defaultDatasetRequest } from './reportDatasets'
import { flattenCheckedMeasurements } from './reportOptions'
import { paymentDataset, paymentRequest } from './paymentComparison.test-fixtures'
import type { ReportRequestBody } from '../types'
const fail = (data: ReportRequestBody) => expect(paymentComparisonConfigurationError(data, paymentDataset)).toBeTruthy()
const select = (Data: unknown, Value: unknown = 0) => ({ IsChecked: true, SelectedField: { Type: 9, Name: 'Contract' }, FilterCondition: { Type: 2, Name: 'InList' }, Values: [{ Data, Name: 'Договір', Value }] })
it.each([1, 2])('preserves explicitly chosen payment direction%i', Direction => {
  const data = paymentRequest(); Object.assign(data.paymentComparison as object, { Direction })
  expect(datasetConfigurationError(data, paymentDataset)).toBeNull()
  expect(paymentComparisonOptions(data.paymentComparison)?.Direction).toBe(Direction)
})
it.each([undefined, null, 0, 3, 29, 30, 31, '1', true, {}])('refuses missing/foreign/net direction %j', Direction => {
  const data = paymentRequest(); Object.assign(data.paymentComparison as object, { Direction }); fail(data)
})
describe('source21 exact request contract', () => {
  it.each(Array.from({ length: 15 }, (_, i) => i + 1))('keeps selected subset %i in caller order through builder reload', mask => {
    const data = paymentRequest(); data.sorted.Measurements = data.sorted.Measurements.filter(m => mask & (1 << (m.Type - 59))).reverse()
    expect(datasetConfigurationError(data, paymentDataset)).toBeNull()
    expect(flattenCheckedMeasurements(datasetMeasurements(paymentDataset, data.sorted.Measurements)).map(m => m.Type)).toEqual(data.sorted.Measurements.map(m => m.Type))
  })
  it('rejects an unchecked duplicate instead of accepting ambiguous field selection', () => {
    const data = paymentRequest(); data.sorted.Measurements = [data.sorted.Measurements[0], data.sorted.Measurements[1], { ...data.sorted.Measurements[0], IsChecked: false }]
    expect(datasetConfigurationError(data, paymentDataset)).toBeTruthy()
  })
  it.each([
    ['2026-07-01', '2026-07-31', '2026-06-01', '2026-06-30'],
    ['2026-06-15', '2026-07-15', '2026-07-01', '2026-07-31'],
    ['2026-03-28', '2026-03-30', '2026-10-24', '2026-10-26'],
    ['1900-01-01', '1900-01-01', '9998-12-31', '9998-12-31'],
    ['2026-07-01', '2026-07-31', '2026-07-01', '2026-07-31'],
  ])('preserves independent literal windows %s/%s vs %s/%s', (from, to, previousFrom, previousTo) => {
    const data = paymentRequest(); Object.assign(data, { from, to }); Object.assign(data.paymentComparison as object, { From: previousFrom, To: previousTo }); const before = structuredClone(data)
    expect(datasetConfigurationError(data, paymentDataset)).toBeNull(); expect(data).toEqual(before)
  })
  it.each(['Version', 'From', 'To', 'Direction', 'RoundingPolicy'])('requires exact option %s', field => {
    const data = paymentRequest(); delete (data.paymentComparison as Record<string, unknown>)[field]; fail(data)
  })
  it.each(['oneC', 'OneC', 'valuationClientAgreementId', 'Ordering', 'topGroups', 'Threshold', 'hideZero', 'AbcClassification', 'Xyz', 'comparison', 'RevenueComparison', 'BuyerSalesShare', 'ReturnComparison', 'RateComparison', 'MarginComparison', 'FilterExpression'])('rejects unsupported %s before applying settings', key => {
    const data = Object.assign(paymentRequest(), { [key]: {} }); fail(data)
  })
  it.each(['1899-12-31', '9999-01-01', '2026-02-29', '2026-2-01', '', '2026-07-01T00:00:00Z'])('rejects invalid civil date %s', from => {
    const data = paymentRequest(); data.from = from; fail(data)
  })
  it('rejects extra nested options and duplicate aliases; accepts one case-insensitive set', () => {
    const data = paymentRequest(); const options = data.paymentComparison as Record<string, unknown>
    expect(paymentComparisonOptions({ ...options, extra: 1 })).toBeNull(); expect(paymentComparisonOptions({ ...options, version: 1 })).toBeNull()
    data.PaymentComparison = structuredClone(options); fail(data); delete data.paymentComparison
    expect(paymentComparisonConfigurationError(data)).toBeNull()
    expect(paymentComparisonOptions(Object.fromEntries(Object.entries(options).map(([k, v]) => [k.toLowerCase(), v])))).toEqual(options)
  })
  it.each([0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20])('refuses PaymentComparison on old source%i', dataSource => {
    const data = paymentRequest(); data.dataSource = dataSource; expect(paymentComparisonConfigurationError(data)).toBeTruthy()
    delete data.paymentComparison; expect(paymentComparisonConfigurationError(data)).toBeNull()
  })
  it('requires fixed axes, nonempty active known measures and raw list at most4', () => {
    const data = paymentRequest(); data.sorted.Row.reverse(); fail(data); data.sorted.Row.reverse()
    data.sorted.Col = [data.sorted.Row[0]]; fail(data); data.sorted.Col = []
    data.sorted.Measurements = data.sorted.Measurements.map(m => ({ ...m, IsChecked: false })); fail(data)
    data.sorted.Measurements = paymentRequest().sorted.Measurements; data.sorted.Measurements.push({ ...data.sorted.Measurements[0], IsChecked: false }); fail(data)
    data.sorted.Measurements = [{ ...data.sorted.Measurements[0], Type: 32, IsChecked: false }, data.sorted.Measurements[1]]; fail(data)
  })
  it('keeps explicit options, filters and aliases in preset clones, without inferring previous dates', () => {
    const data = paymentRequest(); data.selections = [select('{"Id":"9223372036854775807"}')] as unknown as typeof data.selections
    const preset = datasetPresetRequest(paymentDataset, 'imported-payment-period-comparison', data)!.Data
    expect(requestPaymentComparison(preset)).toEqual(data.paymentComparison); expect(preset.selections).toEqual(data.selections); expect(preset.selections).not.toBe(data.selections)
    expect(defaultDatasetRequest(paymentDataset, data.from, data.to).paymentComparison).toMatchObject({ From: '', To: '' })
    data.PaymentComparison = data.paymentComparison; fail(datasetPresetRequest(paymentDataset, 'imported-payment-period-comparison', data)!.Data)
  })
  it.each(['1', '2147483648', '9007199254740993', '9223372036854775807'])('preserves exact positive identity %s', Id => {
    for (const Data of [{ Id, AgreementId: 900 }, JSON.stringify({ id: Id })]) {
      expect(paymentComparisonExactId(Data)).toBe(String(Id)); const data = paymentRequest(); data.selections = [select(Data)] as unknown as typeof data.selections; expect(datasetConfigurationError(data, paymentDataset)).toBeNull()
    }
  })
  it.each([1, 2147483648, Number.MAX_SAFE_INTEGER, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '9223372036854775808', '01', '1e3', {}, { Id: 1, id: 2 }, '{"Id":1,"Id":2}', '{"Id":1,"iD":2}', JSON.stringify(JSON.stringify({ Id: 1 })), '1', '"1"', null])('rejects lossy or ambiguous identity %j', raw => {
    const Data = typeof raw === 'number' || typeof raw === 'string' && raw !== '1' && /^[-\d]/.test(raw) ? { Id: raw } : raw
    expect(paymentComparisonExactId(Data)).toBeNull()
  })
  it.each([2147483648, -2147483649, 1.5, null, '9', {}])('refuses non-Int32 descriptive Value %j even on disabled rows', Value => {
    const data = paymentRequest(); data.selections = [{ ...select({ Id: 201 }, Value), IsChecked: false }] as unknown as typeof data.selections; fail(data)
  })
  it('retains disabled selections but refuses grouped filter expressions', () => {
    const data = paymentRequest(); data.selections = [{IsChecked:false,SelectedField:{Type:1000}}, {...select({Id:'201'},-2147483648),IsChecked:null}] as unknown as typeof data.selections
    expect(datasetConfigurationError(data,paymentDataset)).toBeNull()
    data.filterExpression={Version:1,Root:{Kind:3,SelectionIndex:1}};fail(data)
  })
})

it.each([6, 9, 28, 29, 30, 33, 35, 37, 38])('preserves exact saved identities for permitted field%i', Type => {
  const data = paymentRequest()
  data.selections = [{ ...select('{"Id":"9007199254740993"}'), SelectedField: { Type, Name: 'Exact' } }] as unknown as typeof data.selections
  expect(datasetConfigurationError(data, paymentDataset)).toBeNull()
  expect(data.selections[0].Values[0].Data).toBe('{"Id":"9007199254740993"}')
})

it('accepts exactly2000 raw repeated filter entries without changing exact IDs', () => {
  const data = paymentRequest()
  data.selections = [select({Id:'9007199254740993'})] as unknown as typeof data.selections
  data.selections[0].Values = Array.from({length:2000},()=>data.selections[0].Values[0])
  expect(paymentComparisonConfigurationError(data,paymentDataset)).toBeNull()
})
