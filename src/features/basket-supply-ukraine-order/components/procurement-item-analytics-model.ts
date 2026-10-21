import type { ProductSalesSeriesPoint } from '../../assortment/types'
import type { ReorderSuggestion } from '../procurementTypes'
import { calculateProcurementDecision } from '../procurementDecision'

export type SalesMetric = 'units' | 'revenue_eur' | 'order_count' | 'avg_price_eur'
export function salesMetricValue(point: ProductSalesSeriesPoint, metric: SalesMetric): number | null {
  const value = point[metric]
  return value !== null && Number.isFinite(value) ? value : null
}

export function stockScenario(row: ReorderSuggestion, selectedQty: number) {
  const decision = calculateProcurementDecision(row, selectedQty)
  const daily = row.forecast.mean_daily
  if (daily <= 0 || decision.leadTimeDays === null) return []
  const arrival = decision.leadTimeDays
  const horizon = Math.max(30, row.forecast.horizon_days, arrival + 7)
  const step = Math.max(1, Math.ceil(horizon / 30))
  const days = new Set([0, arrival, horizon])
  const stockout = row.inventory.available / daily
  const stockoutWithOrder = (row.inventory.available + selectedQty) / daily
  if (stockout > 0 && stockout < horizon) days.add(stockout)
  if (stockoutWithOrder > arrival && stockoutWithOrder < horizon) days.add(stockoutWithOrder)
  for (let day = step; day < horizon; day += step) days.add(day)
  return [...days].sort((a, b) => a - b).flatMap((day) => {
    // Undated inbound stock is shown separately, never treated as available today.
    const withoutOrder = Math.max(0, row.inventory.available - daily * day)
    const afterArrival = Math.max(0, row.inventory.available - daily * day + selectedQty)
    if (day === arrival) {
      // Both points share a numeric x-coordinate: the delivery is a vertical step.
      return [{ day, withoutOrder, withOrder: withoutOrder }, { day, withoutOrder, withOrder: afterArrival }]
    }
    return [{ day, withoutOrder, withOrder: day > arrival ? afterArrival : withoutOrder }]
  })
}

export function formatSalesMonth(value: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(value)
  return match
    ? new Intl.DateTimeFormat('uk-UA', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)))
    : value
}
