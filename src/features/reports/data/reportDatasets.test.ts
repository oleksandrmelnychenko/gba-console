import { describe, expect, it } from 'vitest'
import { datasetConfigurationError, datasetMeasurements, datasetPresets, defaultDatasetRequest } from './reportDatasets'
import { grossDataset, netDataset, purchaseDataset } from './reportDatasets.test-fixtures'
import { flattenCheckedMeasurements } from './reportOptions'
import { createSalesReportPreset } from './reportPresets'

describe('report dataset capabilities', () => {
  it('uses only receipt quantity and net EUR amount for purchase defaults', () => {
    const data = defaultDatasetRequest(purchaseDataset, '2026-09-01', '2026-09-03')
    expect(data).toMatchObject({ dataSource: 3, from: '2026-09-01', to: '2026-09-03', sorted: { Row: [{ type: 3 }] } })
    expect(data.sorted.Measurements.map(item => item.Type)).toEqual([0, 2])
    expect(data.sorted.Measurements.map(item => item.Label)).toEqual(['Кількість надходжень', 'Вартість надходження без ПДВ, EUR'])
  })

  it('offers agreement presets only when every grouping and measure is supported', () => {
    expect(datasetPresets(netDataset).map(item => item.id)).toEqual(['agreements', 'agreement-products', 'daily'])
    expect(datasetPresets(purchaseDataset)).toEqual([])
  })

  it('refuses archived sources, unsupported conditions and disabled filters without changing data', () => {
    const data = createSalesReportPreset('agreements', '2026-09-01', '2026-09-03', [{
      IsChecked: false, SelectedField: { Name: 'CustomerContract', Type: 9 },
      FilterCondition: { Name: 'У групі', Type: 6 }, Values: [{ Data: { Id: 42 }, Name: 'Договір', Value: 42 }],
    }]).Data
    const before = structuredClone(data)
    expect(datasetConfigurationError(data, grossDataset)).toContain('CustomerContract')
    expect(datasetConfigurationError({ ...data, dataSource: 1 }, grossDataset)).toContain('архівне джерело 1С')
    expect(datasetConfigurationError({ ...data, dataSource: 3 }, purchaseDataset)).toContain('не підтримує')
    expect(data).toEqual(before)
  })

  it('preserves selected legacy aliases while excluding them from new choices', () => {
    const dataset = { ...grossDataset, Measurements: [...grossDataset.Measurements, { Type: 1, Name: 'Сума продажів (старе поле)', Selectable: false }] }
    expect(datasetMeasurements(dataset).flatMap(group => group.SubList).some(item => item.Type === 1)).toBe(false)
    const selected = [{ Type: 1, Name: 'SalesValue', IsChecked: true, parentName: 'SalesValue' }]
    const fields = flattenCheckedMeasurements(datasetMeasurements(dataset, selected))
    expect(fields).toEqual([expect.objectContaining({ Type: 1, IsChecked: true })])
    expect(datasetConfigurationError({ ...defaultDatasetRequest(dataset, '', ''), sorted: {
      Row: [{ type: 3, key: 'Day', label: 'По днях' }], Col: [], Measurements: selected,
    } }, dataset)).toBeNull()
  })
})
