import type { NativeReportPreview } from './nativeReportPreview'
import type { SalesConstructorProfile } from './salesConstructorProfiles'

/** Explanations belong to the displayed result's exact source and typed measure, never captions or draft settings. */
export function reportQuantityExplanations(preview: NativeReportPreview, profile?: SalesConstructorProfile): Map<number, string> {
  const result = new Map<number, string>()
  for (const field of preview.valueSemantics ?? []) {
    if (field.semantics.kind !== 'quantity') continue
    if (preview.Request?.DataSource === 'NativeSalesNet' && (profile === 'sales' || profile === 'grossProfit') && field.measureType === 0)
      result.set(field.columnSourceIndex, 'Кількість не підтверджена для вибраних рядків.')
    if (preview.Request?.DataSource === 'NativePriceComparison' && field.measureType === 0)
      result.set(field.columnSourceIndex, 'Кількість не визначено без підтвердженої історичної одиниці виміру документа.')
    if (preview.Request?.DataSource === 'NativeCustomerGroupComparison' && (field.measureType === 109 || field.measureType === 110))
      result.set(field.columnSourceIndex, 'Без підтвердженої одиниці документа кількість та її відхилення не визначено.')
  }
  return result
}
