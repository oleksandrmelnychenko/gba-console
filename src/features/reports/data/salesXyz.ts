import type { ReportDataset, ReportRequestBody } from '../types'
import { isComparisonDate } from './clientPeriodComparison'
import { reportFilterExpressionError } from './reportFilterExpression'

export const XYZ_SOURCE = 15
export const XYZ_TITLE = 'XYZ-стабільність продажів GBA за товарами'
export const XYZ_CAPTIONS = ['Сума продажів з ПДВ, EUR', 'Середня сума за період, EUR', 'Коефіцієнт варіації, %'] as const
export const XYZ_POLICIES = ['NativeClosedCalendarMonths', 'NativeTouchedMonthsSourceWindow'] as const
export const XYZ_BOUND_KEYS = ['XLower', 'XUpper', 'YLower', 'YUpper', 'ZLower', 'ZUpper'] as const
export const XYZ_MAXIMUM = 9999999999999.99
export type XyzBounds = Record<typeof XYZ_BOUND_KEYS[number], number>
export type SalesXyzOptions = { Version: 1; BaseResource: 4; Object: 5; CalendarPolicy: typeof XYZ_POLICIES[number]; PeriodCount: number; Bounds: XyzBounds; RoundingPolicy: 'NativeAwayFromZero2' }
const optionKeys = ['Version', 'BaseResource', 'Object', 'CalendarPolicy', 'PeriodCount', 'Bounds', 'RoundingPolicy'] as const
const invalid = 'Перевірте параметри XYZ: календар, кількість періодів, шість меж і вибрані показники. Налаштування не застосовано.'
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const filterCapability = { Version: 1, MaximumDepth: 8, MaximumLeaves: 64, MaximumNodes: 128, Operators: [1, 2] }
export function defaultXyzOptions(): SalesXyzOptions {
  return { Version: 1, BaseResource: 4, Object: 5, CalendarPolicy: XYZ_POLICIES[0], PeriodCount: 3,
    Bounds: { XLower: 0, XUpper: 20, YLower: 20, YUpper: 50, ZLower: 50, ZUpper: 10000 }, RoundingPolicy: 'NativeAwayFromZero2' }
}
function aliasKeys(value: object, name: string) { return Object.keys(value).filter(key => key.toLowerCase() === name.toLowerCase()) }
export function cloneXyzAliases(data: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).flatMap(([key, value]) => key.toLowerCase() === 'xyz' ? [[key, structuredClone(value)]] : []))
}
export function requestXyz(data: ReportRequestBody): unknown { return (data as unknown as Record<string, unknown>)[aliasKeys(data, 'Xyz')[0]] }
/** Canonical casing only; require every field once and preserve literal numeric values. */
function fields(value: unknown, names: readonly string[]): Record<string, unknown> | null {
  if (!record(value) || Object.keys(value).length !== names.length) return null
  const result: Record<string, unknown> = {}
  for (const name of names) { const keys = aliasKeys(value, name); if (keys.length !== 1) return null; result[name] = value[keys[0]] }
  return result
}
export function xyzOptions(raw: unknown): SalesXyzOptions | null {
  const v = fields(raw, optionKeys), bounds = fields(v?.Bounds, XYZ_BOUND_KEYS)
  if (!v || !bounds || v.Version !== 1 || v.BaseResource !== 4 || v.Object !== 5 || !XYZ_POLICIES.some(p => p === v.CalendarPolicy)
    || v.RoundingPolicy !== 'NativeAwayFromZero2' || !Number.isInteger(v.PeriodCount) || Number(v.PeriodCount) < 1 || Number(v.PeriodCount) > 60
    || Object.values(bounds).some(n => typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > XYZ_MAXIMUM || Number(n.toFixed(2)) !== n)) return null
  return { ...v, Bounds: bounds } as SalesXyzOptions
}
const kyivMonthFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit' })
function monthKey(date: string) { return Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1 }
function dateForMonth(key: number, day: number) { return `${String(Math.floor(key / 12)).padStart(4, '0')}-${String(key % 12 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` }
function lastDay(key: number) { return new Date(`${dateForMonth(key + 1, 1)}T00:00:00Z`).getTime() - 86400000 }
function kyivMonth(now: Date) {
  const parts: Record<string, string> = {}
  for (const part of kyivMonthFormatter.formatToParts(now)) if (part.type === 'year' || part.type === 'month') parts[part.type] = part.value
  return parts
}
export function xyzCalendarError(from: string, to: string, options: SalesXyzOptions, now = new Date()): string | null {
  if (!isComparisonDate(from) || !isComparisonDate(to) || from > to) return 'Оберіть коректні дати XYZ у межах 1900–9998 років.'
  const first = monthKey(from), last = monthKey(to), n = options.PeriodCount, k = last - first + 1
  if (k < 1 || k > 61) return invalid
  if (options.CalendarPolicy === XYZ_POLICIES[0]) {
    if (from !== dateForMonth(first, 1) || Date.parse(to + 'T00:00:00Z') !== lastDay(last) || k !== n)
      return 'Повні місяці XYZ: початок має бути першим днем, завершення — останнім днем, а кількість місяців має дорівнювати N.'
    const observed = kyivMonth(now)
    if (last >= Number(observed.year) * 12 + Number(observed.month) - 1) return 'Для XYZ оберіть лише завершені місяці перед поточним місяцем за Києвом.'
  } else {
    const target = last - n, lastTarget = new Date(lastDay(target)).getUTCDate()
    const previous = dateForMonth(target, Math.min(Number(to.slice(8)), lastTarget)), start = new Date(Date.parse(previous + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10)
    if (from !== start) return `Для вибраного вікна XYZ початок має бути ${start}: дата завершення мінус N місяців, потім один день.`
  }
  return null
}
export function isXyzCapability(raw: unknown): boolean {
  if (!record(raw)) return false
  const expected = { Version: 1, Required: true, DateFormat: 'yyyy-MM-dd', CalendarTimezone: 'Europe/Kyiv', BaseResources: [4], Objects: [5], CalendarPolicies: [...XYZ_POLICIES],
    RoundingPolicy: 'NativeAwayFromZero2', MinimumPeriodCount: 1, MaximumPeriodCount: 60, MaximumActualBuckets: 61, RequiredRows: [51, 5], ColumnsSupported: false,
    MaximumFacts: 200000, MaximumObjectBuckets: 200000, MaximumDenseCells: 1000000, MaximumSelections: 64, MaximumFilterValues: 2000, PublishedDecimalPlaces: 2,
    CvDisplayDecimalPlaces: 3, SummaryPolicy: 'ResourceTotalOnly', SourcePeriodGridVerified: false, SourceParityVerified: false }
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
function exactId(raw: unknown): string | null {
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
function selectionError(data: ReportRequestBody): string | null {
  if (!Array.isArray(data.selections) || data.selections.length > 64) return invalid
  const ids = new Set<string>()
  for (const item of data.selections) {
    if (item?.IsChecked === false) continue
    if (!item || ![1, 2, 6, 9].includes(item.SelectedField?.Type) || ![0, 1, 2, 4].includes(item.FilterCondition?.Type)
      || !Array.isArray(item.Values) || !item.Values.length || item.Values.length > 2000) return invalid
    for (const value of item.Values) { const id = exactId(value?.Data); if (!id) return 'Умови XYZ потребують точного позитивного Id товару, клієнта або ClientAgreement.'; ids.add(id) }
    if (ids.size > 2000) return 'XYZ підтримує до 2 000 різних ідентифікаторів у відборах.'
  }
  return null
}
export function salesXyzConfigurationError(data: ReportRequestBody, dataset?: ReportDataset, now = new Date()): string | null {
  const keys = aliasKeys(data, 'Xyz')
  if (keys.length > 1) return 'Параметри XYZ задані двічі. Налаштування не застосовано.'
  if (data.dataSource !== XYZ_SOURCE) return requestXyz(data) != null ? 'Параметри XYZ підтримує лише XYZ-стабільність продажів GBA.' : null
  const options = xyzOptions(requestXyz(data))
  if (!options) return invalid
  if (dataset && !isXyzCapability(dataset.Xyz)) return 'Сервер не підтвердив можливості XYZ.'
  const unsupported = new Set(['onec', 'valuationclientagreementid', 'comparison', 'ordering', 'topgroups', 'threshold', 'hidezero', 'abcclassification'])
  if (Object.entries(data).some(([key, value]) => unsupported.has(key.toLowerCase()) && value != null)) return invalid
  if (!data.sorted || !Array.isArray(data.sorted.Row) || !Array.isArray(data.sorted.Col) || !Array.isArray(data.sorted.Measurements)
    || data.sorted.Row.length !== 2 || data.sorted.Row[0]?.type !== 51 || data.sorted.Row[1]?.type !== 5 || data.sorted.Col.length) return invalid
  const all = data.sorted.Measurements, active = all.filter(m => m?.IsChecked !== false)
  if (!all.length || all.length > 3 || all.some(m => !m || ![32, 33, 34].includes(m.Type)) || !active.length || new Set(active.map(m => m.Type)).size !== active.length) return invalid
  return xyzCalendarError(data.from, data.to, options, now) ?? selectionError(data)
    ?? reportFilterExpressionError(data, dataset ?? ({ FilterExpression: filterCapability } as ReportDataset))
}
