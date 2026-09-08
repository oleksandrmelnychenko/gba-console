import type { ReportDataset, ReportRequestBody } from '../types'

export const CLIENT_COMPARISON_SOURCE = 13
export const CLIENT_COMPARISON_TITLE = 'Порівняння клієнтів у проведених продажах GBA'
export const CLIENT_COMPARISON_MIN_DATE = '1900-01-01'
export const CLIENT_COMPARISON_MAX_DATE = '9998-12-31'
export const CLIENT_COMPARISON_CAPTIONS = ['Клієнти за поточний період', 'Клієнти за період порівняння',
  'Зміна кількості клієнтів', 'Зміна кількості клієнтів, %'] as const
export type ClientComparisonWindow = { Version: 1; From: string; To: string }
const groups = new Set([5, 6, 7, 8, 12, 15])
const filters = new Set([1, 2, 6, 9])
const invalid = 'Порівняння клієнтів містить непідтримувані налаштування. Перевірте два періоди, групування рядків і вибрані показники.'
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

export function requestComparison(data: ReportRequestBody): unknown {
  return Object.hasOwn(data, 'comparison') ? data.comparison : data.Comparison
}

export function isComparisonDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
    || value < CLIENT_COMPARISON_MIN_DATE || value > CLIENT_COMPARISON_MAX_DATE) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function comparisonWindow(value: unknown): ClientComparisonWindow | null {
  if (!record(value) || Object.keys(value).length !== 3 || value.Version !== 1
    || !isComparisonDate(value.From) || !isComparisonDate(value.To) || value.From > value.To) return null
  return value as ClientComparisonWindow
}

/** Imported properties survive until validation. Unknown versions and duplicate aliases are never discarded. */
export function clientComparisonConfigurationError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  const present = Object.hasOwn(data, 'comparison') || Object.hasOwn(data, 'Comparison')
  if (data.dataSource !== CLIENT_COMPARISON_SOURCE) return present && requestComparison(data) != null
    ? 'Другий період підтримує лише набір порівняння клієнтів. Налаштування не застосовано.' : null
  if (Object.hasOwn(data, 'comparison') && Object.hasOwn(data, 'Comparison')) return invalid
  if (!comparisonWindow(requestComparison(data))) return 'Оберіть початок і завершення періоду порівняння в межах 1900–9998 років.'
  if (!isComparisonDate(data.from) || !isComparisonDate(data.to) || data.from > data.to) return 'Оберіть коректний поточний період у межах 1900–9998 років.'
  if (dataset && !isClientComparisonCapability(dataset.Comparison)) return 'Сервер не підтвердив можливості порівняння періодів.'
  if (!data.sorted || !Array.isArray(data.sorted.Row) || !Array.isArray(data.sorted.Col)
    || !Array.isArray(data.sorted.Measurements) || !Array.isArray(data.selections)) return invalid
  if (data.sorted.Col.length || !data.sorted.Row.length || data.sorted.Row.length > 6
    || new Set(data.sorted.Row.map(item => item.type)).size !== data.sorted.Row.length
    || data.sorted.Row.some(item => !groups.has(item.type))) return invalid
  const selected = data.sorted.Measurements.filter(item => item.IsChecked !== false)
  if (!selected.length || new Set(selected.map(item => item.Type)).size !== selected.length
    || data.sorted.Measurements.some(item => ![25, 26, 27, 28].includes(item.Type))) return invalid
  if (['oneC', 'valuationClientAgreementId', 'topGroups', 'TopGroups', 'threshold', 'Threshold', 'hideZero', 'HideZero',
    'abcClassification', 'AbcClassification'].some(key => (data as unknown as Record<string, unknown>)[key] != null)) return invalid
  if (data.selections.some(item => item.IsChecked !== false && (!filters.has(item.SelectedField?.Type)
    || ![0, 1, 2, 4].includes(item.FilterCondition?.Type) || !Array.isArray(item.Values) || !item.Values.length
    || item.Values.some(value => !Number.isSafeInteger(value.Data?.Id) || Number(value.Data.Id) <= 0)))) return invalid
  return null
}

export function isClientComparisonCapability(value: unknown): boolean {
  if (!record(value)) return false
  return value.Version === 1 && value.Required === true && value.DateFormat === 'yyyy-MM-dd'
    && value.ColumnsSupported === false && value.MaximumRowGroupings === 6 && value.MaximumUnionFacts === 200000
    && value.PercentageDecimalPlaces === 2 && value.PercentageRounding === 'AwayFromZero'
    && value.ZeroDenominator === '100 when both counts known and previous=0; includes 0/0'
    && value.UnknownOwnership === 'Each count independent; delta and percentage require both known'
}
