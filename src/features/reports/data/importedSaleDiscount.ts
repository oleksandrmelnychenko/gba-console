import type { ReportDataset, ReportRequestBody } from '../types'
import { revenueExactId } from './revenueComparison'

export const IMPORTED_SALE_DISCOUNT_SOURCE = 32
export const IMPORTED_SALE_DISCOUNT_TITLE = 'Записана знижка/націнка імпортованих продажів GBA, EUR'
const allowedFilters = new Set([1, 2, 6, 9])
const unsupported = new Set(['onec', 'comparison', 'xyz', 'revenuecomparison', 'buyersalesshare', 'returncomparison',
  'ratecomparison', 'margincomparison', 'paymentcomparison', 'pricetypesalescomparison', 'agreementpricecomparison',
  'valuationclientagreementid', 'ordering', 'filterexpression', 'topgroups', 'threshold', 'hidezero',
  'abcclassification', 'productclassification', 'sourceorganizations', 'returnsonly', 'discountmarkup',
  'provideddiscounts', 'priceanalysis'])
const invalid = 'Записана знижка/націнка GBA підтримує один період до 31 дня, Клієнт → точний договір → Товар, один показник EUR і точні відбори.'

function validDate(value: string): boolean {
  if (!/^\d{4}-\d\d-\d\d$/.test(value) || Number(value.slice(0, 4)) < 1900 || Number(value.slice(0, 4)) > 9998) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function importedSaleDiscountConfigurationError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  if (data.dataSource !== IMPORTED_SALE_DISCOUNT_SOURCE) return null
  if (dataset && (dataset.DataSource !== IMPORTED_SALE_DISCOUNT_SOURCE || dataset.PeriodRequired !== true
    || dataset.PeriodSupported !== true || dataset.Groupings.map(field => field.Type).join(',') !== '12,15,5'
    || dataset.Measurements.map(field => field.Type).join(',') !== '79'
    || dataset.Filters.map(field => field.Type).join(',') !== '1,2,6,9'))
    return 'Сервер не підтвердив набір записаних знижок імпортованих продажів GBA.'
  if (!validDate(data.from) || !validDate(data.to) || data.from > data.to) return 'Оберіть коректний період записаних знижок GBA.'
  if ((Date.parse(`${data.to}T00:00:00Z`) - Date.parse(`${data.from}T00:00:00Z`)) / 86400000 >= 31)
    return 'Період записаних знижок GBA може охоплювати щонайбільше 31 календарний день.'
  if (Object.entries(data).some(([key, value]) => unsupported.has(key.toLowerCase()) && value != null)) return invalid
  if (!data.sorted || !Array.isArray(data.sorted.Row) || !Array.isArray(data.sorted.Col)
    || !Array.isArray(data.sorted.Measurements) || data.sorted.Row.map(item => item.type).join(',') !== '12,15,5'
    || data.sorted.Col.length || data.sorted.Measurements.length !== 1 || data.sorted.Measurements[0].Type !== 79
    || data.sorted.Measurements[0].IsChecked === false) return invalid
  if (!Array.isArray(data.selections) || data.selections.length > 8) return invalid
  let values = 0
  let agreementFilters = 0
  for (const selection of data.selections) {
    if (!selection || !Array.isArray(selection.Values)) return invalid
    values += selection.Values.length
    if (values > 64) return invalid
    if (!allowedFilters.has(selection.SelectedField?.Type)
      || ![0, 2].includes(selection.FilterCondition?.Type)
      || !selection.Values.length || (selection.FilterCondition.Type === 0 && selection.Values.length !== 1)
      || selection.Values.some(value => {
        const id = revenueExactId(value.Data)
        return !id || (value.Value !== undefined
          && (!Number.isInteger(value.Value) || value.Value < -2147483648 || value.Value > 2147483647))
      })) return invalid
    if (selection.SelectedField.Type === 9 && selection.IsChecked !== false) {
      if (selection.FilterCondition.Type !== 0 || selection.Values.length !== 1) return invalid
      agreementFilters++
    }
  }
  return agreementFilters === 1 ? null : 'Для записаної знижки/націнки GBA потрібен один активний точний відбір «Договір клієнта».'
}
