import { BUG_1274_ACTIVE_DATA_SOURCES } from '../data/reportMigration'
import { salesProductLookupCapability } from '../data/salesProductLookupCapability'
import { cloneStockQuantityFilter, stockQuantityFilterError } from '../data/stockQuantityFilter'
import { customerGroupSalesDocumentLookup } from '../data/salesDocumentLookupCapability'
import { customerGroupSelectionsError } from '../data/customerGroupSelections'
import { readDocumentDetails } from '../data/reportDocumentDetails'
import { cloneConstructorPresentation } from '../data/constructorPresentation'
import { cloneReportProfile, readSalesProfileGroupings, salesConstructorError } from '../data/salesConstructorProfiles'
import { currentFinancialBuyerManagerFilterCapability } from '../data/currentFinancialBuyerManagerFilter'
import { currentFinancialDocumentFilterCapability } from '../data/currentFinancialDocumentFilter'
import { clonePresentationCurrencyAliases, presentationCurrencySupported } from '../data/reportPresentationCurrency'
import { financialAxesCapability } from '../data/financialAxes'
import { currentFinancialAxesCapability } from '../data/currentFinancialAxes'
import { currentFinancialProductTimeAxesCapability } from '../data/currentFinancialProductTimeAxes'
import { currentFinancialDocumentAxesCapability } from '../data/currentFinancialDocumentAxes'
import { currentFinancialFilterConditionsCapability } from '../data/currentFinancialFilterConditions'
import { cloneCurrentVparivanieAnalysis } from '../data/currentVparivanieAnalysis'
import { cloneMovementSelection } from '../data/currentVparivanieMovements'
import { readReportConfiguration, reportConfigurationError } from '../data/reportConfiguration'
import { cloneNumberPresentationAliases, readValueSemantics, numberPresentationSupported, numberPresentationError } from '../data/reportNumberPresentation'
import { cloneWorkbookAliases, normalizeWorkbookDataset, workbookConfigurationError } from '../data/workbookPresentation'
import { settlementPeriodConfigurationError, isSettlementPeriodDataset } from '../data/settlementPeriod'
import { dayOrganizationGrossProfitConfigurationError } from '../data/dayOrganizationGrossProfit'
import { currentVparivanieConfigurationError, isCurrentVparivanieDataset, cloneCurrentVparivanieFullScope, withCurrentVparivanieMovementScope } from '../data/currentVparivanie'
import { cloneGroupedCashAliases, normalizeGroupedCashDataset } from '../data/groupedCashPeriod'
import { cashPeriodConfigurationError, isCashPeriodDataset } from '../data/cashPeriod'
import { supplierBatchGrossProfitConfigurationError } from '../data/supplierBatchGrossProfit'
import { apiRequest } from '../../../shared/api/apiClient'
import type { ReportDataset, ReportDatasetField, ReportRequestBody, ReportTemplate } from '../types'
import { cloneNativeExactFilterAliases, nativeExactFiltersConfigurationError, normalizeNativeExactFilterDataset } from '../data/nativeExactFilters'
import { cloneGroupedSettlementAliases, normalizeGroupedSettlementDataset } from '../data/groupedSettlementPeriod'
import { cloneSourceCounterpartyGroupAliases, normalizeSourceCounterpartyGroupDataset } from '../data/sourceCounterpartyGroups'
import { cloneSettlementReadModeAliases, normalizeSettlementReadModeDataset } from '../data/settlementReadMode'
import { cloneCashReadModeAliases, normalizeCashReadModeDataset } from '../data/cashReadMode'

function isDatasetField(value: unknown): value is ReportDatasetField {
  if (!value || typeof value !== 'object') return false
  const field = value as Partial<ReportDatasetField>
  return Number.isSafeInteger(field.Type) && field.Type! >= 0 && typeof field.Name === 'string' && field.Name.trim().length > 0
    && (field.valueSemantics === undefined || !!readValueSemantics(field.valueSemantics))
    && (field.Selectable === undefined || typeof field.Selectable === 'boolean')
}

function isDataset(value: unknown): value is ReportDataset {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<ReportDataset>
  const fieldsValid = [item.Groupings, item.Measurements, item.Filters].every(fields =>
    Array.isArray(fields) && fields.every(isDatasetField) && new Set(fields.map(field => field.Type)).size === fields.length)
  return Number.isSafeInteger(item.DataSource) && item.DataSource! >= 0 && item.DataSource !== 1 && typeof item.Name === 'string' && !!item.Name.trim()
    && !Object.hasOwn(item, 'SalesProductLookup')
    && (item.salesProductLookup === undefined || !!salesProductLookupCapability(item as ReportDataset))
    && !Object.hasOwn(item, 'SalesDocumentLookup')
    && (item.salesDocumentLookup === undefined || !!customerGroupSalesDocumentLookup(item as ReportDataset))
    && (item.documentDetails === undefined || item.DataSource === 2 && !!readDocumentDetails(item.documentDetails))
    && (item.profileGroupings === undefined || item.DataSource === 2 && !!readSalesProfileGroupings(item.profileGroupings))
    && (item.financialAxes === undefined || !!financialAxesCapability(item as ReportDataset))
    && (item.currentFinancialAxes === undefined || !!currentFinancialAxesCapability(item as ReportDataset))
    && (item.currentFinancialProductTimeAxes === undefined || !!currentFinancialProductTimeAxesCapability(item as ReportDataset))
    && (item.currentFinancialDocumentAxes === undefined || !!currentFinancialDocumentAxesCapability(item as ReportDataset))
    && (item.currentFinancialBuyerManagerFilter === undefined || !!currentFinancialBuyerManagerFilterCapability(item as ReportDataset))
    && (item.currentFinancialDocumentFilter === undefined || !!currentFinancialDocumentFilterCapability(item as ReportDataset))
    && (item.currentFinancialFilterConditions === undefined || !!currentFinancialFilterConditionsCapability(item as ReportDataset))
    && (item.configuration === undefined || !!readReportConfiguration(item.configuration))
    && (item.currentFinancialPresentationCurrency === undefined || presentationCurrencySupported(item as ReportDataset))
    && (item.numberPresentation === undefined || numberPresentationSupported(item as ReportDataset))
    && typeof item.Description === 'string' && fieldsValid && !!item.Groupings?.length && !!item.Measurements?.length
    && (item.PeriodRequired === undefined || typeof item.PeriodRequired === 'boolean')
    && (item.PeriodSupported === undefined || typeof item.PeriodSupported === 'boolean')
    && !Object.hasOwn(item, 'CurrentVparivanie')
    && (item.DataSource === 39 ? isCurrentVparivanieDataset(item as ReportDataset) : item.currentVparivanie == null)
    && !Object.hasOwn(item, 'SettlementPeriod')
    && (item.DataSource === 41 ? isSettlementPeriodDataset(item as ReportDataset) : item.settlementPeriod == null)
    && !Object.hasOwn(item, 'GroupedSettlementPeriod')
    && (item.DataSource === 41 || item.groupedSettlementPeriod == null)
    && !Object.hasOwn(item, 'SourceCounterpartyGroups')
    && (item.DataSource === 41 || item.sourceCounterpartyGroups == null)
    && !Object.hasOwn(item, 'GroupedCashPeriod')
    && (item.DataSource === 40 || item.groupedCashPeriod == null)
    && !Object.hasOwn(item, 'CashPeriod')
    && (item.DataSource === 40 ? isCashPeriodDataset(item as ReportDataset) : item.cashPeriod == null)
    && !(item.PeriodSupported === false && item.PeriodRequired === true)
    && Array.isArray(item.Limitations) && item.Limitations.every(text => typeof text === 'string')
}

function isUnofferedDataset(item: unknown): boolean {
  const source = item && typeof item === 'object' ? (item as { DataSource?: unknown }).DataSource : undefined
  return typeof source === 'number' && !BUG_1274_ACTIVE_DATA_SOURCES.has(source)
}

export async function getReportDatasets(signal?: AbortSignal): Promise<ReportDataset[]> {
  return parseReportDatasets(await apiRequest<unknown>('/report/datasets', { signal }))
}

/** Validate and normalize the same capability bytes used by the live Console. */
export function parseReportDatasets(result: unknown): ReportDataset[] {
  const normalized = Array.isArray(result) ? result.filter(item => !isUnofferedDataset(item)).map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null
    const exactFilters = normalizeNativeExactFilterDataset(normalizeCashReadModeDataset(normalizeSettlementReadModeDataset(item as Record<string, unknown>)))
    const groups = exactFilters ? normalizeGroupedSettlementDataset(exactFilters as unknown as Record<string, unknown>) : null
    const sourceGroups = groups ? normalizeSourceCounterpartyGroupDataset(groups as unknown as Record<string, unknown>) : null
    const cash = sourceGroups ? normalizeGroupedCashDataset(sourceGroups as unknown as Record<string, unknown>) : null
    return cash ? normalizeWorkbookDataset(cash as unknown as Record<string, unknown>) : null
  }) : []
  if (!normalized.length || !normalized.every((item): item is ReportDataset => item !== null && isDataset(item))
    || new Set(normalized.map(item => item.DataSource)).size !== normalized.length) {
    throw new Error('Сервер повернув некоректний список наборів даних звітів.')
  }
  return normalized
}

type WireTemplate = Required<Omit<ReportTemplate, 'Data'>> & {
  Data: {
    workbookPresentation?: unknown
    WorkbookPresentation?: unknown
    stockQuantityFilter?: unknown
    StockQuantityFilter?: unknown
    constructorPresentation?: unknown
    ConstructorPresentation?: unknown
    reportProfile?: unknown
    ReportProfile?: unknown
    From: string | null
    To: string | null
    Sorted: ReportRequestBody['sorted']
    Selections: ReportRequestBody['selections']
    DataSource: ReportRequestBody['dataSource']
    CurrentVparivanieFullScope?: unknown
    currentVparivanieFullScope?: unknown
    CustomerGroups?: import('../data/customerGroups').CustomerGroups
    nativePriceComparison?: ReportRequestBody['nativePriceComparison']
    NativePriceComparison?: ReportRequestBody['nativePriceComparison']
    customerGroups?: import('../data/customerGroups').CustomerGroups
    ReturnsOnly?: boolean
    returnsOnly?: boolean
    SettlementPeriod?: unknown
    settlementPeriod?: unknown
    GroupedSettlementPeriod?: unknown
    groupedSettlementPeriod?: unknown
    SettlementReadMode?: unknown
    settlementReadMode?: unknown
    CashReadMode?: unknown
    cashReadMode?: unknown
    SourceCounterpartyGroups?: unknown
    sourceCounterpartyGroups?: unknown
    CashPeriod?: unknown
    groupedCashPeriod?: unknown
    GroupedCashPeriod?: unknown
    cashPeriod?: unknown
    Ordering?: unknown
    FilterExpression?: unknown
    HideZero?: unknown
    hideZero?: unknown
    Threshold?: unknown
    threshold?: unknown
    AbcClassification?: unknown
    abcClassification?: unknown
    TopGroups?: unknown
    topGroups?: unknown
    ProductClassification?: unknown
    productClassification?: unknown
    SourceOrganizations?: unknown
    sourceOrganizations?: unknown
    SourceBuyerSubtree?: unknown
    ProfitReadMode?: unknown
    profitReadMode?: unknown
    DayOrganizationBasis?: unknown
    dayOrganizationBasis?: unknown
    sourceBuyerSubtree?: unknown
    SupplierSourceWorld?: unknown
    SupplierBasis?: unknown
    supplierBasis?: unknown
    supplierSourceWorld?: unknown
    OneC?: ReportRequestBody['oneC']
    oneC?: ReportRequestBody['oneC']
  }
}

// Known native saved-DTO measurement aliases are canonicalized; ambiguous fields stay rejectable.
function normalizeNativeMeasurements(sorted: ReportRequestBody['sorted']): ReportRequestBody['sorted'] {
  const result = structuredClone(sorted)
  if (!Array.isArray(result.Measurements)) return result
  result.Measurements = result.Measurements.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item
    const entries = Object.entries(item)
    const parentNames = entries.filter(([key]) => key.toLowerCase() === 'parentname')
    return parentNames.length === 1 && parentNames[0][0] === 'ParentName'
      ? Object.fromEntries(entries.map(([key, value]) => [key === 'ParentName' ? 'parentName' : key, value])) as typeof item
      : item
  })
  return result
}

// The .NET DTO uses PascalCase at the top level; grouping/selection contracts already match.
export function normalizeSavedTemplate(value: WireTemplate): ReportTemplate {
  if (!value?.Id || !Number.isInteger(value.Revision) || value.Revision < 1 || !value.Data?.Sorted) {
    throw new Error('Сервер повернув некоректний шаблон звіту.')
  }
  return { ...value, Data: withCurrentVparivanieMovementScope({
    from: value.Data.From ?? '', to: value.Data.To ?? '',
    sorted: (value.Data.DataSource === 39 || value.Data.DataSource === 41) ? normalizeNativeMeasurements(value.Data.Sorted) : value.Data.Sorted,
    selections: value.Data.Selections ?? [],
    dataSource: value.Data.DataSource,
    ...cloneCurrentVparivanieFullScope(value.Data),
    ...cloneMovementSelection(value.Data),
    ...cloneCurrentVparivanieAnalysis(value.Data),
    ...(value.Data.NativePriceComparison || value.Data.nativePriceComparison ? {nativePriceComparison: structuredClone(value.Data.nativePriceComparison ?? value.Data.NativePriceComparison)} : {}),
    ...(value.Data.CustomerGroups || value.Data.customerGroups ? {customerGroups: structuredClone(value.Data.customerGroups ?? value.Data.CustomerGroups)} : {}),
    ...(Object.hasOwn(value.Data, 'returnsOnly') ? { returnsOnly: value.Data.returnsOnly }
      : Object.hasOwn(value.Data, 'ReturnsOnly') ? { returnsOnly: value.Data.ReturnsOnly } : {}),
    ...(Object.hasOwn(value.Data, 'settlementPeriod') ? { settlementPeriod: structuredClone(value.Data.settlementPeriod),
      ...(Object.hasOwn(value.Data, 'SettlementPeriod') ? { SettlementPeriod: structuredClone(value.Data.SettlementPeriod) } : {}),
    } : Object.hasOwn(value.Data, 'SettlementPeriod') ? { settlementPeriod: structuredClone(value.Data.SettlementPeriod) } : {}),
    ...cloneGroupedSettlementAliases(value.Data),
    ...cloneSettlementReadModeAliases(value.Data),
    ...cloneSourceCounterpartyGroupAliases(value.Data),
    ...cloneGroupedCashAliases(value.Data),
    ...cloneCashReadModeAliases(value.Data),
    ...cloneStockQuantityFilter(value.Data), ...cloneConstructorPresentation(value.Data), ...cloneReportProfile(value.Data),
    ...cloneWorkbookAliases(value.Data),
    ...cloneNumberPresentationAliases(value.Data),
    ...clonePresentationCurrencyAliases(value.Data),
    ...(Object.hasOwn(value.Data, 'cashPeriod') ? { cashPeriod: value.Data.cashPeriod,
      ...(Object.hasOwn(value.Data, 'CashPeriod') ? { CashPeriod: value.Data.CashPeriod } : {}),
    } : Object.hasOwn(value.Data, 'CashPeriod') ? { cashPeriod: value.Data.CashPeriod } : {}),
    ...cloneNativeExactFilterAliases(value.Data),
    ...(Object.hasOwn(value.Data, 'supplierSourceWorld') ? { supplierSourceWorld: value.Data.supplierSourceWorld,
      ...(Object.hasOwn(value.Data, 'SupplierSourceWorld') ? { SupplierSourceWorld: value.Data.SupplierSourceWorld } : {}),
    } : Object.hasOwn(value.Data, 'SupplierSourceWorld') ? { supplierSourceWorld: value.Data.SupplierSourceWorld } : {}),
    ...(Object.hasOwn(value.Data, 'Ordering') ? { ordering: value.Data.Ordering } : {}),
    ...(Object.hasOwn(value.Data, 'FilterExpression') ? { filterExpression: value.Data.FilterExpression } : {}),
    ...(Object.hasOwn(value.Data, 'hideZero') ? { hideZero: value.Data.hideZero,
      ...(Object.hasOwn(value.Data, 'HideZero') ? { HideZero: value.Data.HideZero } : {}),
    } : Object.hasOwn(value.Data, 'HideZero') ? { hideZero: value.Data.HideZero } : {}),
    ...(Object.hasOwn(value.Data, 'threshold') ? { threshold: value.Data.threshold,
      ...(Object.hasOwn(value.Data, 'Threshold') ? { Threshold: value.Data.Threshold } : {}),
    } : Object.hasOwn(value.Data, 'Threshold') ? { threshold: value.Data.Threshold } : {}),
    ...(Object.hasOwn(value.Data, 'abcClassification') ? { abcClassification: value.Data.abcClassification,
      ...(Object.hasOwn(value.Data, 'AbcClassification') ? { AbcClassification: value.Data.AbcClassification } : {}),
    } : Object.hasOwn(value.Data, 'AbcClassification') ? { abcClassification: value.Data.AbcClassification } : {}),
    ...(Object.hasOwn(value.Data, 'topGroups') ? { topGroups: value.Data.topGroups,
      ...(Object.hasOwn(value.Data, 'TopGroups') ? { TopGroups: value.Data.TopGroups } : {}),
    } : Object.hasOwn(value.Data, 'TopGroups') ? { topGroups: value.Data.TopGroups } : {}),
    ...((value.Data.OneC ?? value.Data.oneC) ? { oneC: value.Data.OneC ?? value.Data.oneC } : {}),
  }) }
}

export async function getServerReportTemplates(signal?: AbortSignal): Promise<ReportTemplate[]> {
  const result = await apiRequest<WireTemplate[]>('/report/templates', { signal, cache: 'no-store', dedupe: false })
  if (!Array.isArray(result)) throw new Error('Сервер повернув некоректний список шаблонів.')
  return result.filter(item => BUG_1274_ACTIVE_DATA_SOURCES.has(item?.Data?.DataSource as number)).map(normalizeSavedTemplate)
}

export async function saveServerReportTemplate(template: ReportTemplate, signal?: AbortSignal, dataset?: ReportDataset): Promise<ReportTemplate> {
  const request = (template.Data.dataSource === 2 || template.Data.dataSource === 44 || template.Data.dataSource === 35 || template.Data.dataSource === 39 || template.Data.dataSource === 40 || template.Data.dataSource === 41) ? structuredClone(template) : template
  request.Data = withCurrentVparivanieMovementScope(request.Data)
  const numericError = salesConstructorError(request.Data) ?? numberPresentationError(request.Data) ?? reportConfigurationError(request.Data, request.Data.dataSource === 35 ? dataset : undefined)
  if (numericError) throw new Error(numericError)
  const stockError = stockQuantityFilterError(request.Data, dataset)
  if (stockError) throw new Error(stockError)
  const customerSelectionsError = customerGroupSelectionsError(request.Data.dataSource, request.Data.selections, dataset)
  if (customerSelectionsError) throw new Error(customerSelectionsError)
  const workbookError = workbookConfigurationError(request.Data)
  if (workbookError) throw new Error(workbookError)
  const exactFilterError = nativeExactFiltersConfigurationError(request.Data)
  if (exactFilterError) throw new Error(exactFilterError)
  const dayOrganizationProfitError = dayOrganizationGrossProfitConfigurationError(request.Data, dataset)
  if (dayOrganizationProfitError) throw new Error(dayOrganizationProfitError)
  const currentVparivanieError = currentVparivanieConfigurationError(request.Data, undefined, 'workspace')
  if (currentVparivanieError) throw new Error(currentVparivanieError)
  const settlementPeriodError = settlementPeriodConfigurationError(request.Data)
  if (settlementPeriodError) throw new Error(settlementPeriodError)
  const cashPeriodError = cashPeriodConfigurationError(request.Data)
  if (cashPeriodError) throw new Error(cashPeriodError)
  const supplierBatchProfitError = supplierBatchGrossProfitConfigurationError(request.Data)
  if (supplierBatchProfitError) throw new Error(supplierBatchProfitError)
  const result = await apiRequest<WireTemplate>('/report/templates/save', {
    method: 'POST', body: { Id: request.Id, Revision: request.Revision ?? 0, Name: request.Name, Data: request.Data },
    ...(signal ? { signal } : {}),
  })
  return normalizeSavedTemplate(result)
}

export function deleteServerReportTemplate(template: ReportTemplate, signal?: AbortSignal): Promise<unknown> {
  return apiRequest('/report/templates/delete', {
    method: 'POST', body: { Id: template.Id, Revision: template.Revision },
    ...(signal ? { signal } : {}),
  })
}
