import type { ReportAbcClassification, ReportAbcClassificationCapabilities, ReportDataset, ReportGroupingItem, ReportRequestBody } from '../types'

export const ABC_CLASS_GROUPING = 46
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0
const keys = new Set(['Version', 'Axis', 'Grouping', 'Measure', 'PercentA', 'PercentB', 'PercentC'])
const percentages = ['PercentA', 'PercentB', 'PercentC'] as const
const additive = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 17, 18, 19, 20, 21, 22, 23, 24])
const ids = (value: unknown, allowed: ReadonlySet<number>): value is number[] => Array.isArray(value) && value.length > 0
  && new Set(value).size === value.length && value.every(item => integer(item) && allowed.has(item))
export type ReportAbcDraft = Omit<ReportAbcClassification, 'PercentA' | 'PercentB' | 'PercentC'> & Record<typeof percentages[number], number | string>

/** Blank and out-of-range inputs stay editable. Neither percentages nor imported properties are repaired. */
export function readAbcDraft(value: unknown): ReportAbcDraft | null {
  if (!record(value) || Object.keys(value).length !== keys.size || !Object.keys(value).every(key => keys.has(key))
    || value.Version !== 1 || value.Axis !== 1 || !integer(value.Grouping) || !integer(value.Measure)
    || !percentages.every(key => typeof value[key] === 'number' || typeof value[key] === 'string')) return null
  return value as ReportAbcDraft
}
export function readAbcClassification(value: unknown): ReportAbcClassification | null {
  const draft = readAbcDraft(value)
  return draft && percentages.every(key => Number.isSafeInteger(draft[key])) ? draft as ReportAbcClassification : null
}
export function requestAbcClassification(data: ReportRequestBody): unknown {
  return Object.hasOwn(data, 'abcClassification') ? data.abcClassification : data.AbcClassification
}
export function readAbcCapabilities(dataset?: ReportDataset): ReportAbcClassificationCapabilities | null {
  const cap = dataset?.AbcClassification
  if (!record(cap) || cap.Version !== 1 || cap.MaximumRules !== 1 || !Array.isArray(cap.Axes) || cap.Axes.length !== 1 || cap.Axes[0] !== 1
    || cap.GeneratedGrouping !== ABC_CLASS_GROUPING || cap.PercentMinimum !== 0 || cap.PercentMaximum !== 100 || cap.PercentScale !== 0 || cap.PercentTotal !== 100
    || cap.Scope !== 'GlobalKeyAfterTop' || cap.ClassBasis !== 'CumulativeBeforeCurrentGroup' || cap.UnknownScores !== 'Reject'
    || cap.NegativeScores !== 'Reject' || cap.TotalsScope !== 'AllRetainedFacts' || cap.TieBreak !== 'TypedKeyAscending') return null
  const groups = new Set(dataset!.Groupings.flatMap(field => field.Type !== ABC_CLASS_GROUPING ? [field.Type] : []))
  const measures = new Set(dataset!.Measurements.flatMap(field => additive.has(field.Type) ? [field.Type] : []))
  if (!dataset!.Groupings.some(field => field.Type === ABC_CLASS_GROUPING)) return null
  return ids(cap.GroupingTypes, groups) && ids(cap.RankingMeasures, measures) ? cap as ReportAbcClassificationCapabilities : null
}
export function reportAbcClassificationError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  if (Object.hasOwn(data, 'abcClassification') && Object.hasOwn(data, 'AbcClassification')) return 'ABC-класифікацію задано двічі. Оригінальні поля не змінено; залиште одне правило.'
  const raw = requestAbcClassification(data)
  const classes = data.sorted?.Row?.filter(field => field.type === ABC_CLASS_GROUPING) ?? []
  if (data.sorted?.Col?.some(field => field.type === ABC_CLASS_GROUPING)) return 'ABC-клас підтримується лише в рядках. Налаштування не змінено.'
  if (raw == null) return classes.length ? 'Поле «ABC-клас» потребує увімкненої ABC-класифікації. Налаштування не змінено.' : null
  const rule = readAbcClassification(raw)
  if (!rule) return 'Невідома версія або некоректне правило ABC. Оригінал не змінено; усі параметри обов’язкові, відсотки мають бути цілими числами.'
  const cap = readAbcCapabilities(dataset)
  if (!cap) return 'Сервер не підтвердив підтримку ABC-класифікації для цього набору. Правило не змінено.'
  if (percentages.some(key => rule[key] < 0 || rule[key] > 100) || rule.PercentA + rule.PercentB + rule.PercentC !== 100)
    return 'ABC: введіть цілі відсотки A, B і C від 0 до 100 із сумою 100. Значення не змінено автоматично.'
  if (classes.length !== 1) return 'ABC: поле «ABC-клас» має бути вибране рівно один раз у рядках. Правило збережено.'
  if (!cap.GroupingTypes.includes(rule.Grouping) || data.sorted.Row.filter(field => field.type === rule.Grouping).length !== 1)
    return 'ABC: виберіть рівно один наявний у рядках початковий ключ класифікації. Перенесення або видалення ключа не вимикає правило.'
  if (!additive.has(rule.Measure) || !cap.RankingMeasures.includes(rule.Measure)
    || !data.sorted.Measurements.some(field => field.Type === rule.Measure && field.IsChecked))
    return 'ABC: виберіть один увімкнений показник, який сервер дозволяє підсумовувати. Правило збережено.'
  return null
}
export function defaultAbcClassification(data: ReportRequestBody, dataset?: ReportDataset): ReportAbcClassification | null {
  const cap = readAbcCapabilities(dataset)
  if (!cap || [...data.sorted.Row, ...data.sorted.Col].some(field => field.type === ABC_CLASS_GROUPING)) return null
  const groups = new Set(cap.GroupingTypes), measures = new Set(cap.RankingMeasures)
  const group = data.sorted.Row.find(field => groups.has(field.type))
  const measure = data.sorted.Measurements.find(field => field.IsChecked && measures.has(field.Type))
  return group && measure ? { Version: 1, Axis: 1, Grouping: group.type, Measure: measure.Type, PercentA: 80, PercentB: 15, PercentC: 5 } : null
}

/** A same-source preset keeps the exact virtual fields; validation still detects an absent native target. */
export function preserveAbcGrouping(current: ReportRequestBody, next: ReportRequestBody): ReportRequestBody {
  const result = { ...next, sorted: { ...next.sorted } }
  for (const axis of ['Row', 'Col'] as const) {
    const groups: ReportGroupingItem[] = [...next.sorted[axis]]
    current.sorted[axis].forEach((field, index) => {
      if (field.type === ABC_CLASS_GROUPING) groups.splice(Math.min(index, groups.length), 0, structuredClone(field))
    })
    result.sorted[axis] = groups
  }
  return result
}
