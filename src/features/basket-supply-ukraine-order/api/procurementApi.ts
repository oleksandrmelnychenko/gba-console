import { apiRequest } from '../../../shared/api/apiClient'
import type {
  ProcurementCharts,
  ProcurementChartsQuery,
  ProcurementUrgency,
  ProducerPlan,
  ReorderCheaperAlt,
  ReorderForecast,
  ReorderInventory,
  ReorderSuggestion,
} from '../procurementTypes'

const KNOWN_URGENCIES: ProcurementUrgency[] = ['critical', 'high', 'normal', 'none']

export async function getProducerPlan(
  producerId: number,
  asOfDate?: string,
  signal?: AbortSignal,
): Promise<ProducerPlan> {
  const result = await apiRequest<unknown>('/procurement/producer/plan', {
    method: 'POST',
    body: {
      producer_id: producerId,
      ...(asOfDate ? { as_of_date: asOfDate } : {}),
      only_needed: true,
    },
    ...(signal ? { signal } : {}),
  })

  return normalizeProducerPlan(result)
}

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

function normalizeProducerPlan(result: unknown): ProducerPlan {
  const payload = unwrap(result)

  if (!payload || typeof payload !== 'object') {
    return emptyProducerPlan()
  }

  const data = payload as Record<string, unknown>
  const items = normalizeReorderSuggestions(data.items)

  return {
    producer_id: toNullableNumber(data.producer_id),
    producer_name: typeof data.producer_name === 'string' ? data.producer_name : '',
    lead_time_days: toNumber(data.lead_time_days, 0),
    lead_time_std_days: toNumber(data.lead_time_std_days, 0),
    lead_time_source: typeof data.lead_time_source === 'string' ? data.lead_time_source : '',
    item_count: toNumber(data.item_count, items.length),
    as_of_date: typeof data.as_of_date === 'string' ? data.as_of_date : null,
    model_version: typeof data.model_version === 'string' ? data.model_version : '',
    items,
  }
}

function normalizeReorderSuggestions(value: unknown): ReorderSuggestion[] {
  return toArray(value)
    .map(normalizeReorderSuggestion)
    .filter((item): item is ReorderSuggestion => item !== null)
}

function normalizeReorderSuggestion(value: unknown): ReorderSuggestion | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const entry = value as Record<string, unknown>
  const productId = toNullableNumber(entry.product_id)
  const urgency = normalizeUrgency(entry.urgency)

  if (productId === null || urgency === null) {
    return null
  }

  return {
    product_id: productId,
    producer_id: toNumber(entry.producer_id, 0),
    suggested_qty: toNumber(entry.suggested_qty, 0),
    reorder_point: toNumber(entry.reorder_point, 0),
    safety_stock: toNumber(entry.safety_stock, 0),
    days_of_cover: toNumber(entry.days_of_cover, 0),
    urgency,
    reason: typeof entry.reason === 'string' ? entry.reason : '',
    forecast: normalizeForecast(entry.forecast),
    inventory: normalizeInventory(entry.inventory),
    unit_cost_eur: toNullableNumber(entry.unit_cost_eur),
    line_cost_eur: toNullableNumber(entry.line_cost_eur),
    unit_sale_eur: toNullableNumber(entry.unit_sale_eur),
    unit_margin_eur: toNullableNumber(entry.unit_margin_eur),
    applied_service_level: toNullableNumber(entry.applied_service_level),
    abc: normalizeNullableString(entry.abc),
    xyz: normalizeNullableString(entry.xyz),
    quadrant: normalizeNullableString(entry.quadrant),
    cheaper_alt: normalizeCheaperAlt(entry.cheaper_alt),
  }
}

function normalizeForecast(value: unknown): ReorderForecast {
  const entry = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

  return {
    mean_daily: toNumber(entry.mean_daily, 0),
    std_daily: toNumber(entry.std_daily, 0),
    method: typeof entry.method === 'string' ? entry.method : '',
    horizon_days: toNumber(entry.horizon_days, 0),
    forecast_units: toNumber(entry.forecast_units, 0),
  }
}

function normalizeInventory(value: unknown): ReorderInventory {
  const entry = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

  return {
    on_hand: toNumber(entry.on_hand, 0),
    reserved: toNumber(entry.reserved, 0),
    on_order: toNumber(entry.on_order, 0),
    available: toNumber(entry.available, 0),
    position: toNumber(entry.position, 0),
  }
}

function normalizeCheaperAlt(value: unknown): ReorderCheaperAlt | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const entry = value as Record<string, unknown>
  const producerId = toNullableNumber(entry.producer_id)
  const costEur = toNullableNumber(entry.cost_eur)

  if (producerId === null || costEur === null) {
    return null
  }

  return {
    producer_id: producerId,
    cost_eur: costEur,
  }
}

function normalizeUrgency(value: unknown): ProcurementUrgency | null {
  return KNOWN_URGENCIES.find((urgency) => urgency === value) ?? null
}

function normalizeNullableString(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

function emptyProducerPlan(): ProducerPlan {
  return {
    producer_id: null,
    producer_name: '',
    lead_time_days: 0,
    lead_time_std_days: 0,
    lead_time_source: '',
    item_count: 0,
    as_of_date: null,
    model_version: '',
    items: [],
  }
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
