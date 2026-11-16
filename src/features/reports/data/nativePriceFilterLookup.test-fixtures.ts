import type { ReportDataset, ReportSelection } from '../types'
import { reportProductDataset } from './reportProductLookup.test-fixtures'
import { NATIVE_PRICE_FILTER_FIELDS, PRICE_FILTER_ENDPOINT, priceFilterDescriptor, type NativePriceFilterField } from './nativePriceFilterLookup'
export const PRICE_FILTER_NAMES: Record<NativePriceFilterField, string> = { 3: 'TOP товару', 4: 'Товарна група', 7: 'Регіон клієнта', 8: 'Код регіону клієнта', 10: 'Основний менеджер клієнта', 11: 'Покупець. Тип цін', 12: 'Документ продажу GBA', 14: 'Власний документ повернення GBA', 15: 'Користувач, який додав товар у продаж', 16: 'Користувач, який провів накладну продажу', 21: 'Склад' }
export const priceCapabilityFixture = () => ({ version: 1, dataSource: 46, endpoint: PRICE_FILTER_ENDPOINT, paging: 'offset', maximumPageSize: 50, fields: NATIVE_PRICE_FILTER_FIELDS.map(priceFilterDescriptor) })
export const priceDatasetFixture = (): ReportDataset => ({ ...reportProductDataset(46), Limitations: [], priceFilterLookup: priceCapabilityFixture(), Filters: [{ Type: 1, Name: 'Товар' }, ...NATIVE_PRICE_FILTER_FIELDS.map(Type => ({ Type, Name: PRICE_FILTER_NAMES[Type], Selectable: true }))] })
export function priceSelectionFixture(field: NativePriceFilterField, condition = 0): ReportSelection {
  return { IsChecked: true, SelectedField: { Type: field, Name: PRICE_FILTER_NAMES[field] }, FilterCondition: { Type: condition, Name: 'Умова' }, Values: [] }
}
