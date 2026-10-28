import type { ReportGroupingItem, ReportMeasurementGroup, ReportRequestBody } from '../types'
import { requestSupplierBasis } from './supplierBasis'

// Form-managed options can be deliberately cleared. Unrecognized stored fields
// remain attached to the saved draft instead of disappearing during round-trip.
const managedFields = new Set([
  'dataSource', 'from', 'to', 'sorted', 'selections', 'valuationClientAgreementId',
  'agreementPriceComparison', 'AgreementPriceComparison',
  'currentVparivanieAnalysis', 'CurrentVparivanieAnalysis',
  'currentVparivanieMovements', 'CurrentVparivanieMovements',
  'customerGroups', 'CustomerGroups', 'returnsOnly', 'ReturnsOnly', 'currentVparivanieFullScope', 'CurrentVparivanieFullScope',
  'paymentComparison', 'PaymentComparison', 'marginComparison', 'MarginComparison',
  'rateComparison', 'RateComparison', 'returnComparison', 'ReturnComparison',
  'buyerSalesShare', 'BuyerSalesShare', 'revenueComparison', 'RevenueComparison',
  'xyz', 'Xyz', 'comparison', 'Comparison', 'ordering', 'Ordering',
  'filterExpression', 'FilterExpression', 'abcClassification', 'AbcClassification',
  'hideZero', 'HideZero', 'threshold', 'Threshold', 'topGroups', 'TopGroups',
  'productClassification', 'ProductClassification', 'productServiceFilter', 'ProductServiceFilter', 'sourceOrganizations', 'SourceOrganizations',
  'sourceBuyerSubtree', 'SourceBuyerSubtree',
  'dayOrganizationBasis', 'DayOrganizationBasis', 'profitReadMode', 'ProfitReadMode',
  'supplierBasis', 'SupplierBasis', 'supplierWarehouse', 'SupplierWarehouse',
  'supplierSourceWorld', 'SupplierSourceWorld',
  'settlementPeriod', 'SettlementPeriod',
  'groupedSettlementPeriod', 'GroupedSettlementPeriod', 'settlementReadMode', 'SettlementReadMode',
  'sourceCounterpartyGroups', 'SourceCounterpartyGroups',
  'cashPeriod', 'CashPeriod', 'groupedCashPeriod', 'GroupedCashPeriod', 'cashReadMode', 'CashReadMode',
  'reportProfile', 'ReportProfile', 'workbookPresentation', 'WorkbookPresentation', 'numberPresentation', 'NumberPresentation',
  'presentationCurrency', 'PresentationCurrency',
  'priceTypeSalesComparison', 'PriceTypeSalesComparison', 'oneC', 'OneC',
  'discountMarkup', 'DiscountMarkup', 'providedDiscounts', 'ProvidedDiscounts',
  'priceAnalysis', 'PriceAnalysis',
])

/** Applying a validated saved layout keeps its captions and current grouping metadata. */
export function retainStoredGroupingLabels(stored: ReportRequestBody, dataSource: number,
  axis: 'Row' | 'Col', groups: ReportGroupingItem[]): ReportGroupingItem[] {
  if (stored.dataSource !== dataSource) return groups
  return groups.map(group => {
    const originals = stored.sorted[axis].filter(item => item.type === group.type)
    const label = originals.length === 1 ? originals[0].label : undefined
    return typeof label === 'string' && label.trim().length > 0 ? { ...group, label } : group
  })
}

type MeasurementContext = Pick<ReportRequestBody, 'dataSource' | 'supplierBasis' | 'SupplierBasis'>

function retainStoredMeasurementLabel<T extends { Type: number; Label?: string }>(
  stored: ReportRequestBody | null | undefined, current: MeasurementContext, item: T,
): T {
  if (!stored || stored.dataSource !== current.dataSource) return item
  // Null/absence and explicit 1 execute the same saved supplier calculation.
  const quantityChanged = current.dataSource === 38 && item.Type === 0
    && (requestSupplierBasis(stored) === 0) !== (requestSupplierBasis(current) === 0)
  const original = stored.sorted.Measurements.find(value => value.Type === item.Type)
  return !quantityChanged && typeof original?.Label === 'string' && original.Label.trim().length > 0
    ? { ...item, Label: original.Label } : item
}

/** Stored captions survive reconstruction; newly selected measures keep dataset defaults. */
export function retainStoredMeasurementLabels(stored: ReportRequestBody | null | undefined,
  current: MeasurementContext, groups: ReportMeasurementGroup[]): ReportMeasurementGroup[] {
  if (!stored) return groups
  return groups.map(group => {
    const SubList = group.SubList.map(item => retainStoredMeasurementLabel(stored, current, item))
    return { ...group, SubList, ...(SubList.length === 1 ? { Label: SubList[0].Label } : {}) }
  })
}

export function retainStoredTemplateFields(stored: ReportRequestBody, draft: ReportRequestBody): ReportRequestBody {
  const retained = Object.fromEntries(Object.entries(stored).filter(([key]) => !managedFields.has(key)
    && key.toLowerCase() !== 'currentvparivanieanalysis' && key.toLowerCase() !== 'currentvparivaniemovements' && key.toLowerCase() !== 'currentvparivaniefullscope' && key.toLowerCase() !== 'dayorganizationbasis' && key.toLowerCase() !== 'supplierbasis'
    && key.toLowerCase() !== 'profitreadmode' && key.toLowerCase() !== 'pricetypesalescomparison'
    && key.toLowerCase() !== 'groupedcashperiod' && key.toLowerCase() !== 'cashreadmode'
    && key.toLowerCase() !== 'groupedsettlementperiod' && key.toLowerCase() !== 'settlementreadmode'
    && key.toLowerCase() !== 'sourcecounterpartygroups'))
  const retainMeasurement = (item: ReportRequestBody['sorted']['Measurements'][number]) =>
    retainStoredMeasurementLabel(stored, draft, {
      ...stored.sorted.Measurements.find(original => original.Type === item.Type), ...item,
    })
  const retainGroups = (axis: 'Row' | 'Col') => draft.sorted[axis].map(item => ({
    ...stored.sorted[axis].find(original => original.type === item.type), ...item,
  }))
  return structuredClone({ ...retained, ...draft, sorted: {
    ...stored.sorted, ...draft.sorted, Row: retainGroups('Row'), Col: retainGroups('Col'),
    Measurements: [...draft.sorted.Measurements.map(retainMeasurement), ...stored.sorted.Measurements.filter(item => item.IsChecked === false
      && !draft.sorted.Measurements.some(current => current.Type === item.Type))],
  } })
}
