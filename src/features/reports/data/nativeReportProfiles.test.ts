import { describe, expect, it } from 'vitest'
import { datasetConfigurationError, datasetFilters, datasetGroupings, datasetPresetRequest, datasetPresets, defaultDatasetRequest } from './reportDatasets'
import { currentDebtDataset, supplierReturnDataset } from './reportDatasets.test-fixtures'
import { isCurrentStockSource } from './currentStockReports'
import { getNativeReportProfile, isCurrentReportSource, usesNativeReportLookup } from './nativeReportProfiles'

describe('native return documents and current debt profiles', () => {
  it.each([[supplierReturnDataset,[38,3,28],22],[currentDebtDataset,[36,12,15],23]] as const)('uses only source $0.DataSource fields and preserves exact disabled filters in its preset', (dataset,rows,measure) => {
    const current=defaultDatasetRequest(dataset,'2026-06-01','2026-06-30')
    current.selections=[{IsChecked:false,SelectedField:{Type:18,Name:'SupplierContract'},FilterCondition:{Type:0,Name:'Дорівнює'},Values:[{Data:{Id:42},Name:'42',Value:42}]}]
    const preset=datasetPresetRequest(dataset,datasetPresets(dataset)[0].id,current)!
    expect(preset.Data.sorted.Row.map(item=>item.type)).toEqual(rows)
    expect(preset.Data.sorted.Measurements.map(item=>item.Type)).toEqual([measure])
    expect(preset.Data.selections).toEqual(current.selections)
    expect(preset.Data.selections).not.toBe(current.selections)
    expect(preset.Data.from).toBe(dataset.DataSource===9?'2026-06-01':'')
    expect(preset.Data.to).toBe(dataset.DataSource===9?'2026-06-30':'')
    expect(datasetConfigurationError(preset.Data,dataset)).toBeNull()
    expect(preset.Data).not.toHaveProperty('valuationClientAgreementId')
  })
  it('uses native exact-domain lookups for both sources while distinguishing current debt from stock',()=>{
    expect(usesNativeReportLookup(9)).toBe(true);expect(usesNativeReportLookup(10)).toBe(true)
    expect(isCurrentReportSource(9)).toBe(false);expect(isCurrentReportSource(10)).toBe(true)
    expect(isCurrentStockSource(10)).toBe(false)
    expect(getNativeReportProfile(1)).toBeUndefined();expect(getNativeReportProfile(11)).toBeUndefined()
    expect(datasetGroupings(currentDebtDataset).find(item=>item.type===37)?.key).toBe('DebtDocument')
    expect(datasetFilters(currentDebtDataset).find(item=>item.field.Type===26)?.field.Name).toBe('DebtDocument')
    expect(datasetFilters(supplierReturnDataset).find(item=>item.field.Type===27)?.field.Name).toBe('SupplierReturnMode')
  })
  it('refuses debt history and foreign valuation scenarios before altering settings',()=>{
    expect(datasetConfigurationError(defaultDatasetRequest(supplierReturnDataset,'',''),supplierReturnDataset)).toContain('потрібні обидві дати')
    const data=defaultDatasetRequest(currentDebtDataset,'','')
    expect(datasetConfigurationError({...data,from:'2026-06-01'},currentDebtDataset)).toContain('Поточна заборгованість не підтримує період')
    for(const dataset of [currentDebtDataset,supplierReturnDataset]) expect(datasetConfigurationError({...defaultDatasetRequest(dataset,'2026-06-01','2026-06-30'),valuationClientAgreementId:42},dataset)).toContain('Договір оцінки дозволено лише')
  })
})
