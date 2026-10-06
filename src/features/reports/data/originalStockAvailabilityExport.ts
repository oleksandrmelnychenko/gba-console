import type { OriginalDefaultSheet } from './originalDefaultReportExport'
import { stockAxisLabels, stockMeasureLabel } from './originalStockAvailability'
import type { StockResult } from './originalStockAvailabilityResponse'
export function stockAvailabilitySheet(result: StockResult): OriginalDefaultSheet {
  return { title: 'Доступність товарів на складах · Fenix', from: result.At, through: result.At, scopeLabel: `Дата й час залишку: ${result.At}, без включення руху в цю секунду`,
    headers: [...result.Rows.map(v => stockAxisLabels[v]), ...result.Measures.map(stockMeasureLabel)], labelColumns: result.Rows.length,
    lines: result.Data.map(row => ({ key: JSON.stringify(row.Key.map(v => [v.Field, v.Key])), cells: [...row.Key.map(v => v.Caption), ...result.Measures.map(m => row.Values[m]?.Display ?? 'Недоступно')] })), total: null,
    note: 'Значення з нашого повного зрізу. Резерв, надходження, передача й замовлення постачальникам збережені окремо. Недоступні значення не замінено нулем.' }
}
export const stockCompleteExport = (result: StockResult) => result.Available && result.OurSnapshotVerified && result.NormalInputsComplete && result.Data.every(row => result.Measures.every(m => row.Values[m] != null))
