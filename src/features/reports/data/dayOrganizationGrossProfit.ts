import type { ReportDataset, ReportRequestBody } from '../types'
import { revenueExactId } from './revenueComparison'

export const DAY_ORGANIZATION_GROSS_PROFIT_SOURCE = 35
export const DAY_ORGANIZATION_GROSS_PROFIT_TITLE = 'Валовий прибуток GBA за днем та організацією'
// Exact saved Fenix setting 0x1893a68ef4db1647a85309ae4c2ff7ce: "Товар", excluding services.
export const DAY_ORGANIZATION_GOODS_KIND_ID = '8AB2005056C0000811DEF956DA4CFDA0'
// Exact five IDs in the structurally matching saved Fenix setting.
export const DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS = [
  'A98BC3FAAC5CA23811E99CCA70CA60B9',
  '8AB2005056C0000811DEF92AB3F4DFF1',
  '8AB2005056C0000811DF04FAB939A4DE',
  '94B4005056C0000811DF1A0C73BC9A12',
  '88D1B8CB29DC7A6911ECFC60797DF65F',
] as const
const measures = [2, 3, 4, 6, 7, 8, 10, 12, 14, 15]
const filters = new Set([0, 1, 2, 6, 9])
const conditions = new Set([0, 2])
const unsupported = new Set(['onec', 'comparison', 'xyz', 'revenuecomparison', 'buyersalesshare', 'returncomparison',
  'ratecomparison', 'margincomparison', 'paymentcomparison', 'pricetypesalescomparison', 'agreementpricecomparison',
  'valuationclientagreementid', 'ordering', 'filterexpression', 'topgroups', 'threshold', 'hidezero',
  'abcclassification', 'returnsonly', 'discountmarkup',
  'provideddiscounts', 'priceanalysis'])
const invalid = 'Валовий прибуток GBA за днем підтримує День → Організація, 1–10 показників і підтверджені точні відбори.'

function validDate(value: string): boolean {
  if (!/^\d{4}-\d\d-\d\d$/.test(value)) return false
  const year = Number(value.slice(0, 4))
  if (year < 1900 || year > 9998) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function isDayOrganizationGrossProfitDataset(dataset: ReportDataset): boolean {
  return dataset.DataSource === DAY_ORGANIZATION_GROSS_PROFIT_SOURCE && dataset.PeriodRequired === true
    && dataset.PeriodSupported === true && dataset.Groupings.map(field => field.Type).join(',') === '3,4'
    && dataset.Measurements.map(field => field.Type).join(',') === measures.join(',')
    && dataset.Filters.map(field => field.Type).join(',') === '0,1,2,6,9'
}

export function dayOrganizationGrossProfitConfigurationError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  if (data.dataSource !== DAY_ORGANIZATION_GROSS_PROFIT_SOURCE) return null
  if (dataset && !isDayOrganizationGrossProfitDataset(dataset))
    return 'Сервер не підтвердив набір валового прибутку GBA за днем.'
  if (!validDate(data.from) || !validDate(data.to) || data.from > data.to) return 'Оберіть один коректний період валового прибутку GBA.'
  if ((Date.parse(`${data.to}T00:00:00Z`) - Date.parse(`${data.from}T00:00:00Z`)) / 86400000 >= 31)
    return 'Період валового прибутку GBA може охоплювати щонайбільше 31 календарний день.'
  if (Object.entries(data).some(([key, value]) => unsupported.has(key.toLowerCase()) && value != null)) return invalid
  const sorted = data.sorted
  if (!sorted || !Array.isArray(sorted.Row) || !Array.isArray(sorted.Col) || !Array.isArray(sorted.Measurements)
    || sorted.Row.map(item => item.type).join(',') !== '3,4' || sorted.Col.length
    || sorted.Measurements.length < 1 || sorted.Measurements.length > 10
    || sorted.Measurements.some(item => !measures.includes(item.Type)
      || (item.IsChecked !== undefined && typeof item.IsChecked !== 'boolean'))
    || new Set(sorted.Measurements.map(item => item.Type)).size !== sorted.Measurements.length
    || sorted.Measurements.every(item => item.IsChecked === false)) return invalid
  if (!Array.isArray(data.selections) || data.selections.length > 32) return invalid
  let count = 0
  for (const selection of data.selections) {
    if (!Array.isArray(selection?.Values)) return invalid
    count += selection.Values.length
    if (count > 100 || (selection.IsChecked !== undefined && typeof selection.IsChecked !== 'boolean')
      || !filters.has(selection.SelectedField?.Type)
      || !conditions.has(selection.FilterCondition?.Type) || !selection.Values.length
      || (selection.FilterCondition?.Type === 0 && selection.Values.length !== 1)
      || selection.Values.some(value => !value || !revenueExactId(value.Data)
        || (value.Value !== undefined && (!Number.isInteger(value.Value)
          || value.Value < -2147483648 || value.Value > 2147483647)))) return invalid
  }
  return null
}
