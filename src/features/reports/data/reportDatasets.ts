
import { requestReportProfile, salesConstructorDataset, salesConstructorError } from './salesConstructorProfiles'
import { retainMeasurementOrder } from './reportConstructorTree'
import { SALES_BY_RESPONSIBLES_COLUMNS, SALES_BY_RESPONSIBLES_MEASURES, SALES_BY_RESPONSIBLES_ROWS, SALES_BY_RESPONSIBLES_SOURCE } from './salesByResponsibles'
import { currentFinancialBuyerManagerFilterCapability, currentFinancialBuyerManagerFilterSupported } from './currentFinancialBuyerManagerFilter'
import { isDatasetGroupSelection } from './reportHierarchyFilters'
import { currentFinancialDocumentFilterCapability, currentFinancialDocumentFilterSupported } from './currentFinancialDocumentFilter'
import { currentFinancialAxesCapability, usesCurrentFinancialAxes } from './currentFinancialAxes'
import { currentFinancialProductTimeAxesCapability } from './currentFinancialProductTimeAxes'
import { currentFinancialDocumentAxesCapability } from './currentFinancialDocumentAxes'
import { currentVparivanieAnalysisCapability, requestCurrentVparivanieAnalysis } from './currentVparivanieAnalysis'
import { reportConfigurationError } from './reportConfiguration'
import { numberPresentationError } from './reportNumberPresentation'
import { workbookConfigurationError } from './workbookPresentation'
import { dayOrganizationGrossProfitConfigurationError } from './dayOrganizationGrossProfit'
import { currentVparivanieConfigurationError, currentVparivanieManagerSupported } from './currentVparivanie'
import { isSupplierSourceWorldCapability, supplierBatchGrossProfitConfigurationError } from './supplierBatchGrossProfit'
import type { ReportDataset, ReportFilterField, ReportGroupingItem, ReportMeasurementGroup, ReportMeasurementSelection, ReportRequestBody } from '../types'
import { reportThresholdError } from './reportThreshold'
import { reportHideZeroError } from './reportHideZero'
import { createDefaultMeasurementGroups, flattenCheckedMeasurements, flattenGroupingOptions, REPORT_FILTER_CONDITIONS, REPORT_FILTER_FIELD_GROUPS } from './reportOptions'
import { reportOrderingError } from './reportOrdering'
import { reportFilterExpressionError } from './reportFilterExpression'
import { ABC_CLASS_GROUPING, reportAbcClassificationError } from './reportAbcClassification'
import { reportTopGroupsError } from './reportTopGroups'
import { getNativeReportProfile, optionalProfileMeasures } from './nativeReportProfiles'
import { defaultGroupedCashPeriod, groupedCashSupported, withDefaultCashReadMode } from './groupedCashPeriod'
import { cashPeriodConfigurationError } from './cashPeriod'
import { settlementPeriodConfigurationError } from './settlementPeriod'
import { isDayOrganizationBasisCapability } from './dayOrganizationBasis'
import { isSupplierBasisCapability } from './supplierBasis'
import { nativeExactFiltersConfigurationError } from './nativeExactFilters'
import { defaultGroupedSettlementBuyer, defaultGroupedSettlementPeriod,
  isGroupedSettlementDataset, withDefaultSettlementReadMode } from './groupedSettlementPeriod'
import { isProfitReadModeCapability, withDefaultProfitReadMode } from './profitReadMode'

const GROUPING_KEYS = new Map(flattenGroupingOptions().map(item => [item.type, item.key]))
GROUPING_KEYS.set(24, 'PurchaseDocument')
GROUPING_KEYS.set(25, 'SupplierContract')
// Preserve the already published price identities. Quantity units use 28.
GROUPING_KEYS.set(26, 'SalesUnitGrossPrice')
GROUPING_KEYS.set(27, 'CostUnitGrossPrice')
GROUPING_KEYS.set(29, 'Warehouse')
GROUPING_KEYS.set(30, 'StockStorageNumber')
GROUPING_KEYS.set(31, 'StockRowNumber')
GROUPING_KEYS.set(32, 'StockCellNumber')
GROUPING_KEYS.set(33, 'StockConsignmentItem')
GROUPING_KEYS.set(34, 'StockOrganization')
GROUPING_KEYS.set(35, 'SupplierReturnDocument')
GROUPING_KEYS.set(36, 'DebtCurrency')
GROUPING_KEYS.set(37, 'DebtDocument')
GROUPING_KEYS.set(38, 'SupplierReturnMode')
GROUPING_KEYS.set(39, 'DocumentOrganization')
GROUPING_KEYS.set(40, 'PaymentRegister')
GROUPING_KEYS.set(41, 'PaymentCurrency')
GROUPING_KEYS.set(42, 'PaymentBalanceRecord')
GROUPING_KEYS.set(43, 'PaymentOrganization')
GROUPING_KEYS.set(44, 'PaymentRegisterKind')
GROUPING_KEYS.set(45, 'PaymentRegisterPurpose')
GROUPING_KEYS.set(46, 'AbcClass')
GROUPING_KEYS.set(47, 'ImportedPaymentRecord')
GROUPING_KEYS.set(48, 'ImportedPaymentDirection')
GROUPING_KEYS.set(49, 'ImportedPaymentArticle')
GROUPING_KEYS.set(50, 'PaymentImportWorld')
GROUPING_KEYS.set(51, 'XyzClass')
GROUPING_KEYS.set(73, 'SourceReceiptStorage')
GROUPING_KEYS.set(78, 'SourceRegistrarWarehouse')
GROUPING_KEYS.set(74, 'CurrentVparivanieGroup')
GROUPING_KEYS.set(75, 'CurrentVparivanieCounterparty')
GROUPING_KEYS.set(76, 'SettlementCounterparty')
GROUPING_KEYS.set(77, 'SettlementAgreement')
GROUPING_KEYS.set(81, 'CurrentFinancialDocument')

const FILTER_KEYS = new Map(REPORT_FILTER_FIELD_GROUPS.flatMap(group => group.children.map(item => [item.type, item.label] as const)))
FILTER_KEYS.set(1, 'Product')
FILTER_KEYS.set(10, 'CustomerManager')
FILTER_KEYS.set(12, 'SaleDocument')
FILTER_KEYS.set(17, 'Supplier')
FILTER_KEYS.set(18, 'SupplierContract')
FILTER_KEYS.set(19, 'PurchaseDocument')
FILTER_KEYS.set(21, 'Warehouse')
FILTER_KEYS.set(22, 'StockConsignmentItem')
FILTER_KEYS.set(23, 'StockOrganization')
FILTER_KEYS.set(24, 'SupplierReturnDocument')
FILTER_KEYS.set(25, 'DebtCurrency')
FILTER_KEYS.set(26, 'DebtDocument')
FILTER_KEYS.set(27, 'SupplierReturnMode')
FILTER_KEYS.set(28, 'DocumentOrganization')
FILTER_KEYS.set(29, 'PaymentRegister')
FILTER_KEYS.set(30, 'PaymentCurrency')
FILTER_KEYS.set(31, 'PaymentBalanceRecord')
FILTER_KEYS.set(32, 'PaymentOrganization')
FILTER_KEYS.set(33, 'PaymentRegisterKind')
FILTER_KEYS.set(34, 'PaymentRegisterPurpose')
FILTER_KEYS.set(35, 'ImportedPaymentRecord')
FILTER_KEYS.set(36, 'ImportedPaymentDirection')
FILTER_KEYS.set(37, 'ImportedPaymentArticle')
FILTER_KEYS.set(38, 'PaymentImportWorld')
FILTER_KEYS.set(45, 'OneCDiscountAgreement')
FILTER_KEYS.set(51, 'OneCPriceComparisonProduct')
FILTER_KEYS.set(52, 'OneCPriceComparisonClient')
FILTER_KEYS.set(53, 'OneCPriceComparisonProject')
FILTER_KEYS.set(54, 'OneCPriceComparisonDivision')
FILTER_KEYS.set(60, 'SourceBuyerManager')
FILTER_KEYS.set(61, 'SourceBuyerRegionCode')

export function datasetGroupings(dataset: ReportDataset | undefined, data?: object): ReportGroupingItem[] {
  const analysis = currentVparivanieAnalysisCapability(dataset)
  if (analysis) return analysis.groupings.map(field => ({ key: GROUPING_KEYS.get(field.type) ?? field.name, label: field.name, type: field.type }))
  const current = data && usesCurrentFinancialAxes(data) ? currentFinancialProductTimeAxesCapability(dataset) ?? currentFinancialAxesCapability(dataset) : undefined
  const document = data && usesCurrentFinancialAxes(data) ? currentFinancialDocumentAxesCapability(dataset) : undefined
  const profiled = data ? salesConstructorDataset(dataset, requestReportProfile(data)) : dataset
  const fields = new Map([...(profiled?.Groupings ?? []), ...(current?.groupings ?? []), ...(document?.groupings ?? [])].map(field => [field.Type, field]))
  return [...fields.values()].map(field => ({ key: GROUPING_KEYS.get(field.Type) ?? field.Name, label: field.Name, type: field.Type }))
}

export function datasetFilters(dataset: ReportDataset | undefined, data?: object): Array<{ label: string; value: string; field: ReportFilterField }> {
  const document = currentFinancialDocumentFilterSupported(dataset, data) ? currentFinancialDocumentFilterCapability(dataset)!.field : undefined
  const manager = currentFinancialBuyerManagerFilterSupported(dataset, data) ? currentFinancialBuyerManagerFilterCapability(dataset)!.field : undefined
  return [...(dataset?.Filters ?? []), ...(document ? [document] : []), ...(manager ? [manager] : [])]
    .filter(field => dataset?.DataSource !== 44 || field.Type !== 11)
    .filter(field => dataset?.DataSource !== 39 || field.Type !== 60 || currentVparivanieManagerSupported(dataset)).map(field => ({ label: field.Name, value: String(field.Type), field: {
    Name: FILTER_KEYS.get(field.Type) ?? field.Name, Type: field.Type,
  } }))
}

/** Captions come from the selected dataset; numeric identities remain the wire contract. */
export function datasetMeasurements(dataset: ReportDataset | undefined, selected: ReportMeasurementSelection[] = []): ReportMeasurementGroup[] {
  if (!dataset) return []
  const fields = new Map(dataset.Measurements.map(field => [field.Type, field]))
  const checked = new Set(selected.flatMap(item => item.IsChecked ? [item.Type] : []))
  const known = new Set<number>()
  const groups = createDefaultMeasurementGroups().flatMap(group => {
    const SubList = group.SubList.flatMap(item => {
      const field = fields.get(item.Type)
      if (!field || (field.Selectable === false && !checked.has(item.Type))) return []
      known.add(item.Type)
      return [{ ...item, Label: field.Name, IsChecked: checked.has(item.Type) }]
    })
    if (!SubList.length) return []
    // Purchase/net datasets may reuse measure codes with different meanings.
    const Label = dataset.DataSource === 0 ? undefined : SubList.length === 1 ? SubList[0].Label
      : dataset.DataSource === 2 && group.Name === 'SalesValue' ? 'Продажі з урахуванням повернень' : undefined
    return [{ ...group, Label, SubList, IsChecked: SubList.every(item => item.IsChecked) }]
  })
  for (const field of dataset.Measurements) {
    if (known.has(field.Type) || (field.Selectable === false && !checked.has(field.Type))) continue
    groups.push({ Name: field.Name, Label: field.Name, IsChecked: checked.has(field.Type),
      SubList: [{ Name: field.Name, Label: field.Name, Type: field.Type, IsChecked: checked.has(field.Type) }] })
  }
  return retainMeasurementOrder(groups, selected)
}

export function defaultDatasetRequest(dataset: ReportDataset, from: string, to: string): ReportRequestBody {
  const groupings = datasetGroupings(dataset).filter(field => field.type !== ABC_CLASS_GROUPING)
  const row = groupings.find(item => item.type === 3) ?? groupings[0]
  const unit = groupings.find(item => item.type === 28)
  const profile = getNativeReportProfile(dataset.DataSource)
  const available = dataset.Measurements.filter(field => field.Selectable !== false)
  const salesByResponsibles = dataset.DataSource === SALES_BY_RESPONSIBLES_SOURCE
  const preferred = available.filter(field => salesByResponsibles ? SALES_BY_RESPONSIBLES_MEASURES.includes(field.Type)
    : profile ? profile.measurements.some(type => type === field.Type) || optionalProfileMeasures(dataset.DataSource).includes(field.Type)
    : field.Type === 0 || field.Type === (dataset.DataSource === 3 ? 2 : 4))
  const fields = preferred.length ? preferred : available.slice(0, 1)
  const selected = fields.map(field => ({ ...field, IsChecked: true, parentName: '' }))
  const supplierOperational = dataset.DataSource === 38 && isSupplierBasisCapability(dataset.supplierBasis)
    && groupings.some(field => field.type === 78)
  const supplierCurrent = supplierOperational && isProfitReadModeCapability(dataset.profitReadMode)
  const groupedSettlement = isGroupedSettlementDataset(dataset)
  const profileRows = groupedSettlement ? [4, 41, 76] : supplierOperational ? [78, 4, 21]
    : salesByResponsibles ? SALES_BY_RESPONSIBLES_ROWS : profile?.rowGroupings
  const request: ReportRequestBody = { dataSource: dataset.DataSource, ...(groupedCashSupported(dataset) ? { groupedCashPeriod: defaultGroupedCashPeriod() } : {}), ...(groupedSettlement ? { groupedSettlementPeriod: defaultGroupedSettlementPeriod(), sourceBuyerSubtree: defaultGroupedSettlementBuyer() } : {}), ...(supplierOperational ? { supplierBasis: 0 } : {}), ...(dataset.DataSource === 35 && isDayOrganizationBasisCapability(dataset.dayOrganizationBasis) ? { dayOrganizationBasis: 0 } : {}), ...(dataset.DataSource === 38 && isSupplierSourceWorldCapability(dataset.supplierSourceWorld) && !supplierCurrent ? { supplierSourceWorld: 0 } : {}), from: dataset.PeriodSupported === false ? '' : from,
    to: dataset.PeriodSupported === false ? '' : to, selections: [], sorted: {
    Row: (profileRows ? profileRows.map(type => groupings.find(item => item.type === type)) : [unit, row])
      .filter((item, index, items): item is ReportGroupingItem => Boolean(item) && items.indexOf(item) === index),
    Col: dataset.DataSource === 39 ? groupings.filter(item => item.type === 74 || item.type === 75)
      : salesByResponsibles ? SALES_BY_RESPONSIBLES_COLUMNS.flatMap(type => groupings.filter(item => item.type === type)) : [],
    Measurements: flattenCheckedMeasurements(datasetMeasurements(dataset, selected)),
  } }
  return withDefaultReadModes(request, dataset)
}

export function withDefaultReadModes(data: ReportRequestBody, dataset?: ReportDataset): ReportRequestBody {
  return withDefaultCashReadMode(withDefaultSettlementReadMode(withDefaultProfitReadMode(data, dataset), dataset), dataset)
}

/** Refuse incompatible saved settings before mutating the form. Never remove or remap a filter. */
export function datasetConfigurationError(data: ReportRequestBody, dataset: ReportDataset | undefined, purpose: 'current' | 'workspace' = 'current'): string | null {
  const metadataError = salesConstructorError(data, dataset) ?? numberPresentationError(data, dataset) ?? reportConfigurationError(data, dataset)
  if (metadataError) return metadataError
  if (data.dataSource !== 38 && (data.supplierSourceWorld !== undefined || data.SupplierSourceWorld !== undefined))
    return 'Вибір бази Fenix або AMG доступний лише для партійного прибутку за постачальниками.'
  if (data.returnsOnly !== undefined || data.ReturnsOnly !== undefined) {
    const active = data.returnsOnly ?? data.ReturnsOnly
    if (active !== true || data.dataSource !== 2 || dataset?.returnsOnly !== true
      || data.sorted?.Row?.map(item => item.type).join(',') !== '12,5,3'
      || data.sorted.Col.length !== 0
      || data.sorted.Measurements.filter(item => item.IsChecked !== false).map(item => item.Type).join(',') !== '0'
      || data.sorted.Measurements.length !== 1
      || data.selections.some(selection => selection.IsChecked !== false && (dataset?.customerReturnFilters !== true || ![6, 1, 2, 21, 64].includes(selection.SelectedField.Type)))
      || data.filterExpression != null || data.ordering != null || data.topGroups != null
      || data.threshold != null || data.hideZero != null || data.abcClassification != null
      || data.productClassification != null || data.sourceOrganizations != null || data.sourceBuyerSubtree != null)
      return 'Режим лише повернень підтримує тільки клієнта, товар, день і кількість з відборами клієнта, товару, складу та причини без додаткових перетворень.'
  }
  if (data.dataSource === 1 || data.oneC) return 'Шаблон використовує архівне джерело 1С, яке більше не доступне. Налаштування не застосовано.'
  if (!dataset || (data.dataSource ?? 0) !== dataset.DataSource) return 'Набір даних цього звіту недоступний. Налаштування не застосовано.'
  if (dataset.PeriodSupported === false && (data.from || data.to)) {
    return 'Поточні залишки не підтримують період або історичну дату. Шаблон із датами не застосовано; виберіть набір поточного стану заново.'
  }
  if (dataset.PeriodRequired && (!data.from || !data.to)) return 'Для цього набору даних потрібні обидві дати періоду. Налаштування не застосовано.'
  const workbookError = workbookConfigurationError(data, dataset)
  if (workbookError) return workbookError
  const settlementPeriodError = settlementPeriodConfigurationError(data, dataset)
  if (settlementPeriodError) return settlementPeriodError
  if (data.dataSource === 41) return null
  const cashPeriodError = cashPeriodConfigurationError(data, dataset)
  if (cashPeriodError) return cashPeriodError
  const dayOrganizationProfitError = dayOrganizationGrossProfitConfigurationError(data, dataset)
  if (dayOrganizationProfitError) return dayOrganizationProfitError
  const currentVparivanieError = currentVparivanieConfigurationError(data, dataset, purpose)
  if (currentVparivanieError) return currentVparivanieError
  const supplierBatchProfitError = supplierBatchGrossProfitConfigurationError(data, dataset)
  if (supplierBatchProfitError) return supplierBatchProfitError
  const exactFilterError = nativeExactFiltersConfigurationError(data, dataset)
  if (exactFilterError) return exactFilterError
  if (!data.sorted || !Array.isArray(data.sorted.Row) || !Array.isArray(data.sorted.Col) || !Array.isArray(data.sorted.Measurements) || !Array.isArray(data.selections)) {
    return 'Шаблон містить некоректні налаштування. Налаштування не застосовано.'
  }
  const analysis = requestCurrentVparivanieAnalysis(data) ? currentVparivanieAnalysisCapability(dataset) : undefined
  const groupingTypes = new Set(analysis ? analysis.groupings.map(field => field.type) : datasetGroupings(dataset, data).map(field => field.type))
  const measurementTypes = new Set(dataset.Measurements.map(field => field.Type))
  const filterTypes = new Set(analysis ? analysis.filters.map(field => field.type) : datasetFilters(dataset, data).map(item => item.field.Type))
  const conditionTypes = new Set([...REPORT_FILTER_CONDITIONS.map(field => field.Type), ...(dataset.DataSource === 39 ? requestCurrentVparivanieAnalysis(data) ? currentVparivanieAnalysisCapability(dataset)?.filters.flatMap(f => f.conditions) ?? [] : [6] : [])])
  const unsupported = [
    ...[...data.sorted.Row, ...data.sorted.Col].flatMap(item => groupingTypes.has(item.type) ? [] : [item.label || item.key || `#${item.type}`]),
    ...data.sorted.Measurements.flatMap(item => measurementTypes.has(item.Type) ? [] : [item.Name || `#${item.Type}`]),
    ...data.selections.flatMap(item => (!item.IsChecked || filterTypes.has(item.SelectedField?.Type)) && (conditionTypes.has(item.FilterCondition?.Type) || isDatasetGroupSelection(dataset, item))
      ? [] : [item.SelectedField?.Name || 'Умова відбору']),
  ]
  return unsupported.length ? `Набір «${dataset.Name}» не підтримує налаштування: ${unsupported.join(', ')}. Налаштування не застосовано.` : reportAbcClassificationError(data, dataset) ?? reportOrderingError(data, dataset) ?? reportFilterExpressionError(data, dataset) ?? reportTopGroupsError(data, dataset) ?? reportThresholdError(data, dataset) ?? reportHideZeroError(data, dataset)
}
