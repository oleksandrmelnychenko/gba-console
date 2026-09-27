import { describe, expect, it } from 'vitest'
import { currentVparivanieConfigurationError, currentVparivanieFilterConditions, isCurrentVparivanieCapability, isCurrentVparivanieDataset } from './currentVparivanie'
import { currentVparivanieDataset as dataset, currentVparivanieRequest as request, exactSelection } from './currentVparivanie.test-fixtures'
import { datasetConfigurationError, datasetFilters, datasetMeasurements, datasetPresetRequest } from './reportDatasets'
import { reportWorkspaceDraftCompatibility } from './reportWorkspaceDraftCompatibility'
import { catalogueLaunchOptions, resolveCatalogueLaunch } from './reportCatalogueLaunch'
import { migrationFixture } from './reportMigration.test-fixtures'
import type { ReportCatalogue } from '../types'
import { hasFixedReportAxes, isCurrentReportSource, nativeReportMeasurementUnit, supportsFullReportDateRange, usesNativeReportLookup } from './nativeReportProfiles'

describe('current native Vparivanie form contract', () => {
  it('keeps one resource and fixed dynamic column identities through presets', () => {
    const data = request()
    expect(data.sorted.Row.map(row => row.type)).toEqual([5])
    expect(data.sorted.Col.map(col => col.type)).toEqual([74, 75])
    expect(data.sorted.Measurements.map(measure => measure.Type)).toEqual([83])
    expect(datasetConfigurationError(data, dataset)).toBeNull()
    const preset = datasetPresetRequest(dataset, 'vparivanie-current-native-matrix', data)
    expect(preset?.Data).toEqual(data)
    expect(hasFixedReportAxes(39)).toBe(true)
    expect(supportsFullReportDateRange(39)).toBe(true)
    expect(usesNativeReportLookup(39)).toBe(true)
    expect(isCurrentReportSource(39)).toBe(false)
    expect(nativeReportMeasurementUnit(39, 'Результат')).toBe('Кількість товару')
  })
  it('accepts bounded product hierarchy plus stock-only warehouse and customer-leg selections', () => {
    const data = { ...request(), selections: [exactSelection(4, 6), exactSelection(5), exactSelection(21, 2, ['1', '2'])] }
    expect(datasetConfigurationError(data, dataset)).toBeNull()
    expect(currentVparivanieFilterConditions(4)).toEqual([{ Type: 6, Name: 'У групі' }])
    expect(currentVparivanieFilterConditions(1).map(value => value.Type)).toEqual([0, 2])
    expect(datasetFilters(dataset).map(value => value.field.Type)).toEqual([1, 4, 5, 21])
  })
  it('accepts exact upper key and refuses rounded, repeated and overflowing identities', () => {
    const data = request()
    expect(currentVparivanieConfigurationError(data)).toBeNull()
    const failures = [Number('9223372036854775807'), '9223372036854775808', '01', '0', true]
    for (const Id of failures) {
      const malformed = structuredClone(data)
      Object.assign(malformed.selections[0].Values[0].Data, { Id })
      expect(currentVparivanieConfigurationError(malformed)).not.toBeNull()
    }
    expect(currentVparivanieConfigurationError({ ...data, selections: [exactSelection(1, 2, ['1', '1'])] })).not.toBeNull()
  })
  it.each([[1, 2, 128], [21, 2, 32]])('enforces the complete field %s cap without truncating', (field, condition, cap) => {
    const selection = exactSelection(field, condition, Array.from({ length: cap }, (_, i) => String(i + 1)))
    const selections = field === 1 ? [selection] : [exactSelection(1), selection]
    expect(currentVparivanieConfigurationError({ ...request(), selections })).toBeNull()
    selection.Values.push({ Data: { Id: String(cap + 1) }, Name: 'overflow', Value: 0 })
    expect(currentVparivanieConfigurationError({ ...request(), selections })).not.toBeNull()
  })
  it.each([[], [exactSelection(5)], [exactSelection(21)], [exactSelection(1, 1)], [exactSelection(4, 0)],
    [exactSelection(5, 2)], [exactSelection(1), exactSelection(1)], [{ ...exactSelection(1), IsChecked: false }]].map(selections => ({ selections })))('refuses an unbounded or unsupported selection %#', ({ selections }) => {
    expect(currentVparivanieConfigurationError({ ...request(), selections })).not.toBeNull()
  })
  it('rejects manager selection explicitly instead of substituting Sale.UserID', () => {
    expect(currentVparivanieConfigurationError({ ...request(), selections: [exactSelection(1), exactSelection(60)] })).toContain('менеджером покупця')
    expect(currentVparivanieConfigurationError({ ...request(), selections: [exactSelection(1), exactSelection(10)] })).not.toBeNull()
  })
  it.each(['2026-02-30', '2026-13-01', '1999-12-31', '7999-01-01', '2026-09-28'])('refuses invalid or reversed inclusive dates %s', from => {
    expect(currentVparivanieConfigurationError({ ...request(), from })).not.toBeNull()
  })
  it('retains inclusive 366-day maximum without historical stock semantics', () => {
    expect(currentVparivanieConfigurationError({ ...request(), from: '2026-01-01', to: '2027-01-01' })).toBeNull()
    expect(currentVparivanieConfigurationError({ ...request(), from: '2026-01-01', to: '2027-01-02' })).toContain('366')
  })
  it.each(['filterExpression', 'ordering', 'topGroups', 'hideZero', 'abcClassification', 'sourceOrganizations', 'oneC', 'supplierSourceWorld', 'ReturnsOnly'])('rejects unsupported saved option %s', name => {
    expect(currentVparivanieConfigurationError({ ...request(), [name]: {} })).not.toBeNull()
  })
  it('requires the exact advertised capability, not a generic source number', () => {
    expect(isCurrentVparivanieDataset(dataset)).toBe(true)
    for (const change of [{ StockAnchor: 'Historical' }, { HistoricalStockSupported: true }, { ManagerFilterSupported: true },
      { MaximumProducts: 5000 }, { ProductDisplayColumns: ['Name'] }, { FixedMeasurements: [80, 81, 82] }]) {
      const changed = { ...dataset, currentVparivanie: { ...dataset.currentVparivanie as object, ...change } }
      expect(isCurrentVparivanieCapability(changed.currentVparivanie)).toBe(false)
      expect(datasetConfigurationError(request(), changed)).not.toBeNull()
    }
  })
  it('refuses legacy three-measure axes and reordered counterparty/group columns', () => {
    const data = request()
    expect(currentVparivanieConfigurationError({ ...data, sorted: { ...data.sorted, Col: data.sorted.Col.toReversed() } })).not.toBeNull()
    expect(currentVparivanieConfigurationError({ ...data, sorted: { ...data.sorted, Measurements: [80,81,82].map(Type => ({ Type, Name: 'legacy', IsChecked: true, parentName: '' })) } })).not.toBeNull()
  })
})

it('restores fixed dynamic axes in an unfinished draft without changing the source or dropping them', () => {
  const data = request()
  const snapshot = { name: 'Draft', data, measurements: datasetMeasurements(dataset, data.sorted.Measurements),
    activeTemplate: null, previousPeriod: { from: '', to: '' } }
  expect(reportWorkspaceDraftCompatibility(snapshot, dataset)).toBeNull()
  snapshot.data.sorted.Col.reverse()
  expect(reportWorkspaceDraftCompatibility(snapshot, dataset)).toContain('Структура')
  expect(snapshot.data.sorted.Col.map(col => col.type)).toEqual([75,74])
})
it('offers the new matrix only when exact catalogue source and advertised capability both match', () => {
  const reportId = 'builtin:ОтчетВпаривание', sourceId = '069dfc76-74b6-491d-b039-f7fb54e0ea81'
  const catalogue: ReportCatalogue = { CapturedOn: '2026-09-27', Presentations: [], Reports: [{ Id: reportId, Name: 'Впаривание',
    Title: 'Впаривание', Kind: 'builtin', Sources: [{ World: 'fenix', SourceId: sourceId, DefinitionSha256: 'a'.repeat(64), Attributes: [],
      Migration: { ...migrationFixture('native_partial'), NativeDataSources: [39,36] } }] }],
    Migration: { Version: 'current-fixture', GeneratedAtUtc: '2026-09-27T00:00:00Z', Summary: { CatalogueEntries: 1, SourceImplementations: 1,
      BuiltinImplementations: 1, FullyVerifiedEntries: 0, ByStatus: { Captured: 0, NativePartial: 1, ParityVerified: 0, Unassessed: 0 } } } }
  const options = catalogueLaunchOptions(catalogue, reportId, [dataset])
  expect(options).toHaveLength(1)
  const launch = resolveCatalogueLaunch(catalogue, options[0].choice, [dataset], { from: '2026-09-01', to: '2026-09-27' })
  expect(launch.ok).toBe(true)
  if (launch.ok) { expect(launch.template.Data.sorted.Col.map(col => col.type)).toEqual([74,75]); expect(launch.template.Data.selections).toEqual([]) }
  expect(catalogueLaunchOptions(catalogue, reportId, [{ ...dataset, currentVparivanie: undefined }])).toEqual([])
  catalogue.Reports[0].Sources[0].SourceId = 'other-source'
  expect(catalogueLaunchOptions(catalogue, reportId, [dataset])).toEqual([])
})
