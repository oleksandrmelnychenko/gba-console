import { apiRequest } from '../../../shared/api/apiClient'
import type { ProcurementCharts, ProcurementChartsQuery } from '../procurementTypes'

export async function getProcurementCharts(
  query: ProcurementChartsQuery = {},
  signal?: AbortSignal,
): Promise<ProcurementCharts> {
  const result = await apiRequest<unknown>('/procurement/charts', {
    query: buildChartsQuery(query),
    ...(signal ? { signal } : {}),
  })

  return normalizeCharts(result)
}

function buildChartsQuery(query: ProcurementChartsQuery) {
  const params: Record<string, number> = {}

  if (typeof query.producerId === 'number' && Number.isFinite(query.producerId)) {
    params.producerId = query.producerId
  }

  if (typeof query.topN === 'number' && Number.isFinite(query.topN)) {
    params.topN = query.topN
  }

  return params
}

function normalizeCharts(result: unknown): ProcurementCharts {
  const payload = unwrap(result)

  if (!payload || typeof payload !== 'object') {
    return emptyCharts()
  }

  const data = payload as Record<string, unknown>

  return {
    producer_id: toNullableNumber(data.producer_id),
    as_of_date: typeof data.as_of_date === 'string' ? data.as_of_date : null,
    top_n: toNumber(data.top_n, 15),
    urgency_mix: normalizeUrgencyMix(data.urgency_mix),
    days_of_cover_hist: normalizeDaysOfCover(data.days_of_cover_hist),
    top_items: normalizeTopItems(data.top_items),
    demand_series: normalizeDemandSeries(data.demand_series),
  }
}

function normalizeUrgencyMix(value: unknown) {
  return toArray(value)
    .map((item) => {
      const bucket = item as Record<string, unknown>

      return {
        urgency: String(bucket.urgency ?? ''),
        count: toNumber(bucket.count, 0),
      }
    })
    .filter((bucket) => bucket.urgency !== '')
}

function normalizeDaysOfCover(value: unknown) {
  return toArray(value).map((item) => {
    const bucket = item as Record<string, unknown>

    return {
      bucket: String(bucket.bucket ?? ''),
      count: toNumber(bucket.count, 0),
    }
  })
}

function normalizeTopItems(value: unknown) {
  return toArray(value).map((item) => {
    const entry = item as Record<string, unknown>

    return {
      product_id: toNumber(entry.product_id, 0),
      suggested_qty: toNumber(entry.suggested_qty, 0),
      on_hand: toNumber(entry.on_hand, 0),
      reorder_point: toNumber(entry.reorder_point, 0),
      urgency: String(entry.urgency ?? ''),
    }
  })
}

function normalizeDemandSeries(value: unknown) {
  return toArray(value).map((item) => {
    const series = item as Record<string, unknown>

    return {
      product_id: toNumber(series.product_id, 0),
      points: toArray(series.points).map((point) => {
        const entry = point as Record<string, unknown>

        return {
          period: String(entry.period ?? ''),
          units: toNumber(entry.units, 0),
          is_forecast: Boolean(entry.is_forecast),
        }
      }),
    }
  })
}

function unwrap(result: unknown): unknown {
  if (result && typeof result === 'object' && 'Body' in result) {
    const body = (result as { Body?: unknown }).Body

    if (body && typeof body === 'object') {
      return body
    }
  }

  return result
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  return null
}

function toNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function emptyCharts(): ProcurementCharts {
  return {
    producer_id: null,
    as_of_date: null,
    top_n: 15,
    urgency_mix: [],
    days_of_cover_hist: [],
    top_items: [],
    demand_series: [],
  }
}
