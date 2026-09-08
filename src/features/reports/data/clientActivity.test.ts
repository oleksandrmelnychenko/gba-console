import { describe, expect, it } from 'vitest'
import { clientActivityDataset, clientActivityRequest } from './clientActivity.test-fixtures'
import { CLIENT_ACTIVITY_COUNT_CAPTION } from './clientActivityReport'
import { datasetConfigurationError, datasetFilters, datasetPresetRequest, datasetPresets, defaultDatasetRequest } from './reportDatasets'
import { isCurrentReportSource, usesNativeReportLookup } from './nativeReportProfiles'
import { readAbcCapabilities } from './reportAbcClassification'
import { readTopGroupsCapabilities } from './reportTopGroups'
import { readThresholdCapabilities } from './reportThreshold'
import { readHideZeroCapabilities } from './reportHideZero'

describe('native sale client activity dataset', () => {
  it('defaults to explicit period and month/client/exact-contract axes with one nonadditive count', () => {
    const data = defaultDatasetRequest(clientActivityDataset, '2026-06-01', '2026-07-31')
    expect(data.sorted.Row.map(field => field.type)).toEqual([2, 12, 15])
    expect(data.sorted.Col).toEqual([])
    expect(data.sorted.Measurements).toMatchObject([{ Type: 25, Label: CLIENT_ACTIVITY_COUNT_CAPTION, IsChecked: true }])
    expect(data.from).toBe('2026-06-01'); expect(data.to).toBe('2026-07-31')
    expect(data).not.toHaveProperty('valuationClientAgreementId'); expect(data).not.toHaveProperty('oneC')
    expect(isCurrentReportSource(12)).toBe(false); expect(usesNativeReportLookup(12)).toBe(true)
    expect(datasetFilters(clientActivityDataset).map(field => field.field)).toEqual([
      { Name: 'Product', Type: 1 }, { Name: 'ProductArticle', Type: 2 }, { Name: 'CustomerName', Type: 6 },
      { Name: 'CustomerContract', Type: 9 }, { Name: 'SaleDocument', Type: 12 }])
    expect(datasetConfigurationError(data, clientActivityDataset)).toBeNull()
  })
  it('preserves exact ClientAgreement IDs, shared AgreementId, disabled foreign filter and OR indices in native preset', () => {
    const current = clientActivityRequest(), original = structuredClone(current)
    const preset = datasetPresetRequest(clientActivityDataset, 'sale-clients-by-month-agreement', current)!
    expect(preset.Data.selections).toEqual(current.selections)
    expect(preset.Data.filterExpression).toEqual(current.filterExpression)
    expect(preset.Data.selections).not.toBe(current.selections)
    expect(preset.Data.selections.slice(0, 2).map(selection => selection.Values[0].Value)).toEqual([456246, 454395])
    expect(datasetConfigurationError(current, clientActivityDataset)).toBeNull()
    expect(current).toEqual(original)
    expect(datasetPresets({ ...clientActivityDataset, Groupings: clientActivityDataset.Groupings.filter(field => field.Type !== 15) })).toEqual([])
  })
  it.each([{ from: '' }, { to: '' }, { valuationClientAgreementId: 456246 }, { oneC: { OrganizationIds: [], ProductKindId: 'source', ExcludeServices: true } }])('rejects incompatible saved context %# without mutating it', patch => {
    const data = { ...clientActivityRequest(), ...patch }, original = structuredClone(data)
    expect(datasetConfigurationError(data, clientActivityDataset)).toBeTruthy(); expect(data).toEqual(original)
  })
  it.each([
    { topGroups: { Version: 1, Axis: 1, Grouping: 12, Mode: 1, Value: 10, Measure: 25, Direction: 2 } },
    { threshold: { Version: 1, Axis: 1, Grouping: 12, Measure: 25, Percent: 10 } },
    { abcClassification: { Version: 1, Axis: 1, Grouping: 12, Measure: 25, PercentA: 80, PercentB: 15, PercentC: 5 } },
    { hideZero: { Version: 1 } },
  ])('refuses additive transformations of distinct counts and preserves imported rule %#', patch => {
    const data = { ...clientActivityRequest(), ...patch }, original = structuredClone(data)
    expect(datasetConfigurationError(data, clientActivityDataset)).toContain('Сервер не підтвердив')
    expect(data).toEqual(original)
    expect(readTopGroupsCapabilities(clientActivityDataset)).toBeNull(); expect(readAbcCapabilities(clientActivityDataset)).toBeNull()
    expect(readThresholdCapabilities(clientActivityDataset)).toBeNull(); expect(readHideZeroCapabilities(clientActivityDataset)).toBeNull()
  })
  it('rejects unavailable quantity/currency groupings or financial measures rather than inventing them', () => {
    const data = clientActivityRequest()
    expect(datasetConfigurationError({ ...data, sorted: { ...data.sorted, Row: [...data.sorted.Row, { type: 28, key: 'ProductMeasureUnit', label: 'Одиниця виміру' }] } }, clientActivityDataset)).toContain('не підтримує')
    expect(datasetConfigurationError({ ...data, sorted: { ...data.sorted, Measurements: [{ ...data.sorted.Measurements[0], Type: 24 }] } }, clientActivityDataset)).toContain('не підтримує')
  })
})
