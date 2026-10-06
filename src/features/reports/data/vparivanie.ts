import type { ReportDataset, ReportRequestBody } from '../types'
import { revenueExactId } from './revenueComparison'

export const VPARIVANIE_SOURCE = 36
export const VPARIVANIE_TITLE = 'Впарювання GBA: підтверджені залишки й продажі'
const invalid = 'Оберіть один точний товар, за потреби одного клієнта, та всі три показники «Впарювання».'
const forbidden = new Set(['onec', 'comparison', 'xyz', 'revenuecomparison', 'buyersalesshare', 'returncomparison',
  'ratecomparison', 'margincomparison', 'paymentcomparison', 'pricetypesalescomparison', 'agreementpricecomparison',
  'valuationclientagreementid', 'ordering', 'filterexpression', 'topgroups', 'threshold', 'hidezero',
  'abcclassification', 'productclassification', 'sourceorganizations', 'returnsonly', 'discountmarkup',
  'provideddiscounts', 'priceanalysis'])

function validDate(value: string): boolean {
  if (!/^\d{4}-\d\d-\d\d$/.test(value)) return false
  const year = Number(value.slice(0, 4))
  if (year < 2000 || year > 7998) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function vparivanieConfigurationError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  if (data.dataSource !== VPARIVANIE_SOURCE) return null
  if (dataset && (dataset.DataSource !== VPARIVANIE_SOURCE || dataset.PeriodRequired !== true
    || dataset.PeriodSupported !== true || dataset.Groupings.map(item => item.Type).join(',') !== '5'
    || dataset.Measurements.map(item => item.Type).join(',') !== '80,81,82'
    || dataset.Filters.map(item => item.Type).join(',') !== '1,5'))
    return 'Сервер не підтвердив набір «Впарювання».'
  if (!validDate(data.from) || !validDate(data.to) || data.from > data.to)
    return 'Оберіть коректний включний період «Впарювання».'
  if ((Date.parse(`${data.to}T00:00:00Z`) - Date.parse(`${data.from}T00:00:00Z`)) / 86400000 >= 366)
    return 'Період «Впарювання» може охоплювати щонайбільше 366 днів.'
  if (Object.entries(data).some(([key, value]) => forbidden.has(key.toLowerCase()) && value != null)) return invalid
  const sorted = data.sorted
  if (!sorted || !Array.isArray(sorted.Row) || sorted.Row.map(item => item.type).join(',') !== '5'
    || !Array.isArray(sorted.Col) || sorted.Col.length
    || !Array.isArray(sorted.Measurements) || sorted.Measurements.map(item => item.Type).join(',') !== '80,81,82'
    || sorted.Measurements.some(item => item.IsChecked === false || (item.IsChecked != null && typeof item.IsChecked !== 'boolean')))
    return invalid
  if (!Array.isArray(data.selections) || data.selections.length < 1 || data.selections.length > 2) return invalid
  const fields = new Set<number>()
  for (const selection of data.selections) {
    const field = selection?.SelectedField?.Type
    if ((field !== 1 && field !== 5) || fields.has(field) || selection.IsChecked === false
      || (selection.IsChecked != null && typeof selection.IsChecked !== 'boolean')
      || selection.FilterCondition?.Type !== 0 || !Array.isArray(selection.Values) || selection.Values.length !== 1
      || !revenueExactId(selection.Values[0]?.Data)
      || (selection.Values[0]?.Value !== undefined && (!Number.isInteger(selection.Values[0].Value)
        || selection.Values[0].Value < -2147483648 || selection.Values[0].Value > 2147483647))) return invalid
    fields.add(field)
  }
  return fields.has(1) ? null : invalid
}
