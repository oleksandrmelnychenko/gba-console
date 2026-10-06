import { expect, it } from 'vitest'
import type { ReportSelection } from '../types'
import { datasetConfigurationError, datasetPresetRequest, datasetPresets, defaultDatasetRequest } from './reportDatasets'
import { importedSaleDiscountConfigurationError } from './importedSaleDiscount'
import { hasFixedReportAxes, nativeReportMeasurementUnit, usesNativeReportLookup } from './nativeReportProfiles'
import { importedDiscountDataset } from './importedSaleDiscount.test-fixtures'

const exactSelection = (field: number, id: string): ReportSelection => ({ IsChecked: true,
  SelectedField: { Type: field, Name: `Поле ${field}` }, FilterCondition: { Type: 0, Name: 'Дорівнює' },
  Values: [{ Data: { Id: id, Name: id }, Name: id, Value: 0 }],
})

it('offers a bounded native report and requires one exact agreement in its preset', () => {
  const data = defaultDatasetRequest(importedDiscountDataset, '2026-09-01', '2026-09-23')
  expect(data.sorted.Row.map(item => item.type)).toEqual([12, 15, 5])
  expect(data.sorted.Measurements.map(item => item.Type)).toEqual([79])
  expect(importedSaleDiscountConfigurationError(data, importedDiscountDataset)).toContain('Договір клієнта')
  data.selections = [exactSelection(9, '9007199254740993'), exactSelection(1, '42')]
  expect(datasetConfigurationError(data, importedDiscountDataset)).toBeNull()
  expect(usesNativeReportLookup(32)).toBe(true)
  expect(hasFixedReportAxes(32)).toBe(true)
  expect(nativeReportMeasurementUnit(32, importedDiscountDataset.Measurements[0].Name)).toBe('Євро')
  const preset = datasetPresetRequest(importedDiscountDataset, datasetPresets(importedDiscountDataset)[0].id, data)!
  expect(preset.Data.selections).toEqual(data.selections)
  expect(preset.Data.selections).not.toBe(data.selections)
  expect(datasetConfigurationError(preset.Data, importedDiscountDataset)).toBeNull()
})

it('rejects ambiguous scope, rounded IDs, period overflow and unsupported transformations', () => {
  const data = defaultDatasetRequest(importedDiscountDataset, '2026-09-01', '2026-09-23')
  data.selections = [exactSelection(9, '42')]
  expect(importedSaleDiscountConfigurationError({ ...data, from: '2026-08-01' })).toContain('31')
  expect(importedSaleDiscountConfigurationError({ ...data, selections: [...data.selections, exactSelection(9, '43')] })).toContain('один активний')
  expect(importedSaleDiscountConfigurationError({ ...data, selections: [exactSelection(9, '9223372036854775808')] })).not.toBeNull()
  expect(importedSaleDiscountConfigurationError({ ...data, selections: [{ ...data.selections[0], Values: [
    { Data: { Id: Number('9007199254740992') }, Name: 'rounded', Value: 0 },
  ] }] })).not.toBeNull()
  expect(importedSaleDiscountConfigurationError({ ...data, selections: [{ ...data.selections[0],
    FilterCondition: { Type: 1, Name: 'Не дорівнює' },
  }] })).not.toBeNull()
  expect(importedSaleDiscountConfigurationError({ ...data, ordering: {} })).not.toBeNull()
  expect(importedSaleDiscountConfigurationError({ ...data, sorted: { ...data.sorted, Row: [...data.sorted.Row].reverse() } })).not.toBeNull()
})
