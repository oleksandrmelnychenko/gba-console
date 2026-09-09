import { describe, expect, it } from 'vitest'
import { defaultDatasetRequest, datasetConfigurationError, datasetMeasurements, datasetPresetRequest } from './reportDatasets'
import { rateComparisonConfigurationError, rateComparisonOptions, rateDefinitionId, requestRateComparison } from './rateComparison'
import { rateDataset, rateRequest } from './rateComparison.test-fixtures'

describe('source19 exact series and independent dates', () => {
  it('starts with explicit empty dates/series and fixed native axes', () => {
    const data = defaultDatasetRequest(rateDataset, '2026-01-01', '2026-12-31')
    expect(data.from).toBe(''); expect(data.to).toBe(''); expect(data.sorted.Row.map(item => item.type)).toEqual([52]); expect(data.sorted.Col).toEqual([])
    expect(data.sorted.Measurements.map(item => item.Type)).toEqual([51, 52, 53, 54]); expect(datasetConfigurationError(data, rateDataset)).not.toBeNull()
  })
  it.each([['1900-01-01', '9998-12-31'], ['2026-07-31', '2026-07-31'], ['9998-12-31', '1900-01-01']])('keeps dates %s/%s independent', (CurrentAsOf, PreviousAsOf) => {
    const data = rateRequest(); Object.assign(data.rateComparison!, { CurrentAsOf, PreviousAsOf }); expect(datasetConfigurationError(data, rateDataset)).toBeNull()
  })
  it.each(['', '2026-02-29', '2024-02-30', '1899-12-31', '9999-01-01', '2026-01-01T00:00:00Z'])('rejects invalid date %s', date => {
    for (const field of ['CurrentAsOf', 'PreviousAsOf']) { const data = rateRequest(); Object.assign(data.rateComparison!, { [field]: date }); expect(rateComparisonConfigurationError(data)).not.toBeNull() }
  })
  it.each(['1', '9007199254740993', '9223372036854775807'])('preserves exact string ID %s', id => { expect(rateDefinitionId(id)).toBe(true) })
  it.each([0, 1, 9007199254740992, '0', '-1', '01', '+1', '1.0', '1e3', '9223372036854775808', '', ' 1'])('rejects noncanonical ID %s', id => { expect(rateDefinitionId(id)).toBe(false) })
  it.each(['Version', 'RateKind', 'RateDefinitionId', 'CurrentAsOf', 'PreviousAsOf'])('rejects missing, duplicated and unknown option %s', field => {
    const data = rateRequest(), value = data.rateComparison as Record<string, unknown>, original = value[field]
    delete value[field]; expect(rateComparisonOptions(value)).toBeNull(); value[field] = original; value[field.toLowerCase()] = original; expect(rateComparisonOptions(value)).toBeNull()
    delete value[field.toLowerCase()]; value.Extra = true; expect(rateComparisonOptions(value)).toBeNull()
  })
  it.each(['oneC', 'comparison', 'returnComparison', 'buyerSalesShare', 'revenueComparison', 'xyz', 'ordering', 'filterExpression', 'topGroups', 'threshold', 'hideZero', 'abcClassification', 'valuationClientAgreementId'])('rejects unsupported option %s', field => {
    const data = rateRequest(); Object.assign(data, { [field]: {} }); expect(rateComparisonConfigurationError(data)).not.toBeNull()
  })
  it.each(Array.from({ length: 19 }, (_, index) => index))('rejects rate options on old source%i', dataSource => {
    expect(rateComparisonConfigurationError({ ...rateRequest(), dataSource })).not.toBeNull()
  })
  it.each(['from', 'to', 'selections', 'rows', 'cols', 'measure', 'empty', 'duplicate'])('rejects invalid request %s', field => {
    const data = rateRequest()
    if (field === 'from' || field === 'to') data[field] = '2026-01-01'
    if (field === 'selections') data.selections = [{} as never]
    if (field === 'rows') data.sorted.Row[0].type = 12
    if (field === 'cols') data.sorted.Col = [...data.sorted.Row]
    if (field === 'measure') data.sorted.Measurements[0].Type = 50
    if (field === 'empty') data.sorted.Measurements = []
    if (field === 'duplicate') data.sorted.Measurements[1].Type = 51
    expect(rateComparisonConfigurationError(data)).not.toBeNull()
  })
  it('preserves selected measure order and option aliases through preset, without repairing duplicates', () => {
    const data = rateRequest(); data.sorted.Measurements = [data.sorted.Measurements[3], data.sorted.Measurements[1]]
    const result = datasetPresetRequest(rateDataset, 'historical-rate-comparison', data)!.Data
    expect(requestRateComparison(result)).toEqual(data.rateComparison); expect(result.rateComparison).not.toBe(data.rateComparison)
    expect(datasetMeasurements(rateDataset, data.sorted.Measurements).filter(g => g.IsChecked).map(g => g.SubList[0].Type)).toEqual([54, 52])
    data.RateComparison = data.rateComparison; expect(rateComparisonConfigurationError(datasetPresetRequest(rateDataset, 'historical-rate-comparison', data)!.Data)).not.toBeNull()
  })
})
