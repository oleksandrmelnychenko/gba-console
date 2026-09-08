import { describe, expect, it } from 'vitest'
import { comparisonWindow, isComparisonDate, requestComparison } from './clientPeriodComparison'
import { clientComparisonDataset, clientComparisonRequest } from './clientPeriodComparison.test-fixtures'
import { datasetConfigurationError, datasetPresetRequest, defaultDatasetRequest } from './reportDatasets'
import { grossDataset } from './reportDatasets.test-fixtures'
import { clientActivityDataset } from './clientActivity.test-fixtures'

describe('two explicit client comparison windows', () => {
  it('defaults only client rows and four measures, requiring an explicitly entered second period', () => {
    const request = defaultDatasetRequest(clientComparisonDataset, '2026-07-01', '2026-07-31')
    expect(request.sorted.Row.map(item => item.type)).toEqual([12])
    expect(request.sorted.Col).toEqual([])
    expect(request.sorted.Measurements.map(item => item.Type)).toEqual([25, 26, 27, 28])
    expect(request.comparison).toEqual({ Version: 1, From: '', To: '' })
    expect(datasetConfigurationError(request, clientComparisonDataset)).toMatch(/періоду порівняння/)
  })
  it.each(Array.from({ length: 15 }, (_, index) => index + 1))('accepts nonempty selected subset %s without adding unselected dependencies', mask => {
    const request = clientComparisonRequest()
    request.sorted.Measurements = request.sorted.Measurements.filter((_, index) => mask & (1 << index))
    expect(datasetConfigurationError(request, clientComparisonDataset)).toBeNull()
  })
  it.each(['1900-01-01', '2000-02-29', '9998-12-31'])('accepts exact valid bounds %s', date => expect(isComparisonDate(date)).toBe(true))
  it.each(['2026-02-29', '2026-04-31', '9999-01-01', '1899-12-31', '01.07.2026', '2026-7-01'])('refuses malformed or out-of-range date %s', date => expect(isComparisonDate(date)).toBe(false))
  it.each([undefined, null, {}, { Version: 2, From: '2026-06-01', To: '2026-06-30' },
    { Version: 1, From: '2026-07-01', To: '2026-06-30' }, { Version: 1, From: '2026-06-01', To: '2026-06-30', Offset: -1 }])('does not sanitize invalid windows %#', comparison => {
    expect(comparisonWindow(comparison)).toBeNull()
    expect(datasetConfigurationError({ ...clientComparisonRequest(), comparison }, clientComparisonDataset)).not.toBeNull()
  })
  it('preserves overlap, exact contract bindings and the comparison window in a preset', () => {
    const current = clientComparisonRequest()
    current.comparison = { Version: 1, From: current.from, To: current.to }
    current.selections = [{ IsChecked: true, SelectedField: { Name: 'CustomerContract', Type: 9 }, FilterCondition: { Type: 2, Name: 'У списку' },
      Values: [455430, 456506].map(Id => ({ Data: { Id, AgreementId: 802 }, Name: String(Id), Value: Id })) }]
    const preset = datasetPresetRequest(clientComparisonDataset, 'sale-clients-period-comparison', current)!
    expect(preset.Data.comparison).toEqual(current.comparison)
    expect(preset.Data.selections).toEqual(current.selections)
    expect(datasetConfigurationError(preset.Data, clientComparisonDataset)).toBeNull()
    expect(requestComparison(preset.Data)).not.toBe(current.comparison)
  })
  it.each(['topGroups', 'TopGroups', 'threshold', 'Threshold', 'abcClassification', 'AbcClassification', 'hideZero', 'HideZero', 'valuationClientAgreementId'])('refuses unsupported %s before applying template', key => {
    expect(datasetConfigurationError({ ...clientComparisonRequest(), [key]: { Version: 1 } }, clientComparisonDataset)).not.toBeNull()
  })
  it('refuses a column axis, duplicate measure, empty selection and duplicate aliases', () => {
    const base = clientComparisonRequest()
    for (const data of [
      { ...base, sorted: { ...base.sorted, Col: base.sorted.Row } },
      { ...base, sorted: { ...base.sorted, Measurements: [...base.sorted.Measurements, base.sorted.Measurements[0]] } },
      { ...base, sorted: { ...base.sorted, Measurements: [] } },
      { ...base, Comparison: base.comparison },
    ]) expect(datasetConfigurationError(data, clientComparisonDataset)).not.toBeNull()
  })
  it.each([grossDataset, clientActivityDataset])('refuses comparison options on original source $DataSource', dataset => {
    const request = defaultDatasetRequest(dataset, '2026-06-01', '2026-06-30')
    expect(datasetConfigurationError({ ...request, comparison: clientComparisonRequest().comparison }, dataset)).toMatch(/лише набір/)
    expect(requestComparison(request)).toBeUndefined()
  })
})
