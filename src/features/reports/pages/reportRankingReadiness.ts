import type { ReportRequestBody } from '../types'

export type RankingKind = 'TOP' | 'ABC'
type Capabilities = { GroupingTypes: number[]; RankingMeasures: number[] } | null
export const REPORT_RULE_LOCK_REASON = 'Редагування недоступне під час завантаження або без дозволу на формування звітів.'

export function getRankingPrerequisites(kind: RankingKind, data: ReportRequestBody, cap: Capabilities, disabled: boolean) {
  const groups = new Set(cap?.GroupingTypes), measures = new Set(cap?.RankingMeasures)
  const needsGrouping = !!cap && !data.sorted.Row.some(field => groups.has(field.type))
  const needsMeasure = !!cap && !data.sorted.Measurements.some(field => field.IsChecked && measures.has(field.Type))
  const name = kind === 'TOP' ? 'TOP цілих груп' : 'ABC-класифікації'
  const groupReason = kind === 'TOP' ? 'Для TOP додайте до рядків поле, за яким сервер дозволяє відбирати групи.'
    : 'Для ABC додайте до рядків початкове поле, за яким сервер дозволяє класифікацію.'
  const reasons = [
    !cap ? `Для цього набору даних сервер не підтвердив підтримку ${name}.` : null,
    needsGrouping ? groupReason : null,
    needsMeasure ? `Для ${kind} увімкніть показник, який сервер дозволяє підсумовувати.` : null,
    disabled ? REPORT_RULE_LOCK_REASON : null,
  ].filter(Boolean).join(' ')
  return { needsGrouping, needsMeasure, reasons }
}

export type RankingPrerequisites = ReturnType<typeof getRankingPrerequisites>
