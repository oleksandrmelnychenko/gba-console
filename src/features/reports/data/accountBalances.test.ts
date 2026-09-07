import { describe, expect, it } from 'vitest'
import { accountBalanceDataset, accountBalanceSelections } from './accountBalances.test-fixtures'
import { datasetConfigurationError, datasetFilters, datasetGroupings, datasetPresetRequest, datasetPresets, defaultDatasetRequest } from './reportDatasets'
import { isCurrentStockSource } from './currentStockReports'
import { isCurrentReportSource, usesNativeReportLookup } from './nativeReportProfiles'

describe('recorded account balance capability profile', () => {
  it('uses purpose, kind, currency and exact account axes with one monetary measure and no dates or valuation scenario', () => {
    const data = defaultDatasetRequest(accountBalanceDataset, '2026-06-01', '2026-06-30')
    expect(data.sorted.Row.map(field => field.type)).toEqual([45, 44, 41, 40])
    expect(data.sorted.Measurements.map(field => field.Type)).toEqual([24])
    expect(data.from).toBe(''); expect(data.to).toBe(''); expect(data).not.toHaveProperty('valuationClientAgreementId')
    expect(isCurrentStockSource(11)).toBe(false); expect(isCurrentReportSource(11)).toBe(true); expect(usesNativeReportLookup(11)).toBe(true)
    expect(datasetConfigurationError(data, accountBalanceDataset)).toBeNull()
    expect(datasetGroupings(accountBalanceDataset).map(field => field.key)).toEqual(['PaymentRegister', 'PaymentCurrency', 'PaymentBalanceRecord', 'PaymentOrganization', 'PaymentRegisterKind', 'PaymentRegisterPurpose'])
    expect(datasetFilters(accountBalanceDataset).map(field => field.field.Name)).toEqual(datasetGroupings(accountBalanceDataset).map(field => field.key))
  })
  it('preserves exact active and disabled foreign filters in the preset and refuses missing capabilities', () => {
    const data = { ...defaultDatasetRequest(accountBalanceDataset, '', ''), selections: structuredClone(accountBalanceSelections) }
    const preset = datasetPresetRequest(accountBalanceDataset, datasetPresets(accountBalanceDataset)[0].id, data)!
    expect(preset.Data).toEqual(data); expect(preset.Data.selections).not.toBe(data.selections)
    for (const Type of [40, 41, 44, 45]) expect(datasetPresets({ ...accountBalanceDataset, Groupings: accountBalanceDataset.Groupings.filter(field => field.Type !== Type) })).toEqual([])
    expect(datasetPresets({ ...accountBalanceDataset, Measurements: [{ ...accountBalanceDataset.Measurements[0], Selectable: false }] })).toEqual([])
  })
  it('refuses history, foreign valuation or active ownership conditions without altering the saved data', () => {
    const data = { ...defaultDatasetRequest(accountBalanceDataset, '', ''), selections: structuredClone(accountBalanceSelections) }, before = structuredClone(data)
    expect(datasetConfigurationError({ ...data, from: '2026-06-01' }, accountBalanceDataset)).toContain('Записані залишки рахунків не підтримують період')
    expect(datasetConfigurationError({ ...data, valuationClientAgreementId: 459018 }, accountBalanceDataset)).toContain('Договір оцінки дозволено лише')
    expect(datasetConfigurationError({ ...data, selections: data.selections.map(item => ({ ...item, IsChecked: true })) }, accountBalanceDataset)).toContain('CustomerContract')
    expect(data).toEqual(before)
  })
})
