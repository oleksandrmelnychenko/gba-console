import { describe, expect, it } from 'vitest'
import type { ReportRequestBody } from '../types'
import { datasetConfigurationError, datasetPresetRequest, datasetPresets, defaultDatasetRequest } from './reportDatasets'
import { reportDatasets, currentStockDatasets, valuationDataset } from './reportDatasets.test-fixtures'

describe('exact client agreement valuation scenario', () => {
  it('offers the current warehouse/unit valuation preset but requires an exact agreement before generating or saving', () => {
    const data = defaultDatasetRequest(valuationDataset, '2026-06-01', '2026-06-30')
    expect(data).toMatchObject({ dataSource: 8, from: '', to: '', sorted: { Row: [{ type: 29 }, { type: 28 }], Col: [], Measurements: [{ Type: 17 }, { Type: 21 }] } })
    expect(datasetConfigurationError(data, valuationDataset)).toContain('Виберіть точний договір')
    expect(datasetPresets(valuationDataset).map(item => item.id)).toEqual(['stock-value-by-agreement'])
    data.valuationClientAgreementId = 459018
    data.selections = [{ IsChecked: false, SelectedField: { Type: 9, Name: 'CustomerContract' },
      FilterCondition: { Type: 0, Name: 'Дорівнює' }, Values: [{ Data: { Id: 458945 }, Name: 'Збережений договір', Value: 458945 }] }]
    expect(datasetConfigurationError(data, valuationDataset)).toBeNull()
    expect(datasetPresetRequest(valuationDataset, 'stock-value-by-agreement', data)?.Data).toEqual(data)
    data.selections[0].IsChecked = true
    expect(datasetConfigurationError(data, valuationDataset)).toContain('CustomerContract')
  })

  it.each([undefined, null, 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '459018'])('refuses invalid valuation identity %s without mutating a saved configuration', value => {
    const data = { ...defaultDatasetRequest(valuationDataset, '', ''), valuationClientAgreementId: value } as unknown as ReportRequestBody
    const before = structuredClone(data)
    expect(datasetConfigurationError(data, valuationDataset)).toContain('Виберіть точний договір')
    expect(data).toEqual(before)
  })

  it.each([...reportDatasets, ...currentStockDatasets])('rejects valuation scenario leakage into source $DataSource', dataset => {
    const data = { ...defaultDatasetRequest(dataset, '', ''), valuationClientAgreementId: 459018 }
    const before = structuredClone(data)
    expect(datasetConfigurationError(data, dataset)).toContain('Договір оцінки дозволено лише')
    expect(data).toEqual(before)
    expect(defaultDatasetRequest(dataset, '', '').valuationClientAgreementId).toBeUndefined()
  })
})
