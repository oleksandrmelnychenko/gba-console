import { describe, expect, it } from 'vitest'
import { datasetConfigurationError, datasetFilters, datasetGroupings, datasetMeasurements, datasetPresetRequest, datasetPresets, defaultDatasetRequest } from './reportDatasets'
import { grossDataset, netDataset, purchaseDataset, reportDatasets, stockDataset, currentStockDatasets, placementDataset, reservationDataset } from './reportDatasets.test-fixtures'
import { flattenCheckedMeasurements } from './reportOptions'
import { createSalesReportPreset } from './reportPresets'

describe('report dataset capabilities', () => {
  it.each([
    { dataset: placementDataset, rows: [29, 30, 31, 32, 28], measures: [17], preset: 'placements-by-location' as const },
    { dataset: reservationDataset, rows: [12, 15, 29, 28], measures: [19], preset: 'reservations-by-agreement' as const },
  ])('builds the bounded default and explicit preset for source $dataset.DataSource', ({ dataset, rows, measures, preset }) => {
    const data = defaultDatasetRequest(dataset, '2026-06-01', '2026-06-30')
    expect(data.from).toBe('')
    expect(data.to).toBe('')
    expect(data.sorted.Row.map(field => field.type)).toEqual(rows)
    expect(data.sorted.Col).toEqual([])
    expect(data.sorted.Measurements.map(field => field.Type)).toEqual(measures)
    expect(datasetConfigurationError(data, dataset)).toBeNull()
    expect(datasetPresets(dataset).map(field => field.id)).toEqual([preset])
    expect(datasetPresetRequest(dataset, preset, data)?.Data).toEqual(data)
    expect(datasetPresets({ ...dataset, Groupings: dataset.Groupings.filter(field => field.Type !== rows[0]) })).toEqual([])
    expect(datasetPresets({ ...dataset, Measurements: [] })).toEqual([])
  })

  it('keeps physical lot-row and customer-agreement identities distinct from receipts and customer type', () => {
    expect(datasetGroupings(placementDataset).filter(field => field.type >= 30)).toEqual([
      { type: 30, key: 'StockStorageNumber', label: 'Стелаж' },
      { type: 31, key: 'StockRowNumber', label: 'Ряд' },
      { type: 32, key: 'StockCellNumber', label: 'Комірка' },
      { type: 33, key: 'StockConsignmentItem', label: 'Рядок партії' },
    ])
    expect(datasetFilters(placementDataset).find(field => field.field.Type === 22)?.field.Name).toBe('StockConsignmentItem')
    expect(datasetGroupings(reservationDataset).some(field => field.type === 11)).toBe(false)
    const data = defaultDatasetRequest(reservationDataset, '', '')
    data.selections = [{ IsChecked: true, SelectedField: { Name: 'CustomerContract', Type: 9 },
      FilterCondition: { Name: 'Дорівнює', Type: 0 }, Values: [{ Data: { Id: 42, AgreementId: 999 }, Name: 'Договір 42', Value: 42 }] },
    { IsChecked: false, SelectedField: { Name: 'SupplierContract', Type: 18 },
      FilterCondition: { Name: 'Дорівнює', Type: 0 }, Values: [{ Data: { Id: 55 }, Name: 'Збережений відбір', Value: 55 }] }]
    const preset = datasetPresetRequest(reservationDataset, 'reservations-by-agreement', data)!
    expect(preset.Data.selections).toEqual(data.selections)
    expect(preset.Data.selections).not.toBe(data.selections)
    expect(datasetConfigurationError(preset.Data, reservationDataset)).toBeNull()
    preset.Data.selections[1].IsChecked = true
    expect(datasetConfigurationError(preset.Data, reservationDataset)).toContain('SupplierContract')
  })

  it.each(currentStockDatasets)('refuses saved historical dates in current source $DataSource without mutating the template', dataset => {
    const data = { ...defaultDatasetRequest(dataset, '', ''), from: '2026-06-01', to: '2026-06-30' }
    const before = structuredClone(data)
    expect(datasetConfigurationError(data, dataset)).toContain('не підтримують період або історичну дату')
    expect(data).toEqual(before)
  })

  it('builds a current warehouse/unit snapshot with no date or monetary measurements', () => {
    const data = defaultDatasetRequest(stockDataset, '2026-06-01', '2026-06-30')
    expect(data).toMatchObject({ dataSource: 4, from: '', to: '', sorted: {
      Row: [{ type: 29, key: 'Warehouse' }, { type: 28, key: 'ProductMeasureUnit' }],
      Col: [], Measurements: [{ Type: 17 }, { Type: 18 }, { Type: 19 }],
    } })
    expect(datasetConfigurationError(data, stockDataset)).toBeNull()
    expect(datasetFilters(stockDataset).find(item => item.field.Type === 21)?.field.Name).toBe('Warehouse')
    expect(datasetPresets(stockDataset).map(item => item.id)).toEqual(['stock-by-warehouse-unit'])
    expect(datasetPresets({ ...stockDataset, Groupings: stockDataset.Groupings.filter(field => field.Type !== 28) })).toEqual([])
    expect(datasetPresets({ ...stockDataset, Measurements: stockDataset.Measurements.filter(field => field.Type !== 19) })).toEqual([])
  })

  it.each([{ from: '2026-06-01', to: '' }, { from: '', to: '2026-06-30' }])('refuses historical stock templates without mutating them: %j', period => {
    const data = { ...defaultDatasetRequest(stockDataset, '', ''), ...period }
    const before = structuredClone(data)
    expect(datasetConfigurationError(data, stockDataset)).toContain('не підтримують період або історичну дату')
    expect(data).toEqual(before)
  })

  it('keeps an unsupported disabled contract intact in a stock preset and blocks it when enabled', () => {
    const data = defaultDatasetRequest(stockDataset, '', '')
    data.selections = [{ IsChecked: false, SelectedField: { Name: 'CustomerContract', Type: 9 },
      FilterCondition: { Name: 'Дорівнює', Type: 0 }, Values: [{ Data: { Id: 42, AgreementId: 9 }, Name: 'Договір', Value: 42 }] }]
    const preset = datasetPresetRequest(stockDataset, 'stock-by-warehouse-unit', data)!
    expect(preset.Data).toEqual(data)
    expect(preset.Data.selections).not.toBe(data.selections)
    expect(datasetConfigurationError(preset.Data, stockDataset)).toBeNull()
    preset.Data.selections[0].IsChecked = true
    expect(datasetConfigurationError(preset.Data, stockDataset)).toContain('CustomerContract')
    expect(data.selections[0].IsChecked).toBe(false)
  })

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
