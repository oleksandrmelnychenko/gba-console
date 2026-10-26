import { currentFinancialBuyerManagerFilterError, financialBuyerManagerReference } from './currentFinancialBuyerManagerFilter'
import { currentFinancialDocumentFilterError, financialDocumentReference } from './currentFinancialDocumentFilter'
import { requestFinancialAxesCapability, validFinancialAxes } from './financialAxes'
import { currentFinancialFilterConditionsError, financialFilterConditionTypes } from './currentFinancialFilterConditions'
import { validProfitRows, readReportConfiguration } from './reportConfiguration'
import { requestProfitReadMode, profitReadModeConfigurationError, currentProfitMaximumDays } from './profitReadMode'
import { originalNormalPeriodError } from './originalNormalPeriod'
import type { ReportDataset, ReportRequestBody } from '../types'
import { revenueExactId } from './revenueComparison'
import { datasetGroupConditionTypes, datasetGroupSelectionError, isDatasetGroupSelection } from './reportHierarchyFilters'
import { dayOrganizationBasisConfigurationError, requestDayOrganizationBasis } from './dayOrganizationBasis'
import { productClassification, requestProductClassification, requestSourceOrganizations,
  requestSourceBuyerSubtree, sourceOrganizations, sourceBuyerSubtree } from './nativeExactFilters'

export const DAY_ORGANIZATION_GROSS_PROFIT_SOURCE = 35
export const DAY_ORGANIZATION_GROSS_PROFIT_TITLE = 'Валовий прибуток GBA за днем та організацією'
// Exact saved Fenix setting 0x1893a68ef4db1647a85309ae4c2ff7ce: "Товар", excluding services.
export const DAY_ORGANIZATION_GOODS_KIND_ID = '8AB2005056C0000811DEF956DA4CFDA0'
export const DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS = [
  'A98BC3FAAC5CA23811E99CCA70CA60B9',
  '8AB2005056C0000811DEF92AB3F4DFF1',
  '8AB2005056C0000811DF04FAB939A4DE',
  '94B4005056C0000811DF1A0C73BC9A12',
] as const
export const DAY_ORGANIZATION_OUT_OF_SCOPE_ORGANIZATION_IDS = ['88D1B8CB29DC7A6911ECFC60797DF65F'] as const
const legacyMeasures = [2, 3, 4, 6, 7, 8, 10, 12, 14, 15]
const measures = [2, 3, 4, 6, 7, 8, 10, 12, 14, 15, 11]
const filters = new Set([0, 1, 2, 6, 9])
const unsupported = new Set(['onec', 'comparison', 'xyz', 'revenuecomparison', 'buyersalesshare', 'returncomparison',
  'ratecomparison', 'margincomparison', 'paymentcomparison', 'pricetypesalescomparison', 'agreementpricecomparison',
  'valuationclientagreementid', 'ordering', 'filterexpression', 'topgroups', 'threshold', 'hidezero',
  'abcclassification', 'returnsonly', 'discountmarkup',
  'provideddiscounts', 'priceanalysis'])
const invalid = 'Валовий прибуток GBA підтримує підтверджені сервером групування, показники й точні відбори.'

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
    && [legacyMeasures.join(','), measures.join(',')].includes(dataset.Measurements.map(field => field.Type).join(','))
    && dataset.Filters.map(field => field.Type).join(',') === '0,1,2,6,9'
}

export function dayOrganizationGrossProfitConfigurationError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  const modeError = profitReadModeConfigurationError(data, dataset)
  if (modeError) return modeError
  const managerFilterError = currentFinancialBuyerManagerFilterError(data, dataset)
  if (managerFilterError) return managerFilterError
  const documentFilterError = currentFinancialDocumentFilterError(data, dataset)
  if (documentFilterError) return documentFilterError
  const filterError = currentFinancialFilterConditionsError(data, dataset)
  if (filterError) return filterError
  const conditions = new Set(financialFilterConditionTypes(dataset, data))
  const documentConditions = new Set(financialFilterConditionTypes(dataset, data, 12))
  const managerConditions = new Set(financialFilterConditionTypes(dataset, data, 60))
  const basisError = dayOrganizationBasisConfigurationError(data, dataset)
  if (basisError) return basisError
  if (data.dataSource !== DAY_ORGANIZATION_GROSS_PROFIT_SOURCE) return null
  if (dataset && !isDayOrganizationGrossProfitDataset(dataset))
    return 'Сервер не підтвердив набір валового прибутку GBA за днем.'
  if (!validDate(data.from) || !validDate(data.to) || data.from > data.to) return 'Оберіть один коректний період валового прибутку GBA.'
  const normal = requestProfitReadMode(data) !== 0 && requestDayOrganizationBasis(data) === 0 && requestSourceOrganizations(data) != null
    && requestSourceBuyerSubtree(data) != null && productClassification(requestProductClassification(data))?.SourceWorld === 0
  const maximumDays = requestProfitReadMode(data) === 0 ? currentProfitMaximumDays(dataset?.profitReadMode) : 31
  if (requestProfitReadMode(data) === 1 && !normal) return 'Для збережених регістрів 1С потрібні підтверджені відбори Fenix.'
  if (normal && data.from >= '2025-01-01') {
    const error = originalNormalPeriodError(data.from, data.to)
    if (error) return error
  } else if ((Date.parse(`${data.to}T00:00:00Z`) - Date.parse(`${data.from}T00:00:00Z`)) / 86400000 >= maximumDays)
    return `Період «Валового прибутку» — не більше ${maximumDays} календарних днів. Зменште період.`
  if (Object.entries(data).some(([key, value]) => unsupported.has(key.toLowerCase()) && value != null)) return invalid
  const sorted = data.sorted
  const availableMeasures = dataset?.Measurements.map(field => field.Type) ?? measures
  if (!sorted || !Array.isArray(sorted.Row) || !Array.isArray(sorted.Col) || !Array.isArray(sorted.Measurements)
    || !(requestFinancialAxesCapability(dataset, data) ? validFinancialAxes(data, dataset) : validProfitRows(data, [3, 4], 2)) || dataset && !requestFinancialAxesCapability(dataset, data) && !readReportConfiguration(dataset.configuration) && sorted.Row.map(item => item.type).join(',') !== '3,4'
    || sorted.Measurements.length < 1 || sorted.Measurements.length > availableMeasures.length
    || sorted.Measurements.some(item => !availableMeasures.includes(item.Type)
      || (item.IsChecked !== undefined && typeof item.IsChecked !== 'boolean'))
    || new Set(sorted.Measurements.map(item => item.Type)).size !== sorted.Measurements.length
    || sorted.Measurements.every(item => item.IsChecked === false)) return invalid
  if (!Array.isArray(data.selections) || data.selections.length > 32) return invalid
  let count = 0
  for (const selection of data.selections) {
    if (!Array.isArray(selection?.Values)) return invalid
    count += selection.Values.length
    const field = selection.SelectedField?.Type
    const admittedConditions = field === 60 ? managerConditions : field === 12 ? documentConditions : conditions
    if (isDatasetGroupSelection(dataset, selection)) {
      if (count > 100 || (selection.IsChecked !== undefined && typeof selection.IsChecked !== 'boolean') || !selection.Values.length
        || !datasetGroupConditionTypes(dataset, field, admittedConditions).includes(selection.FilterCondition.Type)) return invalid
      const groupError = datasetGroupSelectionError(dataset, selection)
      if (groupError) return groupError
      continue
    }
    const reference = field === 60 ? financialBuyerManagerReference : field === 12 ? financialDocumentReference : revenueExactId
    if (count > 100 || (selection.IsChecked !== undefined && typeof selection.IsChecked !== 'boolean')
      || !(filters.has(field) || field === 12 || field === 60)
      || !admittedConditions.has(selection.FilterCondition?.Type) || !selection.Values.length
      || ([0, 1].includes(selection.FilterCondition?.Type) && selection.Values.length !== 1)
      || selection.Values.some(value => !value || !reference(value.Data)
        || (value.Value !== undefined && (!Number.isInteger(value.Value)
          || value.Value < -2147483648 || value.Value > 2147483647)))) return invalid
  }
  const kind = requestProductClassification(data), organizations = requestSourceOrganizations(data), buyers = requestSourceBuyerSubtree(data)
  const basis = requestDayOrganizationBasis(data)
  const signed = basis === 1 || (basis == null && kind != null && organizations != null && buyers != null)
  if (signed && (data.from !== data.to || data.selections.some(selection => selection.IsChecked !== false)))
    return 'Продажі з поверненнями підтримують один день без додаткових локальних відборів.'
  if (signed && (!productClassification(kind) || productClassification(kind)?.IsService !== false
    || !sourceOrganizations(organizations) || !sourceBuyerSubtree(buyers)))
    return 'Для продажів з поверненнями оберіть товар без послуг, організації та групу «Покупці» Fenix.'
  if (signed && (Number(data.from.slice(0, 4)) < 2000 || Number(data.from.slice(0, 4)) > 7998))
    return 'Оберіть підтримуваний день продажів з поверненнями: 2000–7998 роки.'
  return null
}
