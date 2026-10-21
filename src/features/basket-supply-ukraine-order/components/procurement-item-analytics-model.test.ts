import { describe, expect, it } from 'vitest'
import type { ReorderSuggestion } from '../procurementTypes'
import type { ProductSalesSeriesPoint } from '../../assortment/types'
import { salesMetricValue, stockScenario } from './procurement-item-analytics-model'

describe('product analytics model', () => {
  it('does not treat undated inbound stock as available today and keeps fractional quantities', () => {
    const row = {
      inventory: { available: 10.5, on_order: 100, position: 110.5 },
      forecast: { mean_daily: 1, horizon_days: 30 },
      lead_demand: 2,
      safety_stock: 1,
      reorder_point: 3,
      suggested_qty: 4,
      unit_cost_eur: 2,
    } as ReorderSuggestion
    const points = stockScenario(row, 4.25)
    expect(points[0]).toEqual({ day: 0, withoutOrder: 10.5, withOrder: 10.5 })
    expect(points.filter((point) => point.day === 2)).toEqual([{ day: 2, withoutOrder: 8.5, withOrder: 8.5 }, { day: 2, withoutOrder: 8.5, withOrder: 12.75 }])
  })
  it('preserves missing prices separately from real zero', () => {
    const point = { avg_price_eur: null, units: 0 } as ProductSalesSeriesPoint
    expect(salesMetricValue(point, 'avg_price_eur')).toBeNull()
    expect(salesMetricValue(point, 'units')).toBe(0)
  })
  it('includes exact fractional stockout coordinates between coarse samples', () => {
    const row = {
      inventory: { available: 5.5, on_order: 0, position: 5.5 },
      forecast: { mean_daily: 1, horizon_days: 90 },
      lead_demand: 2, safety_stock: 1, reorder_point: 3,
      suggested_qty: 4, unit_cost_eur: 2,
    } as ReorderSuggestion
    const points = stockScenario(row, 4.25)
    expect(points.find((point) => point.day === 5.5)).toEqual({ day: 5.5, withoutOrder: 0, withOrder: 4.25 })
    expect(points.find((point) => point.day === 9.75)).toEqual({ day: 9.75, withoutOrder: 0, withOrder: 0 })
  })
})
