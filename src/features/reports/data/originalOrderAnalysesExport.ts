import { orderAnalysisFieldLabels, orderAnalysisTitles, type OrderAnalysisField } from './originalOrderAnalyses'
import { orderAnalysisMeasureLabel, orderAnalysisPaymentLabels, orderAnalysisShipmentLabels } from './originalOrderAnalysisLabels'
import { orderAnalysisNumberText } from './originalOrderAnalysisNumbers'
import type { OrderAnalysisChoice, OrderAnalysisResult, OrderAnalysisStatus } from './originalOrderAnalysisResponse'
import type { OriginalDefaultSheet } from './originalDefaultReportExport'
const customerKinds: Record<string, string> = { Warehouse: 'Склад', Department: 'Підрозділ', Undefined: 'Вид не визначено' }
const captionKey = (field: OrderAnalysisField, value: string) => JSON.stringify([field, value])
function captionIndex(choices: OrderAnalysisChoice[]) {
  return new Map(choices.map(v => [captionKey(v.Field, v.Value.Type === null ? (v.Field === 1 ? `::${v.Value.Reference}` : v.Value.Reference) : `${v.Value.Type}:${v.Value.Table}:${v.Value.Reference}`), v.Caption]))
}
function groupCaption(field: OrderAnalysisField, value: string | null, captions: ReadonlyMap<string, string>) {
  if (value === null) return 'Немає значення'
  if (field === 0) return customerKinds[value] ?? 'Назва недоступна'
  if (field === 8) return value
  if (field === 10) return /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(value) ? value.replace('T', ' ') : 'Період недоступний'
  return captions.get(captionKey(field, value)) ?? 'Назва недоступна'
}
export const orderAnalysisGroupCaption = (field: OrderAnalysisField, value: string | null, choices: OrderAnalysisChoice[]) => groupCaption(field, value, captionIndex(choices))
function statusText(status: OrderAnalysisStatus | null, native: readonly string[], labels: readonly string[]) {
  if (!status?.Observed) return 'Недоступно'
  if (status.NumericZero) return '0'
  return status.Caption === null ? 'Немає значення' : labels[native.indexOf(status.Caption)]
}
export function orderAnalysisSheet(result: OrderAnalysisResult): OriginalDefaultSheet {
  const request = result.Request, kind = request.Kind, payment = kind !== 0, captions = captionIndex(result.Choices)
  return { title: `Fenix · ${orderAnalysisTitles[kind]}`, from: request.From, through: request.Through,
    headers: ['Рівень групи', ...request.Rows.map(v => orderAnalysisFieldLabels[v]), ...request.Measures.map(orderAnalysisMeasureLabel), kind === 2 ? 'Надходження' : 'Відвантаження', ...(payment ? ['Оплата'] : [])],
    labelColumns: 1 + request.Rows.length,
    lines: result.Groups.map((group, index) => ({ key: String(index), subtotal: group.Key.length < request.Rows.length, cells: [group.Key.length ? `Група ${group.Key.length}` : 'Усі вибрані рядки',
      ...request.Rows.map((field, i) => i < group.Key.length ? groupCaption(field, group.Key[i].Value, captions) : ''),
      ...request.Measures.map(name => orderAnalysisNumberText(group.Measures[name])),
      statusText(group.Shipment, kind === 2 ? ['Не поступило', 'Поступило частично', 'Поступило полностью'] : ['Не отгружено', 'Отгружено частично', 'Отгружено полностью'], orderAnalysisShipmentLabels(kind)),
      ...(payment ? [statusText(group.Payment, ['Не оплачено', 'Оплачено частично', 'Оплачено полностью'], orderAnalysisPaymentLabels)] : [])] })),
    total: null, note: 'Збережено групи й точні значення сервера. Підсумкові групи не додаються повторно. Невідомі суми й назви не замінено нулем. Курси валют тут не перераховуються.' }
}
