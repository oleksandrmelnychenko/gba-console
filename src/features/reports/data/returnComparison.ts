import { revenueExactId } from './revenueComparison'
import type { ReportDataset, ReportRequestBody } from '../types'
import { isComparisonDate } from './clientPeriodComparison'
import { reportFilterExpressionError } from './reportFilterExpression'

export const RETURN_COMPARISON_SOURCE = 18
export const RETURN_COMPARISON_TITLE = 'Порівняння повернень покупців за договорами GBA'
export const RETURN_COMPARISON_CAPTIONS = ["Записані повернення за поточний період, EUR", "Записані повернення за період порівняння, EUR", "Зміна записаних повернень, EUR", "Зміна записаних повернень, %"] as const
export const RETURN_COMPARISON_MAXIMUM = 9999999999999.99
export type ReturnComparisonOptions = { Version: 1; From: string; To: string; BaseResource: 4; RoundingPolicy: 'NativeReturnAmountFinalAwayFromZero2' }
const optionKeys = ['Version', 'From', 'To', 'BaseResource', 'RoundingPolicy'] as const
const invalid = 'Перевірте порівняння повернень покупців: два явні періоди, Клієнт → Договір і вибрані показники. Налаштування не застосовано.'
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const aliases = (value: object, name: string) => Object.keys(value).filter(key => key.toLowerCase() === name.toLowerCase())
const filterCapability = { Version: 1, MaximumDepth: 8, MaximumLeaves: 64, MaximumNodes: 128, Operators: [1, 2] }
export function defaultReturnComparison(): ReturnComparisonOptions {
  return { Version: 1, From: '', To: '', BaseResource: 4, RoundingPolicy: 'NativeReturnAmountFinalAwayFromZero2' }
}
export function cloneReturnComparisonAliases(data: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).flatMap(([key, value]) => key.toLowerCase() === 'returncomparison' ? [[key, structuredClone(value)]] : []))
}
export function requestReturnComparison(data: ReportRequestBody): unknown {
  return (data as unknown as Record<string, unknown>)[aliases(data, 'ReturnComparison')[0]]
}
/** Require every option exactly once; neither infer nor align the two independent windows. */
export function returnComparisonOptions(raw: unknown): ReturnComparisonOptions | null {
  if (!record(raw) || Object.keys(raw).length !== optionKeys.length) return null
  const v: Record<string, unknown> = {}
  for (const name of optionKeys) { const keys = aliases(raw, name); if (keys.length !== 1) return null; v[name] = raw[keys[0]] }
  return v.Version === 1 && v.BaseResource === 4 && v.RoundingPolicy === 'NativeReturnAmountFinalAwayFromZero2'
    && isComparisonDate(v.From) && isComparisonDate(v.To) && v.From <= v.To ? v as ReturnComparisonOptions : null
}
export function returnComparisonSummary(raw: unknown): { comparison?: ReturnComparisonOptions } {
  const options = returnComparisonOptions(raw)
  return options ? { comparison: structuredClone(options) } : {}
}
export function isReturnComparisonCapability(raw: unknown): boolean {
  if (!record(raw)) return false
  const expected = {"Version": 1, "Required": true, "DateFormat": "yyyy-MM-dd", "CalendarTimezone": "Europe/Kyiv", "BaseResources": [4], "RoundingPolicy": "NativeReturnAmountFinalAwayFromZero2", "RequiredRows": [12, 15], "ColumnsSupported": false, "MaximumFacts": 200000, "MaximumPeriodMemberships": 400000, "MaximumContracts": 200000, "MaximumDenseCells": 1000000, "MaximumSelections": 64, "MaximumFilterValues": 2000, "PublishedDecimalPlaces": 2, "ZeroPreviousPolicy": "Known current and previous totals with raw previous=0 give 100, including complete-empty 0/0", "UnknownPolicy": "Current and previous known independently; any unconfirmed return currency makes its period unknown; changes require both known", "OrderingPolicy": "Positive ClientID ascending, exact ClientAgreementID ascending", "SourceParityVerified": false}
  return Object.entries(expected).every(([key, value]) => JSON.stringify(raw[key]) === JSON.stringify(value))
}
/** Value is descriptive but remains a typed Int32 on the server, even on disabled rows. */
function selectionError(data: ReportRequestBody): string | null {
  if (!Array.isArray(data.selections) || data.selections.length > 64) return invalid
  const ids = new Set<string>()
  for (const item of data.selections) {
    if (!item || (item.IsChecked != null && typeof item.IsChecked !== 'boolean')) return invalid
    if (Array.isArray(item.Values) && item.Values.some(value => !value || (value.Value !== undefined
      && (!Number.isInteger(value.Value) || value.Value < -2147483648 || value.Value > 2147483647)))) return 'Некоректне описове значення відбору. Налаштування не застосовано.'
    if (item.IsChecked === false) continue
    if (![1, 2, 6, 9, 14].includes(item.SelectedField?.Type) || ![0, 1, 2, 4].includes(item.FilterCondition?.Type)
      || !Array.isArray(item.Values) || !item.Values.length || item.Values.length > 2000) return invalid
    for (const value of item.Values) { const id = revenueExactId(value?.Data); if (!id) return 'Відбори повернень покупців потребують точного позитивного Id товару, клієнта, договору або документа повернення.'; ids.add(id) }
    if (ids.size > 2000) return 'Порівняння повернень покупців підтримує до 2 000 різних ідентифікаторів у відборах.'
  }
  return null
}
export function returnComparisonConfigurationError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  const keys = aliases(data, 'ReturnComparison')
  if (keys.length > 1) return 'Параметри порівняння повернень покупців задані двічі. Налаштування не застосовано.'
  if (data.dataSource !== RETURN_COMPARISON_SOURCE) return requestReturnComparison(data) != null
    ? 'Ці параметри підтримує лише порівняння повернень покупців.' : null
  if (!returnComparisonOptions(requestReturnComparison(data))) return 'Оберіть початок і завершення періоду порівняння повернень покупців та підтверджені параметри розрахунку.'
  if (!isComparisonDate(data.from) || !isComparisonDate(data.to) || data.from > data.to) return 'Оберіть коректний поточний період у межах 1900–9998 років.'
  if (dataset && !isReturnComparisonCapability(dataset.ReturnComparison)) return 'Сервер не підтвердив можливості порівняння повернень покупців.'
  const unsupported = new Set(['onec', 'valuationclientagreementid', 'comparison', 'xyz', 'revenuecomparison', 'buyersalesshare', 'ordering', 'topgroups', 'threshold', 'hidezero', 'abcclassification'])
  if (Object.entries(data).some(([key, value]) => unsupported.has(key.toLowerCase()) && value != null)) return invalid
  if (!data.sorted || !Array.isArray(data.sorted.Row) || !Array.isArray(data.sorted.Col) || !Array.isArray(data.sorted.Measurements)
    || data.sorted.Row.length !== 2 || data.sorted.Row[0]?.type !== 12 || data.sorted.Row[1]?.type !== 15 || data.sorted.Col.length) return invalid
  const all = data.sorted.Measurements, active = all.filter(m => m?.IsChecked !== false)
  if (!all.length || all.length > 4 || all.some(m => !m || ![47, 48, 49, 50].includes(m.Type) || (m.IsChecked != null && typeof m.IsChecked !== 'boolean'))
    || !active.length || new Set(active.map(m => m.Type)).size !== active.length) return invalid
  return selectionError(data) ?? reportFilterExpressionError(data, dataset ?? ({ FilterExpression: filterCapability } as ReportDataset))
}
