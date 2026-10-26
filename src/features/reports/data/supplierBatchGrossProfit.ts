import { validProfitRows, readReportConfiguration } from './reportConfiguration'
import { requestProfitReadMode, profitReadModeConfigurationError, currentProfitMaximumDays } from './profitReadMode'
import { originalNormalPeriodError } from './originalNormalPeriod'
import type { ReportDataset, ReportRequestBody } from '../types'
import { revenueExactId } from './revenueComparison'
import { datasetGroupSelectionError, isDatasetGroupSelection } from './reportHierarchyFilters'
import { requestSourceBuyerSubtree, sourceBuyerSubtree } from './nativeExactFilters'
import { readFilterExpressionCapabilities, reportFilterExpressionError, requestFilterExpression } from './reportFilterExpression'
import { requestSupplierBasis, supplierBasisConfigurationError } from './supplierBasis'

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
const legacyMeasures = [0, 2, 3, 4, 6, 7, 8, 10, 12, 14]
const measures = [0, 2, 3, 4, 6, 7, 8, 10, 12, 14, 11, 15]
const filters = new Set([0, 1, 17])
const forbidden = new Set(['onec', 'comparison', 'xyz', 'revenuecomparison', 'buyersalesshare', 'returncomparison',
  'ratecomparison', 'margincomparison', 'paymentcomparison', 'pricetypesalescomparison', 'agreementpricecomparison',
  'valuationclientagreementid', 'ordering', 'topgroups', 'threshold', 'hidezero',
  'abcclassification', 'productclassification', 'sourceorganizations', 'returnsonly', 'discountmarkup',
  'provideddiscounts', 'priceanalysis'])
const invalid = 'Прибуток за партіями підтримує склад надходження або продажу 1С → організацію → постачальника, доступні показники й точні локальні відбори.'

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
    && ['73,4,21', '73,78,4,21'].includes(dataset.Groupings.map(item => item.Type).join(','))
    && [legacyMeasures.join(','), measures.join(',')].includes(dataset.Measurements.map(item => item.Type).join(','))
    && dataset.Filters.map(item => item.Type).join(',') === '0,1,17'
}

export function supplierBatchGrossProfitConfigurationError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  if (data.dataSource !== SUPPLIER_BATCH_GROSS_PROFIT_SOURCE) return null
  const modeError = profitReadModeConfigurationError(data, dataset)
  if (modeError) return modeError
  const basisError = supplierBasisConfigurationError(data, dataset)
  if (basisError) return basisError
  if (dataset && !isSupplierBatchGrossProfitDataset(dataset))
    return 'Сервер не підтвердив набір партійного прибутку за постачальниками.'
  const world = requestSupplierSourceWorld(data)
  if (data.supplierSourceWorld !== undefined && data.SupplierSourceWorld !== undefined
    && data.supplierSourceWorld !== data.SupplierSourceWorld)
    return 'Шаблон суперечливо задає базу партійного прибутку.'
  if (world != null && (world !== 0 && world !== 1
    || dataset && !isSupplierSourceWorldCapability(dataset.supplierSourceWorld)))
    return 'Оберіть підтверджену базу Fenix або AMG для партійного прибутку.'
  const buyers = requestSourceBuyerSubtree(data)
  if (buyers != null && (world !== 0 && !(requestSupplierBasis(data) === 0 && world == null)
    || !sourceBuyerSubtree(buyers)
    || dataset && dataset.sourceBuyerSubtree == null))
    return 'Для піддерева «Покупці» потрібні база Fenix і підтверджений граф покупців.'
  if (!validDate(data.from) || !validDate(data.to) || data.from > data.to)
    return 'Оберіть один коректний період партійного прибутку.'
  const normal = requestProfitReadMode(data) !== 0 && world === 0 && requestSupplierBasis(data) === 0
  const maximumDays = requestProfitReadMode(data) === 0 ? currentProfitMaximumDays(dataset?.profitReadMode) : 31
  if (requestProfitReadMode(data) === 1 && !normal) return 'Для збережених регістрів 1С потрібні підтверджені відбори Fenix.'
  if (normal && data.from >= '2025-01-01') {
    const error = originalNormalPeriodError(data.from, data.to)
    if (error) return error
  } else if ((Date.parse(`${data.to}T00:00:00Z`) - Date.parse(`${data.from}T00:00:00Z`)) / 86400000 >= maximumDays)
    return `Період «Валового прибутку по постачальниках» — не більше ${maximumDays} календарних днів. Зменште період.`
  if (Object.entries(data).some(([key, value]) => forbidden.has(key.toLowerCase()) && value != null)) return invalid
  const sorted = data.sorted
  const availableMeasures = dataset?.Measurements.map(field => field.Type) ?? measures
  if (!sorted || !validProfitRows(data, requestSupplierBasis(data) === 0 ? [78, 4, 21] : [73, 78, 4, 21], 3)
    || dataset && !readReportConfiguration(dataset.configuration) && !['73,4,21', '78,4,21'].includes(sorted.Row.map(item => item.type).join(','))
    || !Array.isArray(sorted.Measurements) || sorted.Measurements.length < 1 || sorted.Measurements.length > availableMeasures.length
    || sorted.Measurements.some(item => !availableMeasures.includes(item.Type)
      || (item.IsChecked != null && typeof item.IsChecked !== 'boolean'))
    || new Set(sorted.Measurements.map(item => item.Type)).size !== sorted.Measurements.length
    || sorted.Measurements.every(item => item.IsChecked === false)) return invalid
  if (!Array.isArray(data.selections) || data.selections.length > 32) return invalid
  const filterExpression = requestFilterExpression(data)
  const logicError = reportFilterExpressionError(data, dataset)
  if (logicError) return logicError
  const advancedFilters = readFilterExpressionCapabilities(dataset) != null
  let values = 0
  const activeFields = new Set<number>()
  for (const selection of data.selections) {
    if (selection && isDatasetGroupSelection(dataset, selection)) {
      if ((selection.IsChecked != null && typeof selection.IsChecked !== 'boolean') || !filters.has(selection.SelectedField.Type)
        || !Array.isArray(selection.Values) || !selection.Values.length) return invalid
      if ([5, 7].includes(selection.FilterCondition.Type) && !advancedFilters)
        return 'Сервер не підтвердив виключення для партійного прибутку. Налаштування не змінено.'
      values += selection.Values.length
      if (selection.IsChecked !== false) {
        if (filterExpression == null && activeFields.has(selection.SelectedField.Type)) return invalid
        activeFields.add(selection.SelectedField.Type)
      }
      const groupError = datasetGroupSelectionError(dataset, selection)
      if (groupError) return groupError
      if (values > 100) return invalid
      continue
    }
    if (!selection || (selection.IsChecked != null && typeof selection.IsChecked !== 'boolean')
      || !filters.has(selection.SelectedField?.Type) || ![0, 1, 2, 4].includes(selection.FilterCondition?.Type)
      || !Array.isArray(selection.Values) || !selection.Values.length
      || ([0, 1].includes(selection.FilterCondition.Type) && selection.Values.length !== 1)) return invalid
    if ([1, 4].includes(selection.FilterCondition.Type) && !advancedFilters)
      return 'Сервер не підтвердив виключення для партійного прибутку. Налаштування не змінено.'
    values += selection.Values.length
    if (selection.IsChecked !== false) {
      if (filterExpression == null && activeFields.has(selection.SelectedField.Type)) return invalid
      activeFields.add(selection.SelectedField.Type)
    }
    if (values > 100 || selection.Values.some(value => !value || !revenueExactId(value.Data)
      || (value.Value !== undefined && (!Number.isInteger(value.Value)
        || value.Value < -2147483648 || value.Value > 2147483647)))) return invalid
  }
  return null
}
