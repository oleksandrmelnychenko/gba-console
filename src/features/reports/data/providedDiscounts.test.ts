import { describe, expect, it } from 'vitest'
import { normalizeSavedTemplate } from '../api/reportWorkspaceApi'
import { datasetPresetRequest, defaultDatasetRequest } from './reportDatasets'
import { cloneOneCSpecialAliases, currentProvidedDiscountLookupBasis, defaultOneCSpecialSettings,
  oneCSpecialSettingsError, oneCSpecialSettingsForWorld, providedDiscountBasis } from './oneCSpecialReports'
import { retainStoredTemplateFields } from './reportTemplateDraft'
import { currentProvidedDiscountsDataset as dataset, providedDiscountRequest } from './providedDiscounts.test-fixtures'

describe('current provided discounts request contract', () => {
  it('defaults only new supported Fenix forms to0 and keeps old server fallback honest', () => {
    expect(defaultDatasetRequest(dataset, '2026-09-01', '2026-09-30').providedDiscounts)
      .toEqual({ Version: 1, SourceWorld: 1, Basis: 0 })
    const legacy = { ...dataset, providedDiscounts: { Version: 1, SourceWorlds: [1, 2] } }
    expect(defaultOneCSpecialSettings(24, legacy).providedDiscounts).toEqual({ Version: 1, SourceWorld: null })
    expect(oneCSpecialSettingsForWorld(24, 'amg', dataset).providedDiscounts).toEqual({ Version: 1, SourceWorld: 2, Basis: 1 })
    expect(oneCSpecialSettingsError(providedDiscountRequest(0), dataset)).toBeNull()
    expect(oneCSpecialSettingsError(providedDiscountRequest(0), legacy)).toBeTruthy()
  })

  it.each([undefined, null, 0, 1] as const)('retains saved basis %s through clone, normalize, presets and draft', Basis => {
    const saved = providedDiscountRequest(Basis)
    const clone = cloneOneCSpecialAliases(saved)
    expect(clone.providedDiscounts).toEqual(saved.providedDiscounts)
    expect(clone.providedDiscounts).not.toBe(saved.providedDiscounts)
    const normalized = normalizeSavedTemplate({ Id: 'provided-template', Revision: 1, Name: 'Знижки', UpdatedAtUtc: '2026-10-01T00:00:00Z',
      Data: { DataSource: 24, From: saved.from, To: saved.to, Sorted: saved.sorted, Selections: [], ProvidedDiscounts: saved.providedDiscounts } })
    expect(normalized.Data.ProvidedDiscounts).toEqual(saved.providedDiscounts)
    expect(retainStoredTemplateFields(saved, saved).providedDiscounts).toEqual(saved.providedDiscounts)
    const preset = datasetPresetRequest(dataset, 'one-c-provided-discounts', saved)
    expect(preset).not.toBeNull()
    expect(preset!.Data.providedDiscounts).toEqual(saved.providedDiscounts)
    expect(oneCSpecialSettingsError(saved, dataset)).toBeNull()
    expect(providedDiscountBasis(saved.providedDiscounts)).toBe(Basis === 0 ? 0 : 1)
  })

  it('includes basis in exact file/preview fingerprint and canonicalizes one stored case alias', () => {
    const current = providedDiscountRequest(0), legacy = providedDiscountRequest(1)
    expect(JSON.stringify(current)).not.toBe(JSON.stringify(legacy))
    const settings = { Version: 1, SourceWorld: 1, basis: 0 }
    expect(cloneOneCSpecialAliases({ ProvidedDiscounts: settings }).ProvidedDiscounts).toEqual({ Version: 1, SourceWorld: 1, Basis: 0 })
    expect(oneCSpecialSettingsError({ ...current, providedDiscounts: { ...settings, Basis: 1 } }, dataset)).toBeTruthy()
    expect(currentProvidedDiscountLookupBasis(24, current.providedDiscounts, dataset)).toBe(0)
    expect(currentProvidedDiscountLookupBasis(24, legacy.providedDiscounts, dataset)).toBeUndefined()
    expect(currentProvidedDiscountLookupBasis(23, current.providedDiscounts, dataset)).toBeUndefined()
    expect(oneCSpecialSettingsError({ ...current, providedDiscounts: { Version: 1, SourceWorld: 2, Basis: 0 } }, dataset)).toBeTruthy()
  })
})
