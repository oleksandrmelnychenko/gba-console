import { describe, expect, it } from 'vitest'
import type { ProcurementCharts } from './procurementTypes'
import { summarizeProcurementCharts } from './procureDashboardModel'

const charts: ProcurementCharts = {
  as_of_date: '2026-07-24',
  days_of_cover_hist: [
    { bucket: '0–7', count: 5 },
    { bucket: '8–30', count: 7 },
  ],
  demand_series: [
    { product_id: 101, points: [] },
    { product_id: 202, points: [] },
  ],
  producer_id: null,
  top_items: [
    {
      on_hand: 1,
      product_id: 101,
      reorder_point: 9,
      suggested_qty: 7.5,
      urgency: 'critical',
    },
    {
      on_hand: 4,
      product_id: 202,
      reorder_point: 12,
      suggested_qty: 10,
      urgency: 'high',
    },
  ],
  top_n: 15,
  urgency_mix: [
    { count: 3, urgency: 'critical' },
    { count: 4, urgency: 'high' },
    { count: 8, urgency: 'normal' },
    { count: 10, urgency: 'none' },
  ],
}

describe('summarizeProcurementCharts', () => {
  it('builds the operational KPI summary from the returned chart data', () => {
    expect(summarizeProcurementCharts(charts)).toEqual({
      attentionPositions: 7,
      criticalPositions: 3,
      forecastProducts: 2,
      topItems: 2,
      totalPositions: 25,
      totalSuggested: 17.5,
    })
  })

  it('returns an empty summary before dashboard data is available', () => {
    expect(summarizeProcurementCharts(null)).toEqual({
      attentionPositions: 0,
      criticalPositions: 0,
      forecastProducts: 0,
      topItems: 0,
      totalPositions: 0,
      totalSuggested: 0,
    })
  })
})
