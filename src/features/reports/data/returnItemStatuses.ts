import type { ReportDataset, ReportRequestBody, ReportSelection } from '../types'
import { customerGroupInt64Id } from './customerGroupInt64'

type Status = { value: number; name: string }
export function returnItemStatusesCapability(dataset?: ReportDataset): Status[] | null {
  const raw = dataset?.returnItemStatuses
  if (dataset?.DataSource !== 2 || !raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const value = raw as Record<string, unknown>
  if (value.version !== 1 || value.field !== 64 || value.returnsOnly !== true || !Array.isArray(value.values) || value.values.length !== 9) return null
  const statuses: Status[] = []
  for (const item of value.values) {
    if (!item || typeof item !== 'object' || Array.isArray(item) || !Number.isInteger(item.value) || item.value < 0 || item.value > 8
      || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 256 || statuses.some(status => status.value === item.value)) return null
    statuses.push({ value: item.value, name: item.name })
  }
  return statuses
}
export function isReturnItemStatusSelection(request: ReportRequestBody | undefined, field: number): boolean {
  return request?.dataSource === 2 && (request.returnsOnly ?? request.ReturnsOnly) === true
    && (request.reportProfile ?? request.ReportProfile) == null && field === 64
}
/** Exact typed payload; zero is a valid enum. Saved JSON remains untouched. */
export function returnItemStatus(raw: unknown): number | null {
  if (typeof raw === 'string') {
    // Only one canonical numeric member: no duplicate keys, extra fields, exponent or fractional tokens.
    const match = /^\s*\{\s*"ReturnItemStatus"\s*:\s*([0-8])\s*\}\s*$/.exec(raw)
    return match ? Number(match[1]) : null
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const item = raw as Record<string, unknown>
  return Object.keys(item).length === 1 && Number.isInteger(item.ReturnItemStatus)
    && typeof item.ReturnItemStatus === 'number' && item.ReturnItemStatus >= 0 && item.ReturnItemStatus <= 8 ? item.ReturnItemStatus : null
}
export function returnItemStatusSelectionError(request: ReportRequestBody | undefined, dataset: ReportDataset | undefined, selection: ReportSelection): string | null {
  if (!isReturnItemStatusSelection(request, selection.SelectedField.Type) || selection.IsChecked === false) return null
  if (!selection.Values.length) return 'Оберіть причину повернення або вимкніть цю умову.'
  if (selection.Values.length > 100 || ![0, 1, 2, 4].includes(selection.FilterCondition.Type)) return 'Оберіть до 100 значень і одну з чотирьох умов відбору.'
  const typed = selection.Values.map(value => returnItemStatus(value.Data))
  if (typed.every(value => value !== null)) return returnItemStatusesCapability(dataset) ? null : 'Сервер не підтримує вибрані причини повернення. Оновіть сервер або вимкніть цю умову.'
  if (typed.some(value => value !== null)) return 'Не змішуйте старі значення довідника з новими причинами. Очистіть значення та оберіть причини повторно.'
  const containsTypedMarker = selection.Values.some(value => {
    try {
      const raw: unknown = typeof value.Data === 'string' ? JSON.parse(value.Data) : value.Data
      return raw !== null && typeof raw === 'object' && Object.keys(raw).some(key => key.toLowerCase() === 'returnitemstatus')
    } catch { return false }
  })
  if (!containsTypedMarker && selection.Values.every(value => customerGroupInt64Id(value.Data) !== null)) return null
  return 'Оберіть причину повернення зі списку. Довільний текст не є значенням причини.'
}
export function returnItemStatusesError(request: ReportRequestBody, dataset?: ReportDataset): string | null {
  for (const selection of request.selections) {
    const error = returnItemStatusSelectionError(request, dataset, selection)
    if (error) return error
  }
  return null
}
