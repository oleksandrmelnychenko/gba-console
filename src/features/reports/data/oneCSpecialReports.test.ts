import { describe, expect, it } from 'vitest'
import type { ReportDataset } from '../types'
import { datasetPresetRequest, defaultDatasetRequest } from './reportDatasets'
import { defaultOneCSpecialSettings, isOneCSpecialDataset, oneCSpecialSettingsError,
  oneCSpecialSettingsForWorld, cloneOneCSpecialAliases } from './oneCSpecialReports'
import { ownPriceAnalysisDataset } from './ownPriceAnalysis.test-fixtures'

function dataset(dataSource: number): ReportDataset {
  const fields = dataSource === 28 ? { rows: [68, 69], measures: [72, 73] }
    : dataSource === 25 ? { rows: [55, 53, 62, 58], measures: [64] }
      : dataSource === 24 ? { rows: [57, 55, 53], measures: [65, 66] }
        : { rows: [57, 55, 53], measures: [64] }
  const key = dataSource === 24 ? 'providedDiscounts' : dataSource === 28 ? 'priceAnalysis' : 'discountMarkup'
  return { DataSource: dataSource, Name: 'Звіт 1С', Description: 'Локальний зріз',
    Groupings: fields.rows.map(Type => ({ Type, Name: String(Type) })),
    Measurements: fields.measures.map(Type => ({ Type, Name: String(Type) })),
    Filters: [], Limitations: [], PeriodRequired: dataSource === 24, PeriodSupported: dataSource === 24,
    [key]: { Version: 1, SourceWorlds: dataSource === 28 ? [1] : [1, 2],
      ...(dataSource === 28 ? { CoverageStatus: 'native_partial', AgreementPricingSupported: false, RecommendationEligible: false } : {}) } }
}

describe('bounded 1C server reports', () => {
  it.each([23, 24, 25, 28])('binds source world and validates required settings for dataset %i', dataSource => {
    const capability = dataset(dataSource)
    expect(isOneCSpecialDataset(capability)).toBe(true)
    const defaults = defaultDatasetRequest(capability, '2026-01-01', '2026-01-31')
    expect(oneCSpecialSettingsError(defaults, capability)).toBeTruthy()
    const key = dataSource === 24 ? 'providedDiscounts' : dataSource === 28 ? 'priceAnalysis' : 'discountMarkup'
    const world = oneCSpecialSettingsForWorld(dataSource, 'fenix')[key] as Record<string, unknown>
    const settings = { ...world, ...(dataSource === 28 ? { AsOf: '2026-01-31' }
      : dataSource === 24 ? {} : { DateEnd: '2026-01-31' }) }
    const request = { ...defaults, [key]: settings }
    expect(oneCSpecialSettingsError(request, capability)).toBeNull()
    expect(oneCSpecialSettingsError({ ...request, [key]: { ...settings, SourceWorld: 3 } }, capability)).toBeTruthy()
    expect(oneCSpecialSettingsError({ ...request, [key]: { ...settings, Extra: 1 } }, capability)).toBeTruthy()
    if (dataSource !== 24) expect(oneCSpecialSettingsError({ ...request, [key]: { ...settings,
      [dataSource === 28 ? 'AsOf' : 'DateEnd']: '2026-99-99' } }, capability)).toBeTruthy()
    expect(defaultOneCSpecialSettings(dataSource)[key]).toBeTruthy()
  })

  it('rejects missing or widened server capabilities', () => {
    const native = dataset(28)
    expect(isOneCSpecialDataset({ ...native, priceAnalysis: undefined })).toBe(false)
    expect(isOneCSpecialDataset({ ...native, priceAnalysis: { ...native.priceAnalysis as object,
      RecommendationEligible: true } })).toBe(false)
  })

  it('uses OUR rates for new analysis requests only when the server supports them', () => {
    const own = defaultDatasetRequest(ownPriceAnalysisDataset, '2026-01-01', '2026-01-31')
    expect(own.priceAnalysis).toEqual({ Version: 2, SourceWorld: 1, AsOf: '' })
    const request = { ...own, priceAnalysis: { Version: 2, SourceWorld: 1, AsOf: '2026-01-31' } }
    expect(oneCSpecialSettingsError(request, ownPriceAnalysisDataset)).toBeNull()
    expect(oneCSpecialSettingsError(request)).toBeNull()
    expect(oneCSpecialSettingsError(request, dataset(28))).toBeTruthy()
    expect(defaultDatasetRequest(dataset(28), '', '').priceAnalysis).toEqual({ Version: 1, SourceWorld: 1, AsOf: '' })
    expect(oneCSpecialSettingsForWorld(28, 'fenix', ownPriceAnalysisDataset)).toEqual({
      priceAnalysis: { Version: 2, SourceWorld: 1, AsOf: '' },
    })
  })

  it.each([false, undefined])('does not infer OUR rate support from versions without the capability %s', flag => {
    const legacy = { ...ownPriceAnalysisDataset, priceAnalysis: {
      ...ownPriceAnalysisDataset.priceAnalysis as object, OwnCommercialRatesSupported: flag,
    } }
    expect(defaultDatasetRequest(legacy, '', '').priceAnalysis).toMatchObject({ Version: 1 })
  })

  it('preserves explicit saved versions and rejects an unsupported version', () => {
    const base = defaultDatasetRequest(ownPriceAnalysisDataset, '', '')
    for (const Version of [1, 2]) {
      const saved = { ...base, PriceAnalysis: { Version, SourceWorld: 1, AsOf: '2026-01-31' }, priceAnalysis: undefined }
      delete saved.priceAnalysis
      expect(oneCSpecialSettingsError(saved, ownPriceAnalysisDataset)).toBeNull()
      const copy = cloneOneCSpecialAliases(saved)
      expect(copy.PriceAnalysis).toEqual(saved.PriceAnalysis)
      expect(copy.PriceAnalysis).not.toBe(saved.PriceAnalysis)
    }
    expect(oneCSpecialSettingsError({ ...base, priceAnalysis: { Version: 3, SourceWorld: 1, AsOf: '2026-01-31' } }, ownPriceAnalysisDataset)).toBeTruthy()
    expect(oneCSpecialSettingsError({ ...defaultDatasetRequest(dataset(23), '', ''),
      discountMarkup: { Version: 2, SourceWorld: 1, DateEnd: '2026-01-31' } }, dataset(23))).toBeTruthy()
  })

  it('keeps the fixed ABC class once when its preset is reapplied', () => {
    const abc: ReportDataset = { DataSource: 26, Name: 'ABC продажів', Description: 'Збережений зріз',
      Groupings: [46, 5].map(Type => ({ Type, Name: String(Type) })),
      Measurements: [4, 2].map(Type => ({ Type, Name: String(Type) })),
      Filters: [], Limitations: [], PeriodRequired: true, PeriodSupported: true }
    const current = defaultDatasetRequest(abc, '2026-01-01', '2026-01-31')
    current.abcClassification = { Version: 1, Axis: 1, Grouping: 5, Measure: 2, PercentA: 70, PercentB: 20, PercentC: 10 }
    const preset = datasetPresetRequest(abc, 'one-c-sales-abc', current)
    expect(preset?.Data.sorted.Row.map(item => item.type)).toEqual([46, 5])
    expect(preset?.Data.abcClassification).toEqual(current.abcClassification)
    expect(preset?.Data.AbcClassification).toBeUndefined()
  })
})
