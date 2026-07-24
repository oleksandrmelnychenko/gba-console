import type { ProcurementCharts } from './procurementTypes'

export type ProcureDashboardSummary = {
  attentionPositions: number
  criticalPositions: number
  forecastProducts: number
  topItems: number
  totalPositions: number
  totalSuggested: number
}

export function summarizeProcurementCharts(
  charts: ProcurementCharts | null,
): ProcureDashboardSummary {
  if (!charts) {
    return {
      attentionPositions: 0,
      criticalPositions: 0,
      forecastProducts: 0,
      topItems: 0,
      totalPositions: 0,
      totalSuggested: 0,
    }
  }

  const urgencyCounts = new Map(
    charts.urgency_mix.map((bucket) => [bucket.urgency, bucket.count]),
  )
  const criticalPositions = urgencyCounts.get('critical') ?? 0
  const highPositions = urgencyCounts.get('high') ?? 0

  return {
    attentionPositions: criticalPositions + highPositions,
    criticalPositions,
    forecastProducts: charts.demand_series.length,
    topItems: charts.top_items.length,
    totalPositions: charts.urgency_mix.reduce((sum, bucket) => sum + bucket.count, 0),
    totalSuggested: charts.top_items.reduce(
      (sum, item) => sum + item.suggested_qty,
      0,
    ),
  }
}
