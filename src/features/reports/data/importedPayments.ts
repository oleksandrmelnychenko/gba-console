import type { ReportRequestBody } from '../types'
import { isComparisonDate } from './clientPeriodComparison'

export const IMPORTED_PAYMENTS_SOURCE = 14
export const IMPORTED_PAYMENTS_TITLE = 'Поточні записані імпортовані платежі GBA'
export const IMPORTED_PAYMENTS_CAPTIONS = ['Записані надходження', 'Записані виплати', 'Різниця записаних платежів'] as const
export const IMPORTED_PAYMENTS_GROUPS = [0, 1, 2, 3, 12, 15, 39, 40, 41, 44, 47, 48, 49, 50] as const
export const IMPORTED_PAYMENTS_FILTERS = [6, 9, 28, 29, 30, 33, 35, 36, 37, 38] as const
const groups = new Set<number>(IMPORTED_PAYMENTS_GROUPS), filters = new Set<number>(IMPORTED_PAYMENTS_FILTERS)
const invalid = 'Записані імпортовані платежі містять непідтримувані налаштування. Перевірте період, групування й показники.'

/** Validate imported templates and direct report requests before any transport. */
export function importedPaymentsConfigurationError(data: ReportRequestBody): string | null {
  if (data.dataSource !== IMPORTED_PAYMENTS_SOURCE) return null
  if (!isComparisonDate(data.from) || !isComparisonDate(data.to) || data.from > data.to) return 'Оберіть коректний період записаних платежів у межах 1900–9998 років.'
  if (!data.sorted || !Array.isArray(data.sorted.Row) || !Array.isArray(data.sorted.Col)
    || !Array.isArray(data.sorted.Measurements) || !Array.isArray(data.selections)) return invalid
  if (!data.sorted.Row.length || [data.sorted.Row, data.sorted.Col].some(axis => axis.length > 14 || new Set(axis.map(item => item.type)).size !== axis.length
    || axis.some(item => !groups.has(item.type)))) return invalid
  const selected = data.sorted.Measurements.filter(item => item.IsChecked !== false)
  if (!selected.length || new Set(selected.map(item => item.Type)).size !== selected.length
    || data.sorted.Measurements.some(item => ![29, 30, 31].includes(item.Type))) return invalid
  if (['oneC', 'valuationClientAgreementId', 'comparison', 'Comparison', 'topGroups', 'TopGroups', 'threshold', 'Threshold',
    'hideZero', 'HideZero', 'abcClassification', 'AbcClassification'].some(key => (data as unknown as Record<string, unknown>)[key] != null)) return invalid
  if (data.selections.some(item => item.IsChecked !== false && (!filters.has(item.SelectedField?.Type)
    || ![0, 1, 2, 4].includes(item.FilterCondition?.Type) || !Array.isArray(item.Values) || !item.Values.length
    || item.Values.some(value => !Number.isSafeInteger(value.Data?.Id) || Number(value.Data.Id) <= 0)))) return invalid
  return null
}
