import { ABC_CLASS_GROUPING } from './reportAbcClassification'
import type { ReportDataset, ReportRequestBody, ReportTopGroups, ReportTopGroupsCapabilities } from '../types'

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0
const keys = new Set(['Version', 'Axis', 'Grouping', 'Mode', 'Value', 'Measure', 'Direction'])
const additive = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 17, 18, 19, 20, 21, 22, 23, 24])
const choices = (value: unknown): value is Array<1 | 2> => Array.isArray(value) && value.length > 0 && new Set(value).size === value.length && value.every(item => item === 1 || item === 2)
const ids = (value: unknown, allowed: ReadonlySet<number>): value is number[] => Array.isArray(value) && value.length > 0 && new Set(value).size === value.length && value.every(item => integer(item) && allowed.has(item))

export type ReportTopGroupsDraft = Omit<ReportTopGroups, 'Value'> & { Value: number | string }
/** A temporarily blank numeric input remains editable; it is never a valid request value. */
export function readTopGroupsDraft(value: unknown): ReportTopGroupsDraft | null {
  if (!record(value) || Object.keys(value).length !== keys.size || !Object.keys(value).every(key => keys.has(key))
    || value.Version !== 1 || value.Axis !== 1 || !integer(value.Grouping) || !integer(value.Measure)
    || (value.Mode !== 1 && value.Mode !== 2) || (value.Direction !== 1 && value.Direction !== 2)
    || (typeof value.Value !== 'number' && typeof value.Value !== 'string')) return null
  return value as ReportTopGroupsDraft
}

export function readReportTopGroups(value: unknown): ReportTopGroups | null {
  const draft = readTopGroupsDraft(value)
  return draft && Number.isSafeInteger(draft.Value) ? draft as ReportTopGroups : null
}

export function requestTopGroups(data: ReportRequestBody): unknown { return Object.hasOwn(data, 'topGroups') ? data.topGroups : data.TopGroups }

export function readTopGroupsCapabilities(dataset?: ReportDataset): ReportTopGroupsCapabilities | null {
  const cap = dataset?.TopGroups
  if (!record(cap) || cap.Version !== 1 || cap.MaximumRules !== 1 || !Array.isArray(cap.Axes) || cap.Axes.length !== 1 || cap.Axes[0] !== 1
    || !choices(cap.Modes) || !choices(cap.Directions) || cap.Scope !== 'GlobalKey' || cap.TotalsScope !== 'RetainedFactsOnly' || cap.UnknownScores !== 'Reject'
    || cap.PercentScale !== 0 || !integer(cap.MaximumCount) || cap.MaximumCount < 1 || cap.MaximumCount > 10000
    || !integer(cap.PercentMinimum) || !integer(cap.PercentMaximum) || cap.PercentMinimum < 1 || cap.PercentMaximum > 100 || cap.PercentMinimum > cap.PercentMaximum) return null
  const groups = new Set(dataset!.Groupings.flatMap(field => field.Type === ABC_CLASS_GROUPING ? [] : [field.Type]))
  const measures = new Set(dataset!.Measurements.flatMap(field => additive.has(field.Type) ? [field.Type] : []))
  return ids(cap.GroupingTypes, groups) && ids(cap.RankingMeasures, measures) ? cap as ReportTopGroupsCapabilities : null
}

export function reportTopGroupsError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  if (Object.hasOwn(data, 'topGroups') && Object.hasOwn(data, 'TopGroups')) return 'TOP груп задано двічі. Оригінальні поля не змінено; залиште одне поле обмеження.'
  const raw = requestTopGroups(data)
  if (raw == null) return null
  const top = readReportTopGroups(raw)
  if (!top) return 'Невідома версія або некоректні налаштування TOP груп. Оригінал не змінено; усі параметри обов’язкові, значення має бути цілим числом.'
  const cap = readTopGroupsCapabilities(dataset)
  if (!cap) return 'Сервер не підтвердив підтримку TOP цілих груп для цього набору. Збережене обмеження не змінено.'
  if (!cap.Modes.includes(top.Mode) || !cap.Directions.includes(top.Direction)) return 'Обраний режим або напрямок TOP груп не підтримується сервером.'
  const from = top.Mode === 1 ? 1 : cap.PercentMinimum, to = top.Mode === 1 ? cap.MaximumCount : cap.PercentMaximum
  if (top.Value < from || top.Value > to) return `TOP груп: введіть ціле число від ${from} до ${to}${top.Mode === 2 ? ' відсотків кількості груп' : ' груп'}. Значення не змінено автоматично.`
  const caption = dataset!.Groupings.find(field => field.Type === top.Grouping)?.Name ?? `[${top.Grouping}]`
  if (!cap.GroupingTypes.includes(top.Grouping) || data.sorted?.Row?.filter(field => field.type === top.Grouping).length !== 1)
    return `TOP груп «${caption}»: поле має бути вибране рівно один раз у рядках. Обмеження збережено; перенесення до стовпців його не вимикає.`
  if (!additive.has(top.Measure) || !cap.RankingMeasures.includes(top.Measure) || !data.sorted?.Measurements?.some(field => field.Type === top.Measure && field.IsChecked))
    return 'TOP груп: виберіть один увімкнений показник, для якого сервер підтримує додавання. Збережене правило не змінено.'
  return null
}

export function defaultReportTopGroups(data: ReportRequestBody, dataset?: ReportDataset): ReportTopGroups | null {
  const cap = readTopGroupsCapabilities(dataset)
  if (!cap) return null
  const groups = new Set(cap.GroupingTypes), measures = new Set(cap.RankingMeasures)
  const group = data.sorted.Row.find(field => groups.has(field.type)), measure = data.sorted.Measurements.find(field => field.IsChecked && measures.has(field.Type))
  return group && measure ? { Version: 1, Axis: 1, Grouping: group.type, Mode: cap.Modes[0], Value: cap.Modes[0] === 1 ? Math.min(10, cap.MaximumCount) : Math.max(cap.PercentMinimum, Math.min(10, cap.PercentMaximum)),
    Measure: measure.Type, Direction: cap.Directions.includes(2) ? 2 : cap.Directions[0] } : null
}
