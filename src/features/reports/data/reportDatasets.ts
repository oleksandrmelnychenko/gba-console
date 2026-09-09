import { cloneReturnComparisonAliases, defaultReturnComparison, returnComparisonConfigurationError } from './returnComparison'
import { cloneBuyerSalesShareAliases, defaultBuyerSalesShare, buyerSalesShareConfigurationError } from './buyerSalesShare'
import { cloneRevenueComparisonAliases, defaultRevenueComparison, revenueComparisonConfigurationError } from './revenueComparison'
import { cloneXyzAliases, defaultXyzOptions, salesXyzConfigurationError } from './salesXyz'
import type { ReportDataset, ReportFilterField, ReportGroupingItem, ReportMeasurementGroup, ReportMeasurementSelection, ReportRequestBody } from '../types'
import { importedPaymentsConfigurationError } from './importedPayments'
import { clientComparisonConfigurationError } from './clientPeriodComparison'
import { reportThresholdError } from './reportThreshold'
import { reportHideZeroError } from './reportHideZero'
import { createDefaultMeasurementGroups, flattenCheckedMeasurements, flattenGroupingOptions, REPORT_FILTER_CONDITIONS, REPORT_FILTER_FIELD_GROUPS } from './reportOptions'
import { createSalesReportPreset, SALES_REPORT_PRESETS, type SalesReportPresetId } from './reportPresets'
import { reportOrderingError } from './reportOrdering'
import { reportFilterExpressionError } from './reportFilterExpression'
import { ABC_CLASS_GROUPING, preserveAbcGrouping, reportAbcClassificationError } from './reportAbcClassification'
import { reportTopGroupsError } from './reportTopGroups'
import { valuationConfigurationError, VALUATION_DATA_SOURCE } from './reportValuation'
import { getNativeReportProfile, isNativeReportPresetId, type NativeReportPresetId } from './nativeReportProfiles'

export type DatasetReportPresetId = SalesReportPresetId | 'quantities-by-unit' | NativeReportPresetId
type DatasetReportPreset = { id: DatasetReportPresetId; name: string; description: string }
const QUANTITY_BY_UNIT_PRESET: DatasetReportPreset = {
  id: 'quantities-by-unit', name: 'Кількість за одиницями',
  description: 'Одиниця виміру → день. Окрема кількість для кожної одиниці виміру, без додавання різних одиниць.',
}

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

export function datasetGroupings(dataset: ReportDataset | undefined): ReportGroupingItem[] {
  return dataset?.Groupings.map(field => ({ key: GROUPING_KEYS.get(field.Type) ?? field.Name, label: field.Name, type: field.Type })) ?? []
}

export function datasetFilters(dataset: ReportDataset | undefined): Array<{ label: string; value: string; field: ReportFilterField }> {
  return dataset?.Filters.map(field => ({ label: field.Name, value: String(field.Type), field: {
    Name: FILTER_KEYS.get(field.Type) ?? field.Name, Type: field.Type,
  } })) ?? []
}

/** Captions come from the selected dataset; numeric identities remain the wire contract. */
export function datasetMeasurements(dataset: ReportDataset | undefined, selected: ReportMeasurementSelection[] = []): ReportMeasurementGroup[] {
  if (!dataset) return []
  const fields = new Map(dataset.Measurements.map(field => [field.Type, field]))
  const checked = new Set(selected.flatMap(item => ((dataset.DataSource === 13 || dataset.DataSource === 14 || dataset.DataSource === 15 || dataset.DataSource === 16 || dataset.DataSource === 17 || dataset.DataSource === 18) ? item.IsChecked !== false : item.IsChecked) ? [item.Type] : []))
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
  if (dataset.DataSource === 16 || dataset.DataSource === 17 || dataset.DataSource === 18) {
    const order = new Map<number, number>()
    for (const item of selected) if (item.IsChecked !== false && !order.has(item.Type)) order.set(item.Type, order.size)
    return groups.toSorted((a, b) => (order.get(a.SubList[0].Type) ?? selected.length) - (order.get(b.SubList[0].Type) ?? selected.length))
  }
  return groups
}

export function defaultDatasetRequest(dataset: ReportDataset, from: string, to: string): ReportRequestBody {
  const groupings = datasetGroupings(dataset).filter(field => field.type !== ABC_CLASS_GROUPING)
  const row = groupings.find(item => item.type === 3) ?? groupings[0]
  const unit = groupings.find(item => item.type === 28)
  const profile = getNativeReportProfile(dataset.DataSource)
  const available = dataset.Measurements.filter(field => field.Selectable !== false)
  const preferred = available.filter(field => profile ? profile.measurements.some(type => type === field.Type)
    : field.Type === 0 || field.Type === (dataset.DataSource === 3 ? 2 : 4))
  const fields = preferred.length ? preferred : available.slice(0, 1)
  const selected = fields.map(field => ({ ...field, IsChecked: true, parentName: '' }))
  return { dataSource: dataset.DataSource, ...(dataset.DataSource === 18 ? { returnComparison: defaultReturnComparison() } : {}), ...(dataset.DataSource === 17 ? { buyerSalesShare: defaultBuyerSalesShare() } : {}), ...(dataset.DataSource === 16 ? { revenueComparison: defaultRevenueComparison() } : {}), ...(dataset.DataSource === 15 ? { xyz: defaultXyzOptions() } : {}), ...(dataset.DataSource === 13 ? { comparison: { Version: 1, From: '', To: '' } } : {}), from: dataset.PeriodSupported === false ? '' : from,
    to: dataset.PeriodSupported === false ? '' : to, selections: [], sorted: {
    Row: (profile ? profile.rowGroupings.map(type => groupings.find(item => item.type === type)) : [unit, row])
      .filter((item, index, items): item is ReportGroupingItem => Boolean(item) && items.indexOf(item) === index),
    Col: [], Measurements: flattenCheckedMeasurements(datasetMeasurements(dataset, selected)),
  } }
}

/** Refuse incompatible saved settings before mutating the form. Never remove or remap a filter. */
export function datasetConfigurationError(data: ReportRequestBody, dataset: ReportDataset | undefined): string | null {
  if (data.dataSource === 1 || data.oneC) return 'Шаблон використовує архівне джерело 1С, яке більше не доступне. Налаштування не застосовано.'
  if (!dataset || (data.dataSource ?? 0) !== dataset.DataSource) return 'Набір даних цього звіту недоступний. Налаштування не застосовано.'
  if (dataset.PeriodSupported === false && (data.from || data.to)) {
    if (dataset.DataSource === 11) return 'Записані залишки рахунків не підтримують період або історичну дату. Шаблон із датами не застосовано; виберіть набір поточного стану заново.'
    if (dataset.DataSource === 10) return 'Поточна заборгованість не підтримує період або історичну дату. Шаблон із датами не застосовано; виберіть набір поточного стану заново.'
    return 'Поточні залишки не підтримують період або історичну дату. Шаблон із датами не застосовано; виберіть набір поточного стану заново.'
  }
  if (dataset.PeriodRequired && (!data.from || !data.to)) return 'Для цього набору даних потрібні обидві дати періоду. Налаштування не застосовано.'
  const returnError = returnComparisonConfigurationError(data, dataset)
  if (returnError) return returnError
  const buyerShareError = buyerSalesShareConfigurationError(data, dataset)
  if (buyerShareError) return buyerShareError
  const revenueError = revenueComparisonConfigurationError(data, dataset)
  if (revenueError) return revenueError
  const xyzError = salesXyzConfigurationError(data, dataset)
  if (xyzError) return xyzError
  const paymentsError = importedPaymentsConfigurationError(data)
  if (paymentsError) return paymentsError
  const comparisonError = clientComparisonConfigurationError(data, dataset)
  if (comparisonError) return comparisonError
  const valuationError = valuationConfigurationError(data)
  if (valuationError) return valuationError
  if (!data.sorted || !Array.isArray(data.sorted.Row) || !Array.isArray(data.sorted.Col) || !Array.isArray(data.sorted.Measurements) || !Array.isArray(data.selections)) {
    return 'Шаблон містить некоректні налаштування. Налаштування не застосовано.'
  }
  const groupingTypes = new Set(dataset.Groupings.map(field => field.Type))
  const measurementTypes = new Set(dataset.Measurements.map(field => field.Type))
  const filterTypes = new Set(dataset.Filters.map(field => field.Type))
  const conditionTypes = new Set(REPORT_FILTER_CONDITIONS.map(field => field.Type))
  const unsupported = [
    ...[...data.sorted.Row, ...data.sorted.Col].flatMap(item => groupingTypes.has(item.type) ? [] : [item.label || item.key || `#${item.type}`]),
    ...data.sorted.Measurements.flatMap(item => measurementTypes.has(item.Type) ? [] : [item.Name || `#${item.Type}`]),
    ...data.selections.flatMap(item => (dataset.DataSource === 15 || dataset.DataSource === 16 || dataset.DataSource === 17 || dataset.DataSource === 18) && item.IsChecked === false ? [] : (!item.IsChecked || filterTypes.has(item.SelectedField?.Type)) && conditionTypes.has(item.FilterCondition?.Type)
      ? [] : [item.SelectedField?.Name || 'Умова відбору']),
  ]
  return unsupported.length ? `Набір «${dataset.Name}» не підтримує налаштування: ${unsupported.join(', ')}. Налаштування не застосовано.` : reportAbcClassificationError(data, dataset) ?? reportOrderingError(data, dataset) ?? reportFilterExpressionError(data, dataset) ?? reportTopGroupsError(data, dataset) ?? reportThresholdError(data, dataset) ?? reportHideZeroError(data, dataset)
}

export function datasetPresets(dataset: ReportDataset | undefined): DatasetReportPreset[] {
  if (!dataset) return []
  const profile = getNativeReportProfile(dataset.DataSource)
  if (profile) {
    return profile.rowGroupings.every(type => dataset.Groupings.some(field => field.Type === type))
      && profile.measurements.every(type => dataset.Measurements.some(field => field.Type === type && field.Selectable !== false))
      ? [profile.preset] : []
  }
  if (![0, 2, 3].includes(dataset.DataSource)) return []
  const presets: DatasetReportPreset[] = []
  if ([28, 3].every(type => dataset.Groupings.some(field => field.Type === type))
    && dataset.Measurements.some(field => field.Type === 0 && field.Selectable !== false)) {
    presets.push(QUANTITY_BY_UNIT_PRESET)
  }
  if (dataset.DataSource === 3) return presets
  return [...presets, ...SALES_REPORT_PRESETS.flatMap(preset => {
    const data = createSalesReportPreset(preset.id, '', '', []).Data
    // Preset availability checks fields; the selected period is validated when applied.
    if (datasetConfigurationError({ ...data, dataSource: dataset.DataSource }, { ...dataset, PeriodRequired: false })) return []
    return [{ ...preset,
      name: dataset.DataSource === 2 ? preset.name.replace('Продажі', 'Чисті продажі') : preset.name,
      description: dataset.DataSource === 2 ? `${preset.description} Повернення віднімаються за правилами цього набору даних.` : preset.description,
    }]
  })]
}

export function datasetPresetRequest(dataset: ReportDataset, id: DatasetReportPresetId, current: ReportRequestBody) {
  const preset = datasetPresets(dataset).find(item => item.id === id)
  if (!preset) return null
  // Preserve both raw aliases, including invalid imported material, without reconstructing the tree.
  const preservedOptions = { ...cloneReturnComparisonAliases(current), ...cloneBuyerSalesShareAliases(current), ...cloneRevenueComparisonAliases(current), ...cloneXyzAliases(current), ...(Object.hasOwn(current, 'comparison') ? { comparison: structuredClone(current.comparison) } : {}),
    ...(Object.hasOwn(current, 'Comparison') ? { Comparison: structuredClone(current.Comparison) } : {}),
    ...(Object.hasOwn(current, 'hideZero') ? { hideZero: structuredClone(current.hideZero) } : {}),
    ...(Object.hasOwn(current, 'HideZero') ? { HideZero: structuredClone(current.HideZero) } : {}),
    ...(Object.hasOwn(current, 'threshold') ? { threshold: structuredClone(current.threshold) } : {}),
    ...(Object.hasOwn(current, 'Threshold') ? { Threshold: structuredClone(current.Threshold) } : {}),
    ...(Object.hasOwn(current, 'abcClassification') ? { abcClassification: structuredClone(current.abcClassification) } : {}),
    ...(Object.hasOwn(current, 'AbcClassification') ? { AbcClassification: structuredClone(current.AbcClassification) } : {}),
    ...(Object.hasOwn(current, 'topGroups') ? { topGroups: structuredClone(current.topGroups) } : {}),
    ...(Object.hasOwn(current, 'TopGroups') ? { TopGroups: structuredClone(current.TopGroups) } : {}),
    ...(Object.hasOwn(current, 'filterExpression') ? { filterExpression: structuredClone(current.filterExpression) } : {}),
    ...(Object.hasOwn(current, 'FilterExpression') ? { FilterExpression: structuredClone(current.FilterExpression) } : {}) }
  if (isNativeReportPresetId(id)) {
    const defaults = defaultDatasetRequest(dataset, current.from, current.to)
    if (dataset.DataSource === 18 && Object.keys(current).some(key => key.toLowerCase() === 'returncomparison')) delete defaults.returnComparison
    if (dataset.DataSource === 17 && Object.keys(current).some(key => key.toLowerCase() === 'buyersalesshare')) delete defaults.buyerSalesShare
    if (dataset.DataSource === 16 && Object.keys(current).some(key => key.toLowerCase() === 'revenuecomparison')) delete defaults.revenueComparison
    if (dataset.DataSource === 15 && Object.keys(current).some(key => key.toLowerCase() === 'xyz')) delete defaults.xyz
    return { Name: preset.name, Data: preserveAbcGrouping(current, { ...defaults, ...preservedOptions, selections: structuredClone(current.selections),
      ...(dataset.DataSource === VALUATION_DATA_SOURCE && current.valuationClientAgreementId != null
        ? { valuationClientAgreementId: current.valuationClientAgreementId } : {}),
    }) }
  }
  if (id === 'quantities-by-unit') {
    const data = defaultDatasetRequest(dataset, current.from, current.to)
    return { Name: preset.name, Data: preserveAbcGrouping(current, { ...data, ...preservedOptions, selections: structuredClone(current.selections), sorted: {
      ...data.sorted, Measurements: data.sorted.Measurements.filter(field => field.Type === 0),
    } }) }
  }
  const template = createSalesReportPreset(id, current.from, current.to, current.selections)
  return { ...template, Name: preset.name, Data: preserveAbcGrouping(current, { ...template.Data, ...preservedOptions, dataSource: dataset.DataSource }) }
}
