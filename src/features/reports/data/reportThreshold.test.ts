import { describe, expect, it } from 'vitest'
import { defaultReportThreshold, readReportThreshold, readThresholdCapabilities, reportThresholdError, requestThreshold } from './reportThreshold'
import { accountThreshold, thresholdCapabilities, thresholdDataset, thresholdRequest } from './reportThreshold.test-fixtures'
import { datasetConfigurationError, datasetPresetRequest, defaultDatasetRequest } from './reportDatasets'
import { reportDatasets, valuationDataset } from './reportDatasets.test-fixtures'

describe('server threshold contract', () => {
  it('accepts one native row with ABC/TOP/ordering and ordinary native filters untouched', () => {
    const data = thresholdRequest(), before = structuredClone(data)
    expect(reportThresholdError(data, thresholdDataset)).toBeNull()
    expect(datasetConfigurationError(data, thresholdDataset)).toBeNull()
    expect(defaultReportThreshold(data, thresholdDataset)).toEqual(accountThreshold)
    expect(data).toEqual(before)
    expect(data.selections.length).toBeGreaterThan(0)
  })
  it('keeps legacy reports working when threshold is absent and requires actual capabilities to enable it', () => {
    expect(reportThresholdError({ ...thresholdRequest(), threshold: undefined }, undefined)).toBeNull()
    expect(defaultReportThreshold(thresholdRequest(), undefined)).toBeNull()
    expect(reportThresholdError(thresholdRequest(), { ...thresholdDataset, Threshold: undefined })).toContain('не підтвердив')
  })
  it.each([null, [], {}, { ...accountThreshold, Version: 2 }, { ...accountThreshold, Axis: 2 }, { ...accountThreshold, Extra: true },
    { Version: 1, Axis: 1, Measure: 24, Percent: 20 }, { ...accountThreshold, Percent: '' }, { ...accountThreshold, Percent: '20' }, { ...accountThreshold, Percent: 20.5 }])('does not repair malformed raw rule %#', threshold => {
    const before = structuredClone(threshold)
    expect(readReportThreshold(threshold)).toBeNull()
    if (threshold !== null) expect(reportThresholdError({ ...thresholdRequest(), threshold }, thresholdDataset)).not.toBeNull()
    expect(threshold).toEqual(before)
  })
  it.each([0, -1, 101])('retains out-of-range percent %s', Percent => {
    const data = { ...thresholdRequest(), threshold: { ...accountThreshold, Percent } }
    expect(reportThresholdError(data, thresholdDataset)).toContain('не змінено автоматично')
    expect(data.threshold.Percent).toBe(Percent)
  })
  it.each([1, 100])('accepts exact inclusive percent boundary %s', Percent => {
    expect(reportThresholdError({ ...thresholdRequest(), threshold: { ...accountThreshold, Percent } }, thresholdDataset)).toBeNull()
  })
  it('refuses duplicate aliases while preserving both objects and every ordinary filter', () => {
    const data = { ...thresholdRequest(), Threshold: { ...accountThreshold, Percent: 90 } }, before = structuredClone(data)
    expect(reportThresholdError(data, thresholdDataset)).toContain('двічі')
    expect(data).toEqual(before)
    const { threshold, ...rest } = thresholdRequest()
    expect(requestThreshold({ ...rest, Threshold: threshold })).toEqual(accountThreshold)
  })
  it('retains the rule after moved/extra row groups, columns or disabled/additional measures', () => {
    const data = thresholdRequest(), native = data.sorted.Row.find(field => field.type === 40)!
    for (const sorted of [
      { ...data.sorted, Row: [] }, { ...data.sorted, Col: [native] }, { ...data.sorted, Row: [...data.sorted.Row, native] },
      { ...data.sorted, Measurements: data.sorted.Measurements.map(field => ({ ...field, IsChecked: false })) },
      { ...data.sorted, Measurements: [...data.sorted.Measurements, ...data.sorted.Measurements] },
    ]) {
      const changed = { ...data, sorted }
      expect(reportThresholdError(changed, thresholdDataset)).not.toBeNull()
      expect(defaultReportThreshold(changed, thresholdDataset)).toBeNull()
      expect(changed.threshold).toEqual(accountThreshold)
    }
  })
  it('requires matching ABC target/measure and never accepts ABC as the native threshold target', () => {
    const data = thresholdRequest()
    expect(reportThresholdError({ ...data, abcClassification: { Version: 1, Axis: 1, Grouping: 41, Measure: 24, PercentA: 80, PercentB: 15, PercentC: 5 } }, thresholdDataset)).toContain('те саме')
    expect(reportThresholdError({ ...data, threshold: { ...accountThreshold, Grouping: 46 } }, thresholdDataset)).toContain('початкового поля')
  })
  it.each([{ Scope: 'PerParent' }, { SyntheticOtherSelectable: true }, { ZeroOnlyRemainder: 'Omit' }, { UnknownScores: 'Zero' },
    { MaximumActiveMeasures: 2 }, { MaximumNativeColumnGroupings: 1 }, { RankingMeasures: [16] }, { GroupingTypes: [46] }])('refuses changed server semantics %#', patch => {
    expect(readThresholdCapabilities({ ...thresholdDataset, Threshold: { ...thresholdCapabilities(thresholdDataset), ...patch } })).toBeNull()
  })
  it('preserves raw threshold on same-source preset and keeps exact valuation agreement independently', () => {
    const current = thresholdRequest()
    const preset = datasetPresetRequest(thresholdDataset, 'account-balances-by-purpose-currency', current)!
    expect(preset.Data.threshold).toEqual(accountThreshold)
    expect(preset.Data.selections).toEqual(current.selections)
    expect(reportThresholdError(preset.Data, thresholdDataset)).not.toBeNull()
    const valuation = datasetPresetRequest(valuationDataset, 'stock-value-by-agreement', { ...current, dataSource: 8, valuationClientAgreementId: 456246 })!
    expect(valuation.Data.threshold).toEqual(accountThreshold)
    expect(valuation.Data.valuationClientAgreementId).toBe(456246)
  })
  it('supports Year grouping identity0 and additive quantity0 without truthiness substitutions', () => {
    const dataset = { ...reportDatasets[0], Threshold: thresholdCapabilities(reportDatasets[0]) }
    const data = defaultDatasetRequest(dataset, '2026-06-01', '2026-06-30')
    data.sorted.Row = [{ type: 0, key: 'Year', label: 'Рік' }]
    data.sorted.Col = []
    data.sorted.Measurements = data.sorted.Measurements.filter(field => field.Type === 0)
    const rule = { ...accountThreshold, Grouping: 0, Measure: 0 }
    expect(reportThresholdError({ ...data, threshold: rule }, dataset)).toBeNull()
  })
})
