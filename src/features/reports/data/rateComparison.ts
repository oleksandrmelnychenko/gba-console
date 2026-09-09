import { isComparisonDate } from './clientPeriodComparison'
import type { ReportDataset, ReportRequestBody } from '../types'

export const RATE_COMPARISON_SOURCE = 19
export const RATE_COMPARISON_TITLE = 'Порівняння історичних курсів валют'
export const RATE_COMPARISON_CAPTIONS = ['Курс на поточну дату', 'Курс на дату порівняння', 'Зміна курсу', 'Зміна курсу, %'] as const
export const RATE_COMPARISON_RESOURCE = 'Історичні курси'
export const RATE_COMPARISON_GROUP = 'Валютна пара'
export type RateComparisonOptions = { Version: 1; RateKind: 'commercial' | 'government'; RateDefinitionId: string; CurrentAsOf: string; PreviousAsOf: string }
const optionKeys = ['Version', 'RateKind', 'RateDefinitionId', 'CurrentAsOf', 'PreviousAsOf'] as const
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const aliases = (value: object, name: string) => Object.keys(value).filter(key => key.toLowerCase() === name.toLowerCase())
export const rateDefinitionId = (value: unknown): value is string => typeof value === 'string' && /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n
export function defaultRateComparison(): RateComparisonOptions { return { Version: 1, RateKind: 'commercial', RateDefinitionId: '', CurrentAsOf: '', PreviousAsOf: '' } }
export function cloneRateComparisonAliases(value: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => key.toLowerCase() === 'ratecomparison' ? [[key, structuredClone(item)]] : []))
}
export function requestRateComparison(value: object): unknown { return (value as Record<string, unknown>)[aliases(value, 'RateComparison')[0]] }
export function rateComparisonOptions(raw: unknown): RateComparisonOptions | null {
  if (!record(raw) || Object.keys(raw).length !== optionKeys.length) return null
  const value: Record<string, unknown> = {}
  for (const name of optionKeys) { const keys = aliases(raw, name); if (keys.length !== 1) return null; value[name] = raw[keys[0]] }
  return value.Version === 1 && (value.RateKind === 'commercial' || value.RateKind === 'government') && rateDefinitionId(value.RateDefinitionId)
    && isComparisonDate(value.CurrentAsOf) && isComparisonDate(value.PreviousAsOf) ? value as RateComparisonOptions : null
}
export function isRateComparisonCapability(raw: unknown): boolean {
  if (!record(raw)) return false
  const expected = { version: 1, kinds: ['commercial', 'government'], lookupFields: { commercial: 39, government: 40 }, dateSemantics: 'stored-calendar-end-of-day', rateDecimals: 4, percentageDecimals: 2, totalsSupported: false, sourceParityVerified: false }
  return Object.entries(expected).every(([key, value]) => JSON.stringify(raw[key]) === JSON.stringify(value))
}
export function rateComparisonConfigurationError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  const keys = aliases(data, 'RateComparison'), raw = requestRateComparison(data)
  if (keys.length > 1) return 'Параметри порівняння курсів задані двічі. Налаштування не застосовано.'
  if (data.dataSource !== RATE_COMPARISON_SOURCE) return raw != null ? 'Ці параметри підтримує лише порівняння історичних курсів.' : null
  const invalid = 'Оберіть одну точну серію курсу, дві незалежні дати й показники. Порівняння курсів не підтримує підсумки або загальні відбори.'
  if (!rateComparisonOptions(raw)) return invalid
  if ([data.from, data.to].some(value => value != null && value !== '') || !Array.isArray(data.selections) || data.selections.length) return invalid
  if (dataset && (!isRateComparisonCapability(dataset.rateComparison) || dataset.PeriodSupported !== false || dataset.PeriodRequired !== false || dataset.Filters.length)) return 'Сервер не підтвердив можливості порівняння історичних курсів.'
  const unsupported = new Set(['onec', 'valuationclientagreementid', 'comparison', 'xyz', 'revenuecomparison', 'buyersalesshare', 'returncomparison', 'filterexpression', 'ordering', 'topgroups', 'threshold', 'hidezero', 'abcclassification'])
  if (Object.entries(data).some(([key, value]) => unsupported.has(key.toLowerCase()) && value != null)) return invalid
  const sorted = data.sorted
  if (!sorted || !Array.isArray(sorted.Row) || sorted.Row.length !== 1 || sorted.Row[0]?.type !== 52 || !Array.isArray(sorted.Col) || sorted.Col.length || !Array.isArray(sorted.Measurements)) return invalid
  const all = sorted.Measurements, selected = all.filter(item => item?.IsChecked !== false)
  if (!all.length || all.length > 4 || all.some(item => !item || ![51, 52, 53, 54].includes(item.Type) || (item.IsChecked != null && typeof item.IsChecked !== 'boolean'))
    || !selected.length || new Set(all.map(item => item.Type)).size !== all.length) return invalid
  return null
}
