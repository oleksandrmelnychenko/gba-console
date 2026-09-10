import type { ReportRequestBody } from '../types'

// Form-managed options can be deliberately cleared. Unrecognized stored fields
// remain attached to the saved draft instead of disappearing during round-trip.
const managedFields = new Set([
  'dataSource', 'from', 'to', 'sorted', 'selections', 'valuationClientAgreementId',
  'paymentComparison', 'PaymentComparison', 'marginComparison', 'MarginComparison',
  'rateComparison', 'RateComparison', 'returnComparison', 'ReturnComparison',
  'buyerSalesShare', 'BuyerSalesShare', 'revenueComparison', 'RevenueComparison',
  'xyz', 'Xyz', 'comparison', 'Comparison', 'ordering', 'Ordering',
  'filterExpression', 'FilterExpression', 'abcClassification', 'AbcClassification',
  'hideZero', 'HideZero', 'threshold', 'Threshold', 'topGroups', 'TopGroups',
])

export function retainStoredTemplateFields(stored: ReportRequestBody, draft: ReportRequestBody): ReportRequestBody {
  const retained = Object.fromEntries(Object.entries(stored).filter(([key]) => !managedFields.has(key)))
  const retainGroups = (axis: 'Row' | 'Col') => draft.sorted[axis].map(item => ({
    ...stored.sorted[axis].find(original => original.type === item.type), ...item,
  }))
  return structuredClone({ ...retained, ...draft, sorted: {
    ...stored.sorted, ...draft.sorted, Row: retainGroups('Row'), Col: retainGroups('Col'),
    Measurements: [...draft.sorted.Measurements.map(item => ({
      ...stored.sorted.Measurements.find(original => original.Type === item.Type), ...item,
    })), ...stored.sorted.Measurements.filter(item => item.IsChecked === false
      && !draft.sorted.Measurements.some(current => current.Type === item.Type))],
  } })
}
