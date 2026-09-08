import type { ReportDataset, ReportRequestBody } from '../types'
import { isComparisonDate } from './clientPeriodComparison'
import { reportFilterExpressionError } from './reportFilterExpression'

export const REVENUE_COMPARISON_SOURCE = 16
export const REVENUE_COMPARISON_TITLE = 'Порівняння записаної виручки за договорами GBA'
export const REVENUE_COMPARISON_CAPTIONS = ['Записана виручка за поточний період, EUR', 'Записана виручка за період порівняння, EUR', 'Зміна записаної виручки, EUR', 'Зміна записаної виручки, %'] as const
export const REVENUE_COMPARISON_MAXIMUM = 9999999999999.99
export type RevenueComparisonOptions = { Version: 1; From: string; To: string; BaseResource: 4; RoundingPolicy: 'NativeRawGrossFinalAwayFromZero2' }
const optionKeys = ['Version', 'From', 'To', 'BaseResource', 'RoundingPolicy'] as const
const invalid = 'Перевірте порівняння виручки: два явні періоди, Клієнт → Договір і вибрані показники. Налаштування не застосовано.'
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const aliases = (value: object, name: string) => Object.keys(value).filter(key => key.toLowerCase() === name.toLowerCase())
const aliasKeys = aliases
const filterCapability = { Version: 1, MaximumDepth: 8, MaximumLeaves: 64, MaximumNodes: 128, Operators: [1, 2] }
export function defaultRevenueComparison(): RevenueComparisonOptions {
  return { Version: 1, From: '', To: '', BaseResource: 4, RoundingPolicy: 'NativeRawGrossFinalAwayFromZero2' }
}
export function cloneRevenueComparisonAliases(data: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).flatMap(([key, value]) => key.toLowerCase() === 'revenuecomparison' ? [[key, structuredClone(value)]] : []))
}
export function requestRevenueComparison(data: ReportRequestBody): unknown {
  return (data as unknown as Record<string, unknown>)[aliases(data, 'RevenueComparison')[0]]
}
/** Require every option exactly once; neither infer nor align the two independent windows. */
export function revenueComparisonOptions(raw: unknown): RevenueComparisonOptions | null {
  if (!record(raw) || Object.keys(raw).length !== optionKeys.length) return null
  const v: Record<string, unknown> = {}
  for (const name of optionKeys) { const keys = aliases(raw, name); if (keys.length !== 1) return null; v[name] = raw[keys[0]] }
  return v.Version === 1 && v.BaseResource === 4 && v.RoundingPolicy === 'NativeRawGrossFinalAwayFromZero2'
    && isComparisonDate(v.From) && isComparisonDate(v.To) && v.From <= v.To ? v as RevenueComparisonOptions : null
}
export function isRevenueComparisonCapability(raw: unknown): boolean {
  if (!record(raw)) return false
  const expected = {"Version": 1, "Required": true, "DateFormat": "yyyy-MM-dd", "CalendarTimezone": "Europe/Kyiv", "BaseResources": [4], "RoundingPolicy": "NativeRawGrossFinalAwayFromZero2", "RequiredRows": [12, 15], "ColumnsSupported": false, "MaximumFacts": 200000, "MaximumPeriodMemberships": 400000, "MaximumContracts": 200000, "MaximumDenseCells": 1000000, "MaximumSelections": 64, "MaximumFilterValues": 2000, "PublishedDecimalPlaces": 2, "ZeroPreviousPolicy": "Known C/P and raw P=0 gives 100, including complete-empty 0/0; not economic growth", "UnknownPolicy": "Current and previous known independently; delta/percentage require both known", "OrderingPolicy": "Positive ClientID ascending, exact ClientAgreementID ascending; unknown client last", "SourceParityVerified": false}
  return Object.entries(expected).every(([key, value]) => JSON.stringify(raw[key]) === JSON.stringify(value))
}
/** Inspect top-level JSON keys before parsing; JSON.parse alone discards duplicate Id properties. */
function uniqueJsonIdKey(raw: string): boolean {
  let depth = 0, count = 0
  for (let index = 0; index < raw.length; index += 1) {
    const character = raw[index]
    if (character === '{' || character === '[') depth += 1
    else if (character === '}' || character === ']') depth -= 1
    else if (character === '"') {
      const start = index
      for (index += 1; index < raw.length; index += 1) {
        if (raw[index] === '\\') index += 1
        else if (raw[index] === '"') break
      }
      if (depth === 1 && /^\s*:/.test(raw.slice(index + 1)) && String(JSON.parse(raw.slice(start, index + 1))).toLowerCase() === 'id') count += 1
    }
  }
  return count === 1
}
export function revenueExactId(raw: unknown): string | null {
  try {
    if (typeof raw === 'string' && !uniqueJsonIdKey(raw)) return null
    const value: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!record(value)) return null
    const keys = aliasKeys(value, 'Id'); if (keys.length !== 1) return null
    const id = value[keys[0]]
    if (typeof id !== 'string' && !(typeof id === 'number' && Number.isSafeInteger(id))) return null
    const text = String(id)
    return /^[1-9]\d{0,18}$/.test(text) && BigInt(text) <= 9223372036854775807n ? text : null
  } catch { return null }
}
/** Value is descriptive but remains a typed Int32 on the server, even on disabled rows. */
function selectionError(data: ReportRequestBody): string | null {
  if (!Array.isArray(data.selections) || data.selections.length > 64) return invalid
  const ids = new Set<string>()
  for (const item of data.selections) {
    if (!item || (item.IsChecked != null && typeof item.IsChecked !== 'boolean')) return invalid
    if (Array.isArray(item.Values) && item.Values.some(value => !value || (value.Value !== undefined
      && (!Number.isInteger(value.Value) || value.Value < -2147483648 || value.Value > 2147483647)))) return 'Описове Value у відборі має бути цілим Int32; точний ідентифікатор належить Data.Id.'
    if (item.IsChecked === false) continue
    if (![1, 2, 6, 9].includes(item.SelectedField?.Type) || ![0, 1, 2, 4].includes(item.FilterCondition?.Type)
      || !Array.isArray(item.Values) || !item.Values.length || item.Values.length > 2000) return invalid
    for (const value of item.Values) { const id = revenueExactId(value?.Data); if (!id) return 'Відбори виручки потребують точного позитивного Id товару, клієнта або ClientAgreement.'; ids.add(id) }
    if (ids.size > 2000) return 'Порівняння виручки підтримує до 2 000 різних ідентифікаторів у відборах.'
  }
  return null
}
export function revenueComparisonConfigurationError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  const keys = aliases(data, 'RevenueComparison')
  if (keys.length > 1) return 'Параметри порівняння виручки задані двічі. Налаштування не застосовано.'
  if (data.dataSource !== REVENUE_COMPARISON_SOURCE) return requestRevenueComparison(data) != null
    ? 'Параметри RevenueComparison підтримує лише порівняння записаної виручки.' : null
  if (!revenueComparisonOptions(requestRevenueComparison(data))) return 'Оберіть початок і завершення періоду порівняння виручки та підтверджені параметри розрахунку.'
  if (!isComparisonDate(data.from) || !isComparisonDate(data.to) || data.from > data.to) return 'Оберіть коректний поточний період у межах 1900–9998 років.'
  if (dataset && !isRevenueComparisonCapability(dataset.RevenueComparison)) return 'Сервер не підтвердив можливості порівняння виручки.'
  const unsupported = new Set(['onec', 'valuationclientagreementid', 'comparison', 'xyz', 'ordering', 'topgroups', 'threshold', 'hidezero', 'abcclassification'])
  if (Object.entries(data).some(([key, value]) => unsupported.has(key.toLowerCase()) && value != null)) return invalid
  if (!data.sorted || !Array.isArray(data.sorted.Row) || !Array.isArray(data.sorted.Col) || !Array.isArray(data.sorted.Measurements)
    || data.sorted.Row.length !== 2 || data.sorted.Row[0]?.type !== 12 || data.sorted.Row[1]?.type !== 15 || data.sorted.Col.length) return invalid
  const all = data.sorted.Measurements, active = all.filter(m => m?.IsChecked !== false)
  if (!all.length || all.length > 4 || all.some(m => !m || ![35, 36, 37, 38].includes(m.Type) || (m.IsChecked != null && typeof m.IsChecked !== 'boolean'))
    || !active.length || new Set(active.map(m => m.Type)).size !== active.length) return invalid
  return selectionError(data) ?? reportFilterExpressionError(data, dataset ?? ({ FilterExpression: filterCapability } as ReportDataset))
}
