import { revenueExactId } from './revenueComparison'
import type { ReportDataset, ReportRequestBody } from '../types'
import { isComparisonDate } from './clientPeriodComparison'

export const PAYMENT_COMPARISON_SOURCE = 21
export const PAYMENT_COMPARISON_TITLE = 'Порівняння імпортованих платежів за договорами'
export const PAYMENT_COMPARISON_CAPTIONS = ['Сума за поточний період', 'Сума за період порівняння', 'Зміна суми', 'Відносна зміна платежів, %'] as const
export const PAYMENT_COMPARISON_RESOURCE = 'Порівняння платежів'
export const PAYMENT_COMPARISON_PERCENTAGE_MAXIMUM = 9999999999999.99
export type PaymentComparisonOptions = { Version: 1; From: string; To: string; Direction: 1 | 2; RoundingPolicy: 'NativeRecordedPaymentFinal4RelativeAwayFromZero2' }
const optionKeys = ['Version', 'From', 'To', 'Direction', 'RoundingPolicy'] as const
const invalid = 'Перевірте порівняння імпортованих платежів: два явні періоди, Валюта → Клієнт → Договір і вибрані показники. Налаштування не застосовано.'
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const aliases = (value: object, name: string) => Object.keys(value).filter(key => key.toLowerCase() === name.toLowerCase())
export const PAYMENT_COMPARISON_FILTERS = [6, 9, 28, 29, 30, 33, 35, 37, 38] as const
export const PAYMENT_COMPARISON_GROUPINGS = [{ Type: 41, Name: 'Валюта рахунку' }, { Type: 12, Name: 'Клієнт' }, { Type: 15, Name: 'Договір' }] as const
export function defaultPaymentComparison(): Omit<PaymentComparisonOptions, 'Direction'> & { Direction: null } {
  return { Version: 1, From: '', To: '', Direction: null, RoundingPolicy: 'NativeRecordedPaymentFinal4RelativeAwayFromZero2' }
}
export function clonePaymentComparisonAliases(data: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).flatMap(([key, value]) => key.toLowerCase() === 'paymentcomparison' ? [[key, structuredClone(value)]] : []))
}
export function requestPaymentComparison(data: ReportRequestBody): unknown {
  return (data as unknown as Record<string, unknown>)[aliases(data, 'PaymentComparison')[0]]
}
/** Clone a loaded option without discarding invalid imported properties before validation. */
export function clonePaymentComparisonValue(data: ReportRequestBody): unknown {
  const raw = requestPaymentComparison(data)
  return structuredClone(paymentComparisonOptions(raw) ?? raw)
}
/** Require every option exactly once; neither infer nor align the two independent windows. */
export function paymentComparisonOptions(raw: unknown): PaymentComparisonOptions | null {
  if (!record(raw) || Object.keys(raw).length !== optionKeys.length) return null
  const v: Record<string, unknown> = {}
  for (const name of optionKeys) { const keys = aliases(raw, name); if (keys.length !== 1) return null; v[name] = raw[keys[0]] }
  return v.Version === 1 && (v.Direction === 1 || v.Direction === 2) && v.RoundingPolicy === 'NativeRecordedPaymentFinal4RelativeAwayFromZero2'
    && isComparisonDate(v.From) && isComparisonDate(v.To) && v.From <= v.To ? v as PaymentComparisonOptions : null
}
export function paymentComparisonSummary(raw: unknown): { comparison?: PaymentComparisonOptions } {
  const options = paymentComparisonOptions(raw)
  return options ? { comparison: structuredClone(options) } : {}
}
export function isPaymentComparisonCapability(raw: unknown): boolean {
  if (!record(raw)) return false
  const expected = {"Version": 1, "Required": true, "DateFormat": "yyyy-MM-dd", "CalendarTimezone": "Europe/Kyiv", "Directions": [1, 2], "RoundingPolicy": "NativeRecordedPaymentFinal4RelativeAwayFromZero2", "RequiredRows": [41, 12, 15], "ColumnsSupported": false, "MaximumFacts": 200000, "MaximumPeriodMemberships": 400000, "MaximumDenseCells": 1000000, "MaximumSelections": 64, "MaximumFilterValues": 2000, "MoneyDecimalPlaces": 4, "RelativeDecimalPlaces": 2, "ZeroPreviousPolicy": "Both amounts known and previous=0 gives relative change100, including0/0", "UnknownPolicy": "Unconfirmed money poisons only its period; changes require both periods known", "CurrencyPolicy": "One confirmed exact currency across both periods per group; mixed or unknown currency makes every output unknown", "OrderingPolicy": "Nullable currency ID, client ID and exact ClientAgreement ID ascending; unknown first", "AmountPolicy": "Recorded native document amount at four decimal places; no FX conversion or repricing", "EmptyPolicy": "Complete empty scope has no leaves and no grand row", "SourceParityVerified": false}
  return Object.entries(expected).every(([key,value]) => JSON.stringify(raw[key]) === JSON.stringify(value))
}
/** One legacy JSON object layer is supported; its Id must remain a string. */
export function paymentComparisonExactId(raw: unknown): string | null {
  const id = revenueExactId(raw)
  if (!id) return null
  try {
    const value: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!record(value)) return null
    const keys = aliases(value, 'Id')
    return keys.length === 1 && typeof value[keys[0]] === 'string' ? id : null
  } catch { return null }
}
/** Value is descriptive but remains a typed Int32 on the server, even on disabled rows. */
function selectionError(data: ReportRequestBody): string | null {
  if (!Array.isArray(data.selections) || data.selections.length > 64) return invalid
  const ids = new Set<string>()
  let rawValueCount = 0
  for (const item of data.selections) {
    if (!item || (item.IsChecked != null && typeof item.IsChecked !== 'boolean')) return invalid
    rawValueCount += Array.isArray(item.Values) ? item.Values.length : 0
    if (rawValueCount > 2000) return 'Порівняння платежів підтримує до 2 000 значень у відборах разом із повтореними й вимкненими.'
    if (Array.isArray(item.Values) && item.Values.some(value => !value || (value.Value !== undefined
      && (!Number.isInteger(value.Value) || value.Value < -2147483648 || value.Value > 2147483647)))) return 'Некоректне описове значення відбору. Налаштування не застосовано.'
    if (item.IsChecked === false) continue
    if (!PAYMENT_COMPARISON_FILTERS.some(field => field === item.SelectedField?.Type) || ![0, 1, 2, 4].includes(item.FilterCondition?.Type)
      || !Array.isArray(item.Values) || !item.Values.length || item.Values.length > 2000) return invalid
    for (const value of item.Values) { const id = paymentComparisonExactId(value?.Data); if (!id) return 'Відбори імпортованих платежів потребують точного позитивного Id клієнта, точного договору або реквізиту платежу, записаного рядком.'; ids.add(id) }
    if (ids.size > 2000) return 'Порівняння імпортованих платежів підтримує до 2 000 різних ідентифікаторів у відборах.'
  }
  return null
}
export function paymentComparisonConfigurationError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  const keys = aliases(data, 'PaymentComparison')
  if (keys.length > 1) return 'Параметри порівняння імпортованих платежів задані двічі. Налаштування не застосовано.'
  if (data.dataSource !== PAYMENT_COMPARISON_SOURCE) return requestPaymentComparison(data) != null
    ? 'Ці параметри підтримує лише порівняння імпортованих платежів.' : null
  if (!paymentComparisonOptions(requestPaymentComparison(data))) return 'Оберіть початок і завершення періоду порівняння імпортованих платежів та підтверджені параметри розрахунку.'
  if (!isComparisonDate(data.from) || !isComparisonDate(data.to) || data.from > data.to) return 'Оберіть коректний поточний період у межах 1900–9998 років.'
  if (dataset && !isPaymentComparisonCapability(dataset.paymentComparison)) return 'Сервер не підтвердив можливості порівняння імпортованих платежів.'
  const unsupported = new Set(['onec', 'valuationclientagreementid', 'comparison', 'xyz', 'revenuecomparison', 'buyersalesshare', 'returncomparison', 'ratecomparison', 'margincomparison', 'filterexpression', 'ordering', 'topgroups', 'threshold', 'hidezero', 'abcclassification'])
  if (Object.entries(data).some(([key, value]) => unsupported.has(key.toLowerCase()) && value != null)) return invalid
  if (!data.sorted || !Array.isArray(data.sorted.Row) || !Array.isArray(data.sorted.Col) || !Array.isArray(data.sorted.Measurements)
    || data.sorted.Row.length !== 3 || data.sorted.Row[0]?.type !== 41 || data.sorted.Row[1]?.type !== 12 || data.sorted.Row[2]?.type !== 15 || data.sorted.Col.length) return invalid
  const all = data.sorted.Measurements, active = all.filter(m => m?.IsChecked !== false)
  if (!all.length || all.length > 4 || all.some(m => !m || ![59, 60, 61, 62].includes(m.Type) || (m.IsChecked != null && typeof m.IsChecked !== 'boolean'))
    || !active.length || new Set(all.map(m => m.Type)).size !== all.length) return invalid
  return selectionError(data)
}
