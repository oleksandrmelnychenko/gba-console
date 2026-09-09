import { revenueExactId } from './revenueComparison'
import type { ReportDataset, ReportRequestBody } from '../types'
import { isComparisonDate } from './clientPeriodComparison'
import { reportFilterExpressionError } from './reportFilterExpression'

export const MARGIN_COMPARISON_SOURCE = 20
export const MARGIN_COMPARISON_TITLE = 'Порівняння маржі без ПДВ за договорами'
export const MARGIN_COMPARISON_CAPTIONS = ['Маржа за поточний період, %', 'Маржа за період порівняння, %', 'Зміна маржі, в.п.', 'Відносна зміна маржі, %'] as const
export const MARGIN_COMPARISON_RESOURCE = 'Маржа без ПДВ'
export const MARGIN_COMPARISON_MAXIMUM = 9999999999999.99
export type MarginComparisonOptions = { Version: 1; From: string; To: string; BaseResource: 14; RoundingPolicy: 'NativeNetMarginFinalAwayFromZero2' }
const optionKeys = ['Version', 'From', 'To', 'BaseResource', 'RoundingPolicy'] as const
const invalid = 'Перевірте порівняння маржі без ПДВ: два явні періоди, Клієнт → Договір і вибрані показники. Налаштування не застосовано.'
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const aliases = (value: object, name: string) => Object.keys(value).filter(key => key.toLowerCase() === name.toLowerCase())
const filterCapability = { Version: 1, MaximumDepth: 8, MaximumLeaves: 64, MaximumNodes: 128, Operators: [1, 2] }
export function defaultMarginComparison(): MarginComparisonOptions {
  return { Version: 1, From: '', To: '', BaseResource: 14, RoundingPolicy: 'NativeNetMarginFinalAwayFromZero2' }
}
export function cloneMarginComparisonAliases(data: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).flatMap(([key, value]) => key.toLowerCase() === 'margincomparison' ? [[key, structuredClone(value)]] : []))
}
export function requestMarginComparison(data: ReportRequestBody): unknown {
  return (data as unknown as Record<string, unknown>)[aliases(data, 'MarginComparison')[0]]
}
/** Clone a loaded option without discarding invalid imported properties before validation. */
export function cloneMarginComparisonValue(data: ReportRequestBody): unknown {
  const raw = requestMarginComparison(data)
  return structuredClone(marginComparisonOptions(raw) ?? raw)
}
/** Require every option exactly once; neither infer nor align the two independent windows. */
export function marginComparisonOptions(raw: unknown): MarginComparisonOptions | null {
  if (!record(raw) || Object.keys(raw).length !== optionKeys.length) return null
  const v: Record<string, unknown> = {}
  for (const name of optionKeys) { const keys = aliases(raw, name); if (keys.length !== 1) return null; v[name] = raw[keys[0]] }
  return v.Version === 1 && v.BaseResource === 14 && v.RoundingPolicy === 'NativeNetMarginFinalAwayFromZero2'
    && isComparisonDate(v.From) && isComparisonDate(v.To) && v.From <= v.To ? v as MarginComparisonOptions : null
}
export function marginComparisonSummary(raw: unknown): { comparison?: MarginComparisonOptions } {
  const options = marginComparisonOptions(raw)
  return options ? { comparison: structuredClone(options) } : {}
}
export function isMarginComparisonCapability(raw: unknown): boolean {
  if (!record(raw)) return false
  const expected = {"Version": 1, "Required": true, "DateFormat": "yyyy-MM-dd", "CalendarTimezone": "Europe/Kyiv", "BaseResources": [14], "RoundingPolicy": "NativeNetMarginFinalAwayFromZero2", "RequiredRows": [12, 15], "ColumnsSupported": false, "MaximumFacts": 200000, "MaximumPeriodMemberships": 400000, "MaximumContracts": 200000, "MaximumDenseCells": 1000000, "MaximumSelections": 64, "MaximumFilterValues": 2000, "PublishedDecimalPlaces": 2, "ZeroPreviousPolicy": "Both margins known and previous raw margin=0 gives relative change100, including0/0", "UnknownPolicy": "Unknown recorded net sales or historical net cost makes that period margin unknown; changes require both periods known", "OrderingPolicy": "Positive ClientID ascending, exact ClientAgreementID ascending", "CostPolicy": "Complete retained imported net allocations for the whole native sale before display filters; no current lot or reservation fallback", "NetSalesPolicy": "Exact recorded gross EUR minus recorded line VAT divided by positive recorded line rate; zero VAT needs no rate; null VAT remains unknown", "MarginZeroDenominatorPolicy": "Known raw net sales=0 gives margin0 only with complete known cost; no0..100 clamp", "MaximumRationalBits": 65536, "SourceParityVerified": false}
  return Object.entries(expected).every(([key, value]) => JSON.stringify(raw[key]) === JSON.stringify(value))
}
/** Value is descriptive but remains a typed Int32 on the server, even on disabled rows. */
function selectionError(data: ReportRequestBody): string | null {
  if (!Array.isArray(data.selections) || data.selections.length > 64) return invalid
  const ids = new Set<string>()
  let rawValueCount = 0
  for (const item of data.selections) {
    if (!item || (item.IsChecked != null && typeof item.IsChecked !== 'boolean')) return invalid
    rawValueCount += Array.isArray(item.Values) ? item.Values.length : 0
    if (rawValueCount > 2000) return 'Порівняння маржі підтримує до 2 000 значень у відборах разом із повтореними й вимкненими.'
    if (Array.isArray(item.Values) && item.Values.some(value => !value || (value.Value !== undefined
      && (!Number.isInteger(value.Value) || value.Value < -2147483648 || value.Value > 2147483647)))) return 'Некоректне описове значення відбору. Налаштування не застосовано.'
    if (item.IsChecked === false) continue
    if (![1, 2, 6, 9].includes(item.SelectedField?.Type) || ![0, 1, 2, 4].includes(item.FilterCondition?.Type)
      || !Array.isArray(item.Values) || !item.Values.length || item.Values.length > 2000) return invalid
    for (const value of item.Values) { const id = revenueExactId(value?.Data); if (!id) return 'Відбори маржі без ПДВ потребують точного позитивного Id товару, клієнта або точного договору.'; ids.add(id) }
    if (ids.size > 2000) return 'Порівняння маржі без ПДВ підтримує до 2 000 різних ідентифікаторів у відборах.'
  }
  return null
}
export function marginComparisonConfigurationError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  const keys = aliases(data, 'MarginComparison')
  if (keys.length > 1) return 'Параметри порівняння маржі без ПДВ задані двічі. Налаштування не застосовано.'
  if (data.dataSource !== MARGIN_COMPARISON_SOURCE) return requestMarginComparison(data) != null
    ? 'Ці параметри підтримує лише порівняння маржі без ПДВ.' : null
  if (!marginComparisonOptions(requestMarginComparison(data))) return 'Оберіть початок і завершення періоду порівняння маржі без ПДВ та підтверджені параметри розрахунку.'
  if (!isComparisonDate(data.from) || !isComparisonDate(data.to) || data.from > data.to) return 'Оберіть коректний поточний період у межах 1900–9998 років.'
  if (dataset && !isMarginComparisonCapability(dataset.MarginComparison)) return 'Сервер не підтвердив можливості порівняння маржі без ПДВ.'
  const unsupported = new Set(['onec', 'valuationclientagreementid', 'comparison', 'xyz', 'revenuecomparison', 'buyersalesshare', 'returncomparison', 'ratecomparison', 'ordering', 'topgroups', 'threshold', 'hidezero', 'abcclassification'])
  if (Object.entries(data).some(([key, value]) => unsupported.has(key.toLowerCase()) && value != null)) return invalid
  if (!data.sorted || !Array.isArray(data.sorted.Row) || !Array.isArray(data.sorted.Col) || !Array.isArray(data.sorted.Measurements)
    || data.sorted.Row.length !== 2 || data.sorted.Row[0]?.type !== 12 || data.sorted.Row[1]?.type !== 15 || data.sorted.Col.length) return invalid
  const all = data.sorted.Measurements, active = all.filter(m => m?.IsChecked !== false)
  if (!all.length || all.length > 4 || all.some(m => !m || ![55, 56, 57, 58].includes(m.Type) || (m.IsChecked != null && typeof m.IsChecked !== 'boolean'))
    || !active.length || new Set(all.map(m => m.Type)).size !== all.length) return invalid
  return selectionError(data) ?? reportFilterExpressionError(data, dataset ?? ({ FilterExpression: filterCapability } as ReportDataset))
}
