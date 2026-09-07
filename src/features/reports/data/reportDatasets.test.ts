import { describe, expect, it } from 'vitest'
import { datasetConfigurationError, datasetFilters, datasetGroupings, datasetMeasurements, datasetPresetRequest, datasetPresets, defaultDatasetRequest } from './reportDatasets'
import { grossDataset, netDataset, purchaseDataset, reportDatasets } from './reportDatasets.test-fixtures'
import { flattenCheckedMeasurements } from './reportOptions'
import { createSalesReportPreset } from './reportPresets'

describe('report dataset capabilities', () => {
  it('uses only receipt quantity and net EUR amount for purchase defaults', () => {
    const data = defaultDatasetRequest(purchaseDataset, '2026-09-01', '2026-09-03')
    expect(data).toMatchObject({ dataSource: 3, from: '2026-09-01', to: '2026-09-03', sorted: { Row: [{ type: 28 }, { type: 3 }] } })
    expect(data.sorted.Measurements.map(item => item.Type)).toEqual([0, 2])
    expect(data.sorted.Measurements.map(item => item.Label)).toEqual(['Кількість надходжень', 'Вартість надходження без ПДВ, EUR'])
  })

  it('offers agreement presets only when every grouping and measure is supported', () => {
    expect(datasetPresets(netDataset).map(item => item.id)).toEqual(['quantities-by-unit', 'agreements', 'agreement-products', 'daily'])
    expect(datasetPresets(purchaseDataset).map(item => item.id)).toEqual(['quantities-by-unit'])
  })

  it.each(reportDatasets)('keeps quantities separated by unit in source $DataSource presets', dataset => {
    const current = defaultDatasetRequest(dataset, '2026-09-01', '2026-09-03')
    current.selections = [{ IsChecked: false, SelectedField: { Name: 'ProductMeasureUnit', Type: 20 },
      FilterCondition: { Name: 'Дорівнює', Type: 0 }, Values: [{ Data: { Id: 77, Name: 'м' }, Name: 'м', Value: 77 }] }]
    const preset = datasetPresetRequest(dataset, 'quantities-by-unit', current)!
    expect(preset.Data).toMatchObject({ dataSource: dataset.DataSource, from: current.from, to: current.to,
      sorted: { Row: [{ type: 28, key: 'ProductMeasureUnit' }, { type: 3 }], Col: [], Measurements: [{ Type: 0 }] },
      selections: current.selections })
    expect(preset.Data.selections).not.toBe(current.selections)
    expect(datasetConfigurationError(preset.Data, dataset)).toBeNull()
    expect(datasetGroupings(dataset)).toContainEqual({ type: 28, key: 'ProductMeasureUnit', label: 'Одиниця виміру' })
    expect(datasetFilters(dataset).find(field => field.field.Type === 20)?.field.Name).toBe('ProductMeasureUnit')
  })

  it('withholds the unit preset until both grouping and quantity capabilities are available', () => {
    for (const dataset of [
      { ...purchaseDataset, Groupings: purchaseDataset.Groupings.filter(field => field.Type !== 28) },
      { ...purchaseDataset, Groupings: purchaseDataset.Groupings.filter(field => field.Type !== 3) },
      { ...purchaseDataset, Measurements: purchaseDataset.Measurements.filter(field => field.Type !== 0) },
    ]) {
      expect(datasetPresets(dataset)).toEqual([])
      expect(datasetPresetRequest(dataset, 'quantities-by-unit', defaultDatasetRequest(dataset, '', ''))).toBeNull()
    }
  })

  it('preserves published price groupings 26/27 while quantity units use only 28', () => {
    const priceFields = [{ Type: 26, Name: 'Ціна продажу з ПДВ, EUR' }, { Type: 27, Name: 'Собівартість одиниці з ПДВ, EUR' }]
    const dataset = { ...grossDataset, Groupings: [...grossDataset.Groupings, ...priceFields] }
    const groupings = datasetGroupings(dataset)
    expect(groupings.filter(item => item.type === 26 || item.type === 27)).toEqual([
      { type: 26, key: 'SalesUnitGrossPrice', label: priceFields[0].Name },
      { type: 27, key: 'CostUnitGrossPrice', label: priceFields[1].Name },
    ])
    const priceTemplate = { ...defaultDatasetRequest(dataset, '', ''), sorted: {
      Row: [groupings.find(item => item.type === 26)!], Col: [groupings.find(item => item.type === 27)!], Measurements: [],
    } }
    const before = structuredClone(priceTemplate)
    expect(datasetConfigurationError(priceTemplate, dataset)).toBeNull()
    expect(priceTemplate).toEqual(before)
    expect(defaultDatasetRequest(dataset, '', '').sorted.Row.map(item => item.type)).toEqual([28, 3])
    const withoutUnit = { ...dataset, Groupings: dataset.Groupings.filter(field => field.Type !== 28) }
    expect(defaultDatasetRequest(withoutUnit, '', '').sorted.Row.map(item => item.type)).toEqual([3])
    expect(datasetPresets(withoutUnit).some(item => item.id === 'quantities-by-unit')).toBe(false)
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
