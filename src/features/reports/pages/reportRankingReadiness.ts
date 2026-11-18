import type { ReportRequestBody } from '../types'

export type RankingKind = 'TOP' | 'ABC'
type Capabilities = { GroupingTypes: number[]; RankingMeasures: number[] } | null

export function getRankingPrerequisites(data: ReportRequestBody, cap: Capabilities) {
  const groups = new Set(cap?.GroupingTypes), measures = new Set(cap?.RankingMeasures)
  const needsGrouping = !!cap && !data.sorted.Row.some(field => groups.has(field.type))
  const needsMeasure = !!cap && !data.sorted.Measurements.some(field => field.IsChecked && measures.has(field.Type))
  return { needsGrouping, needsMeasure }
}

export type RankingPrerequisites = ReturnType<typeof getRankingPrerequisites>
