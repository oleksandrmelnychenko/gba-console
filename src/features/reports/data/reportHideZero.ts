import { ABC_CLASS_GROUPING, readAbcClassification, requestAbcClassification } from './reportAbcClassification'
import type { ReportDataset, ReportHideZero, ReportHideZeroCapabilities, ReportRequestBody } from '../types'

export const HIDE_ZERO_DATA_SOURCE = 11
export const HIDE_ZERO_GROUPING = 42
export const HIDE_ZERO_MEASURE = 24
export const HIDE_ZERO_ALL_HIDDEN_STATE = 'Стан звіту: усі підтверджені нульові записи приховано'
export const HIDE_ZERO_NOTE_PREFIXES = ['Приховування нулів:', 'Покриття приховування нулів:', 'Видимі рядки та ресурси:', 'Підсумки при приховуванні нулів:'] as const
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const only = (value: unknown, id: number) => Array.isArray(value) && value.length === 1 && value[0] === id

export function readReportHideZero(value: unknown): ReportHideZero | null {
  return record(value) && Object.keys(value).length === 1 && value.Version === 1 ? value as ReportHideZero : null
}
export function requestHideZero(data: ReportRequestBody): unknown {
  return Object.hasOwn(data, 'hideZero') ? data.hideZero : data.HideZero
}
export function readHideZeroCapabilities(dataset?: ReportDataset): ReportHideZeroCapabilities | null {
  const cap = dataset?.HideZero
  if (dataset?.DataSource !== HIDE_ZERO_DATA_SOURCE || !record(cap) || cap.Version !== 1
    || !only(cap.GroupingTypes, HIDE_ZERO_GROUPING) || !only(cap.Measures, HIDE_ZERO_MEASURE)
    || cap.MinimumNativeRowGroups !== 1 || cap.MaximumNativeRowGroups !== 1 || cap.MaximumColumnGroups !== 0
    || cap.MinimumActiveMeasures !== 1 || cap.MaximumActiveMeasures !== 1 || cap.MaximumContributions !== 200000
    || cap.OptionalGeneratedGrouping !== ABC_CLASS_GROUPING || cap.ProofGrain !== 'CurrentPaymentCurrencyRegisterId'
    || cap.UnknownAmountsRetained !== true || cap.PresentationOnly !== true || cap.FactsRetainedForTotals !== true
    || cap.FactsRetainedForAbc !== true || cap.GlobalZeroResourceHidden !== true || cap.CompleteSourceParity !== false
    || !dataset.Groupings.some(field => field.Type === HIDE_ZERO_GROUPING)
    || !dataset.Measurements.some(field => field.Type === HIDE_ZERO_MEASURE)) return null
  return cap as ReportHideZeroCapabilities
}
export function reportHideZeroError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  if (Object.hasOwn(data, 'hideZero') && Object.hasOwn(data, 'HideZero')) return 'Приховування нулів задано двічі. Оригінальні поля не змінено; залиште одне правило.'
  const raw = requestHideZero(data)
  if (raw == null) return null
  if (!readReportHideZero(raw)) return 'Невідома версія або некоректне правило приховування нулів. Дозволено лише Version: 1. Оригінал збережено.'
  if ((data.dataSource ?? 0) !== HIDE_ZERO_DATA_SOURCE || !readHideZeroCapabilities(dataset)) return 'Сервер не підтвердив приховування нулів для цього набору. Збережене правило не змінено.'
  const rows = data.sorted.Row.filter(field => field.type !== ABC_CLASS_GROUPING)
  if (rows.length !== 1 || rows[0].type !== HIDE_ZERO_GROUPING || data.sorted.Col.length !== 0)
    return 'Приховування нулів потребує лише поля «Запис залишку рахунку» в рядках і жодного поля стовпців. ABC-клас можна додати окремо. Правило збережено.'
  const measures = data.sorted.Measurements.filter(field => field.IsChecked)
  if (measures.length !== 1 || measures[0].Type !== HIDE_ZERO_MEASURE)
    return 'Приховування нулів потребує одного увімкненого показника «Записаний залишок рахунку». Зміна показників не видаляє правило.'
  const abc = readAbcClassification(requestAbcClassification(data))
  if (abc && (abc.Grouping !== HIDE_ZERO_GROUPING || abc.Measure !== HIDE_ZERO_MEASURE)) return 'ABC з приховуванням нулів має використовувати запис залишку рахунку і його записаний залишок. Обидва правила збережено.'
  return null
}
export function defaultReportHideZero(data: ReportRequestBody, dataset?: ReportDataset): ReportHideZero | null {
  if (!readHideZeroCapabilities(dataset)) return null
  const candidate = { Version: 1 } as const
  return reportHideZeroError({ ...data, hideZero: candidate }, dataset) ? null : candidate
}
