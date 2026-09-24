import type { ReportDataset, ReportRequestBody } from '../types'
import { revenueExactId } from './revenueComparison'

export const RECORDED_SALE_GROSS_PROFIT_SOURCE = 30
const rows = [12, 15]
const measures = new Set([2, 6, 10, 14])
const filters = new Set([1, 2, 6, 9])
const conditions = new Set([0, 1, 2, 4])
const unsupported = new Set(['onec', 'comparison', 'xyz', 'revenuecomparison', 'buyersalesshare', 'returncomparison',
  'ratecomparison', 'margincomparison', 'paymentcomparison', 'pricetypesalescomparison', 'agreementpricecomparison',
  'valuationclientagreementid', 'ordering', 'filterexpression', 'topgroups', 'threshold', 'hidezero',
  'abcclassification', 'productclassification', 'sourceorganizations', 'returnsonly', 'discountmarkup',
  'provideddiscounts', 'priceanalysis'])
const invalid = 'Валовий прибуток GBA підтримує один період, Клієнт → Договір, 1–4 показники та точні відбори товару, клієнта або договору.'

function validDate(value: string): boolean {
  if (!/^\d{4}-\d\d-\d\d$/.test(value)) return false
  const year = Number(value.slice(0, 4))
  if (year < 1900 || year > 9998) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function recordedSaleGrossProfitConfigurationError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  if (data.dataSource !== RECORDED_SALE_GROSS_PROFIT_SOURCE) return null
  if (dataset && (dataset.DataSource !== RECORDED_SALE_GROSS_PROFIT_SOURCE || dataset.PeriodRequired !== true
    || dataset.PeriodSupported !== true || dataset.Groupings.map(field => field.Type).join(',') !== '12,15'
    || dataset.Measurements.map(field => field.Type).join(',') !== '2,6,10,14'
    || dataset.Filters.map(field => field.Type).join(',') !== '1,2,6,9'))
    return 'Сервер не підтвердив набір валового прибутку GBA.'
  if (!validDate(data.from) || !validDate(data.to) || data.from > data.to) return 'Оберіть один коректний період валового прибутку GBA.'
  if ((Date.parse(`${data.to}T00:00:00Z`) - Date.parse(`${data.from}T00:00:00Z`)) / 86400000 >= 31)
    return 'Період валового прибутку GBA може охоплювати щонайбільше 31 календарний день.'
  if (Object.entries(data).some(([key, value]) => unsupported.has(key.toLowerCase()) && value != null)) return invalid
  if (!data.sorted || !Array.isArray(data.sorted.Row) || !Array.isArray(data.sorted.Col)
    || !Array.isArray(data.sorted.Measurements) || data.sorted.Row.map(item => item.type).join(',') !== rows.join(',')
    || data.sorted.Col.length || data.sorted.Measurements.length < 1 || data.sorted.Measurements.length > 4
    || data.sorted.Measurements.some(item => !measures.has(item.Type))
    || new Set(data.sorted.Measurements.map(item => item.Type)).size !== data.sorted.Measurements.length
    || data.sorted.Measurements.every(item => item.IsChecked === false)) return invalid
  if (!Array.isArray(data.selections) || data.selections.length > 64) return invalid
  let count = 0
  for (const selection of data.selections) {
    if (!Array.isArray(selection?.Values)) return invalid
    count += selection.Values.length
    if (count > 2000) return invalid
    if (selection.IsChecked === false) continue
    if (!filters.has(selection.SelectedField?.Type) || !conditions.has(selection.FilterCondition?.Type)
      || !selection.Values.length || selection.Values.some(value => !revenueExactId(value.Data))) return invalid
  }
  return null
}
