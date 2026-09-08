import { ABC_CLASS_GROUPING, readAbcClassification, requestAbcClassification } from './reportAbcClassification'
import type { ReportDataset, ReportRequestBody, ReportThreshold, ReportThresholdCapabilities } from '../types'

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0
const keys = new Set(['Version', 'Axis', 'Grouping', 'Measure', 'Percent'])
const additive = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 17, 18, 19, 20, 21, 22, 23, 24])
const ids = (value: unknown, allowed: ReadonlySet<number>): value is number[] => Array.isArray(value) && value.length > 0
  && new Set(value).size === value.length && value.every(item => integer(item) && allowed.has(item))
export type ReportThresholdDraft = Omit<ReportThreshold, 'Percent'> & { Percent: number | string }

/** A partially edited value stays visible; no rounding, clamping or imported field deletion. */
export function readThresholdDraft(value: unknown): ReportThresholdDraft | null {
  if (!record(value) || Object.keys(value).length !== keys.size || !Object.keys(value).every(key => keys.has(key))
    || value.Version !== 1 || value.Axis !== 1 || !integer(value.Grouping) || !integer(value.Measure)
    || (typeof value.Percent !== 'number' && typeof value.Percent !== 'string')) return null
  return value as ReportThresholdDraft
}
export function readReportThreshold(value: unknown): ReportThreshold | null {
  const draft = readThresholdDraft(value)
  return draft && Number.isSafeInteger(draft.Percent) ? draft as ReportThreshold : null
}
export function requestThreshold(data: ReportRequestBody): unknown {
  return Object.hasOwn(data, 'threshold') ? data.threshold : data.Threshold
}
export function readThresholdCapabilities(dataset?: ReportDataset): ReportThresholdCapabilities | null {
  const cap = dataset?.Threshold
  if (!record(cap) || cap.Version !== 1 || cap.MaximumRules !== 1 || !Array.isArray(cap.Axes) || cap.Axes.length !== 1 || cap.Axes[0] !== 1
    || cap.PercentMinimum !== 1 || cap.PercentMaximum !== 100 || cap.PercentScale !== 0
    || cap.MaximumNativeRowGroupings !== 1 || cap.MaximumNativeColumnGroupings !== 0 || cap.MaximumActiveMeasures !== 1
    || cap.Scope !== 'GlobalKeyAfterTop' || cap.TotalsScope !== 'AllInputFactsIncludingOther' || cap.UnknownScores !== 'Reject'
    || cap.NegativeScores !== 'Reject' || cap.NonPositiveTotal !== 'RejectExceptEmpty' || cap.ZeroOnlyRemainder !== 'Reject'
    || cap.OtherIdentityKind !== 'ThresholdOther' || cap.SyntheticOtherSelectable !== false || cap.MaximumContributions !== 200000
    || cap.SupportsAbc !== true || cap.SupportsTop !== true || cap.SupportsOrdering !== true) return null
  const groups = new Set(dataset!.Groupings.flatMap(field => field.Type === ABC_CLASS_GROUPING ? [] : [field.Type]))
  const measures = new Set(dataset!.Measurements.flatMap(field => additive.has(field.Type) ? [field.Type] : []))
  return ids(cap.GroupingTypes, groups) && ids(cap.RankingMeasures, measures) ? cap as ReportThresholdCapabilities : null
}
export function reportThresholdError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  if (Object.hasOwn(data, 'threshold') && Object.hasOwn(data, 'Threshold')) return 'Поріг задано двічі. Оригінальні поля не змінено; залиште одне правило.'
  const raw = requestThreshold(data)
  if (raw == null) return null
  const rule = readReportThreshold(raw)
  if (!rule) return 'Невідома версія або некоректне правило порогу. Усі параметри обов’язкові; відсоток має бути цілим числом. Оригінал збережено.'
  const cap = readThresholdCapabilities(dataset)
  if (!cap) return 'Сервер не підтвердив підтримку порогу для цього набору. Збережене правило не змінено.'
  if (rule.Percent < cap.PercentMinimum || rule.Percent > cap.PercentMaximum) return 'Поріг: введіть цілий відсоток від 1 до 100. Значення не змінено автоматично.'
  const rows = data.sorted.Row.filter(field => field.type !== ABC_CLASS_GROUPING)
  if (rows.length !== 1 || rows[0].type !== rule.Grouping || !cap.GroupingTypes.includes(rule.Grouping) || data.sorted.Col.length !== 0)
    return 'Поріг потребує рівно одного початкового поля рядків і жодного поля стовпців. ABC-клас можна додати окремо. Правило збережено після зміни групувань.'
  const measures = data.sorted.Measurements.filter(field => field.IsChecked)
  if (measures.length !== 1 || measures[0].Type !== rule.Measure || !cap.RankingMeasures.includes(rule.Measure))
    return 'Поріг потребує рівно одного увімкненого показника, який сервер дозволяє підсумовувати. Вимкнення або додавання показників не видаляє правило.'
  const abc = readAbcClassification(requestAbcClassification(data))
  if (abc && (abc.Grouping !== rule.Grouping || abc.Measure !== rule.Measure)) return 'ABC після порогу має використовувати те саме початкове групування і показник. Обидва правила збережено.'
  return null
}
export function defaultReportThreshold(data: ReportRequestBody, dataset?: ReportDataset): ReportThreshold | null {
  const cap = readThresholdCapabilities(dataset)
  if (!cap) return null
  const rows = data.sorted.Row.filter(field => field.type !== ABC_CLASS_GROUPING)
  const measures = data.sorted.Measurements.filter(field => field.IsChecked)
  if (rows.length !== 1 || data.sorted.Col.length || measures.length !== 1
    || !cap.GroupingTypes.includes(rows[0].type) || !cap.RankingMeasures.includes(measures[0].Type)) return null
  return { Version: 1, Axis: 1, Grouping: rows[0].type, Measure: measures[0].Type, Percent: 20 }
}
