import type { ReportDataset, ReportRequestBody } from '../types'
import { revenueExactId } from './revenueComparison'
import { requestSourceBuyerSubtree, sourceBuyerSubtree } from './nativeExactFilters'

export const SUPPLIER_BATCH_GROSS_PROFIT_SOURCE = 38
export const SUPPLIER_BATCH_GROSS_PROFIT_TITLE = 'Валовий прибуток GBA за постачальниками (партії)'
export type SupplierSourceWorld = 0 | 1
export function isSupplierSourceWorldCapability(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const capability = value as Record<string, unknown>
  return capability.Version === 1 && capability.RequiresCompletePeriodLineage === true
    && Array.isArray(capability.SourceWorlds) && capability.SourceWorlds.length === 2
    && capability.SourceWorlds[0] === 0 && capability.SourceWorlds[1] === 1
}
export function requestSupplierSourceWorld(data: ReportRequestBody): unknown {
  return Object.prototype.hasOwnProperty.call(data, 'supplierSourceWorld')
    ? data.supplierSourceWorld : data.SupplierSourceWorld
}
const measures = [0, 2, 3, 4, 6, 7, 8, 10, 12, 14]
const filters = new Set([0, 1, 17])
const forbidden = new Set(['onec', 'comparison', 'xyz', 'revenuecomparison', 'buyersalesshare', 'returncomparison',
  'ratecomparison', 'margincomparison', 'paymentcomparison', 'pricetypesalescomparison', 'agreementpricecomparison',
  'valuationclientagreementid', 'ordering', 'filterexpression', 'topgroups', 'threshold', 'hidezero',
  'abcclassification', 'productclassification', 'sourceorganizations', 'returnsonly', 'discountmarkup',
  'provideddiscounts', 'priceanalysis'])
const invalid = 'Прибуток за партіями підтримує склад джерела → організацію → постачальника, 1–10 показників і точні локальні відбори.'

function validDate(value: string): boolean {
  if (!/^\d{4}-\d\d-\d\d$/.test(value)) return false
  const year = Number(value.slice(0, 4))
  if (year < 1900 || year > 9998) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function isSupplierBatchGrossProfitDataset(dataset: ReportDataset): boolean {
  return dataset.DataSource === SUPPLIER_BATCH_GROSS_PROFIT_SOURCE && dataset.PeriodRequired === true
    && dataset.PeriodSupported === true && isSupplierSourceWorldCapability(dataset.supplierSourceWorld)
    && dataset.Groupings.map(item => item.Type).join(',') === '73,4,21'
    && dataset.Measurements.map(item => item.Type).join(',') === measures.join(',')
    && dataset.Filters.map(item => item.Type).join(',') === '0,1,17'
}

export function supplierBatchGrossProfitConfigurationError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  if (data.dataSource !== SUPPLIER_BATCH_GROSS_PROFIT_SOURCE) return null
  if (dataset && !isSupplierBatchGrossProfitDataset(dataset))
    return 'Сервер не підтвердив набір партійного прибутку за постачальниками.'
  const world = requestSupplierSourceWorld(data)
  if (data.supplierSourceWorld !== undefined && data.SupplierSourceWorld !== undefined
    && data.supplierSourceWorld !== data.SupplierSourceWorld)
    return 'Шаблон суперечливо задає базу партійного прибутку.'
  if (world !== undefined && (world !== 0 && world !== 1
    || dataset && !isSupplierSourceWorldCapability(dataset.supplierSourceWorld)))
    return 'Оберіть підтверджену базу Fenix або AMG для партійного прибутку.'
  const buyers = requestSourceBuyerSubtree(data)
  if (buyers != null && (world !== 0 || !sourceBuyerSubtree(buyers)
    || dataset && dataset.sourceBuyerSubtree == null))
    return 'Для піддерева «Покупці» потрібні база Fenix і підтверджений граф покупців.'
  if (!validDate(data.from) || !validDate(data.to) || data.from > data.to)
    return 'Оберіть один коректний період партійного прибутку.'
  if ((Date.parse(`${data.to}T00:00:00Z`) - Date.parse(`${data.from}T00:00:00Z`)) / 86400000 >= 31)
    return 'Період партійного прибутку може охоплювати щонайбільше 31 день.'
  if (Object.entries(data).some(([key, value]) => forbidden.has(key.toLowerCase()) && value != null)) return invalid
  const sorted = data.sorted
  if (!sorted || !Array.isArray(sorted.Row) || sorted.Row.map(item => item.type).join(',') !== '73,4,21'
    || !Array.isArray(sorted.Col) || sorted.Col.length
    || !Array.isArray(sorted.Measurements) || sorted.Measurements.length < 1 || sorted.Measurements.length > 10
    || sorted.Measurements.some(item => !measures.includes(item.Type)
      || (item.IsChecked != null && typeof item.IsChecked !== 'boolean'))
    || new Set(sorted.Measurements.map(item => item.Type)).size !== sorted.Measurements.length
    || sorted.Measurements.every(item => item.IsChecked === false)) return invalid
  if (!Array.isArray(data.selections) || data.selections.length > 32) return invalid
  let values = 0
  const activeFields = new Set<number>()
  for (const selection of data.selections) {
    if (!selection || (selection.IsChecked != null && typeof selection.IsChecked !== 'boolean')
      || !filters.has(selection.SelectedField?.Type) || ![0, 2].includes(selection.FilterCondition?.Type)
      || !Array.isArray(selection.Values) || !selection.Values.length
      || (selection.FilterCondition.Type === 0 && selection.Values.length !== 1)) return invalid
    values += selection.Values.length
    if (selection.IsChecked !== false) {
      if (activeFields.has(selection.SelectedField.Type)) return invalid
      activeFields.add(selection.SelectedField.Type)
    }
    if (values > 100 || selection.Values.some(value => !value || !revenueExactId(value.Data)
      || (value.Value !== undefined && (!Number.isInteger(value.Value)
        || value.Value < -2147483648 || value.Value > 2147483647)))) return invalid
  }
  return null
}
