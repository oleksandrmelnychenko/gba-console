import { apiRequest } from '../../../shared/api/apiClient'
import type {
  CartOptimizeMethod,
  CartPlan,
  CartPlanQuery,
  CockpitDraftItem,
  FeedbackInput,
  ProcurementCharts,
  ProcurementChartsQuery,
  ProcurementUrgency,
  ProducerPlan,
  ProducerProductTerms,
  ProducerProfile,
  ProducerProfileInput,
  ProductTerms,
  ProductTermsInput,
  ReorderCheaperAlt,
  ReorderForecast,
  ReorderInventory,
  ReorderSuggestion,
} from '../procurementTypes'

const KNOWN_URGENCIES: ProcurementUrgency[] = ['critical', 'high', 'normal', 'none']
const KNOWN_CART_METHODS: CartOptimizeMethod[] = ['greedy', 'milp']

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

export async function getBudgetCartPlan(query: CartPlanQuery, signal?: AbortSignal): Promise<CartPlan> {
  const method: CartOptimizeMethod = KNOWN_CART_METHODS.includes(query.method) ? query.method : 'greedy'
  const budgetEur = typeof query.budgetEur === 'number' && Number.isFinite(query.budgetEur) ? query.budgetEur : 0

  const result = await apiRequest<unknown>('/procurement/cart', {
    method: 'POST',
    body: {
      budget_eur: budgetEur,
      method,
      only_needed: true,
      ...(query.asOfDate ? { as_of_date: query.asOfDate } : {}),
    },
    ...(signal ? { signal } : {}),
  })

  return normalizeCartPlan(result)
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

export async function getProducerProfile(producerId: number, signal?: AbortSignal): Promise<ProducerProfile> {
  const result = await apiRequest<unknown>('/procurement/masters/producer', {
    query: { producerId },
    ...(signal ? { signal } : {}),
  })

  return normalizeProducerProfile(result)
}

export async function upsertProducerProfile(profile: ProducerProfileInput): Promise<ProducerProfile> {
  const result = await apiRequest<unknown>('/procurement/masters/producer', {
    method: 'POST',
    body: buildProducerProfileBody(profile),
  })

  return normalizeProducerProfile(result)
}

export async function getProductTerms(producerId: number, signal?: AbortSignal): Promise<ProducerProductTerms> {
  const result = await apiRequest<unknown>('/procurement/masters/product-terms', {
    query: { producerId },
    ...(signal ? { signal } : {}),
  })

  return normalizeProducerProductTerms(result)
}

export async function upsertProductTerms(term: ProductTermsInput): Promise<ProductTerms> {
  const result = await apiRequest<unknown>('/procurement/masters/product-terms', {
    method: 'POST',
    body: buildProductTermsBody(term),
  })

  return normalizeProductTerms(result)
}

export async function recordFeedback(input: FeedbackInput, signal?: AbortSignal): Promise<unknown> {
  const result = await apiRequest<unknown>('/procurement/feedback', {
    method: 'POST',
    body: buildFeedbackBody(input),
    ...(signal ? { signal } : {}),
  })

  return unwrap(result)
}

export async function createCockpitDraftOrder(
  supplierId: number,
  items: CockpitDraftItem[],
  signal?: AbortSignal,
): Promise<unknown> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/new/cockpit/draft', {
    method: 'POST',
    body: {
      supplierId,
      items: items.map((item) => ({ productId: item.productId, qty: item.qty })),
    },
    ...(signal ? { signal } : {}),
  })

  return unwrap(result)
}

function buildProducerProfileBody(profile: ProducerProfileInput): Record<string, number> {
  const body: Record<string, number> = { producer_id: profile.producer_id }

  assignDefinedNumber(body, 'service_level_target', profile.service_level_target)
  assignDefinedNumber(body, 'lead_time_override_days', profile.lead_time_override_days)
  assignDefinedNumber(body, 'ordering_cost_eur', profile.ordering_cost_eur)
  assignDefinedNumber(body, 'holding_rate_pct', profile.holding_rate_pct)
  assignDefinedNumber(body, 'autonomy_level', profile.autonomy_level)
  assignDefinedNumber(body, 'auto_place_max_eur', profile.auto_place_max_eur)

  return body
}

function buildProductTermsBody(term: ProductTermsInput): Record<string, number> {
  const body: Record<string, number> = { producer_id: term.producer_id, product_id: term.product_id }

  assignDefinedNumber(body, 'moq', term.moq)
  assignDefinedNumber(body, 'order_multiple', term.order_multiple)
  assignDefinedNumber(body, 'unit_cost_override', term.unit_cost_override)

  return body
}

function buildFeedbackBody(input: FeedbackInput): Record<string, number | string> {
  const body: Record<string, number | string> = {
    producer_id: input.producer_id,
    product_id: input.product_id,
    action: input.action,
  }

  if (typeof input.suggested_qty === 'number' && Number.isFinite(input.suggested_qty)) {
    body.suggested_qty = input.suggested_qty
  }

  if (typeof input.final_qty === 'number' && Number.isFinite(input.final_qty)) {
    body.final_qty = input.final_qty
  }

  if (typeof input.abc === 'string' && input.abc !== '') {
    body.abc = input.abc
  }

  return body
}

function assignDefinedNumber(target: Record<string, number>, key: string, value: number | null | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    target[key] = value
  }
}

function normalizeProducerProfile(result: unknown): ProducerProfile {
  const payload = unwrap(result)

  if (!payload || typeof payload !== 'object') {
    return emptyProducerProfile()
  }

  const data = payload as Record<string, unknown>

  return {
    producer_id: toNullableNumber(data.producer_id),
    service_level_target: toNullableNumber(data.service_level_target),
    lead_time_override_days: toNullableNumber(data.lead_time_override_days),
    ordering_cost_eur: toNullableNumber(data.ordering_cost_eur),
    holding_rate_pct: toNullableNumber(data.holding_rate_pct),
    autonomy_level: toNullableNumber(data.autonomy_level),
    auto_place_max_eur: toNullableNumber(data.auto_place_max_eur),
  }
}

function normalizeProducerProductTerms(result: unknown): ProducerProductTerms {
  const payload = unwrap(result)

  if (!payload || typeof payload !== 'object') {
    return { producer_id: null, terms: [] }
  }

  const data = payload as Record<string, unknown>

  return {
    producer_id: toNullableNumber(data.producer_id),
    terms: toArray(data.terms)
      .map(normalizeNullableProductTerms)
      .filter((term): term is ProductTerms => term !== null),
  }
}

function normalizeNullableProductTerms(value: unknown): ProductTerms | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const entry = value as Record<string, unknown>
  const productId = toNullableNumber(entry.product_id)

  if (productId === null) {
    return null
  }

  return {
    producer_id: toNullableNumber(entry.producer_id),
    product_id: productId,
    moq: toNullableNumber(entry.moq),
    order_multiple: toNullableNumber(entry.order_multiple),
    unit_cost_override: toNullableNumber(entry.unit_cost_override),
  }
}

function normalizeProductTerms(result: unknown): ProductTerms {
  const payload = unwrap(result)

  if (!payload || typeof payload !== 'object') {
    return emptyProductTerms()
  }

  const data = payload as Record<string, unknown>

  return {
    producer_id: toNullableNumber(data.producer_id),
    product_id: toNullableNumber(data.product_id),
    moq: toNullableNumber(data.moq),
    order_multiple: toNullableNumber(data.order_multiple),
    unit_cost_override: toNullableNumber(data.unit_cost_override),
  }
}

function emptyProducerProfile(): ProducerProfile {
  return {
    producer_id: null,
    service_level_target: null,
    lead_time_override_days: null,
    ordering_cost_eur: null,
    holding_rate_pct: null,
    autonomy_level: null,
    auto_place_max_eur: null,
  }
}

function emptyProductTerms(): ProductTerms {
  return {
    producer_id: null,
    product_id: null,
    moq: null,
    order_multiple: null,
    unit_cost_override: null,
  }
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

function normalizeCartPlan(result: unknown): CartPlan {
  const payload = unwrap(result)

  if (!payload || typeof payload !== 'object') {
    return emptyCartPlan()
  }

  const data = payload as Record<string, unknown>
  const items = normalizeReorderSuggestions(data.items)

  return {
    items,
    item_count: toNumber(data.item_count, items.length),
    as_of_date: typeof data.as_of_date === 'string' ? data.as_of_date : null,
    budget_eur: toNumber(data.budget_eur, 0),
    budget_used_eur: toNumber(data.budget_used_eur, 0),
    value_captured_eur: toNumber(data.value_captured_eur, 0),
    selected_count: toNumber(data.selected_count, 0),
    deferred_count: toNumber(data.deferred_count, 0),
    method_used: normalizeCartMethod(data.method_used),
    model_version: typeof data.model_version === 'string' ? data.model_version : '',
  }
}

function emptyCartPlan(): CartPlan {
  return {
    items: [],
    item_count: 0,
    as_of_date: null,
    budget_eur: 0,
    budget_used_eur: 0,
    value_captured_eur: 0,
    selected_count: 0,
    deferred_count: 0,
    method_used: null,
    model_version: '',
  }
}

function normalizeCartMethod(value: unknown): CartOptimizeMethod | null {
  return typeof value === 'string' && KNOWN_CART_METHODS.includes(value as CartOptimizeMethod)
    ? (value as CartOptimizeMethod)
    : null
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
    raw_qty: toNullableNumber(entry.raw_qty),
    moq: toNullableNumber(entry.moq),
    order_multiple: toNullableNumber(entry.order_multiple),
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
    learned_factor: toNullableNumber(entry.learned_factor),
    value_density: toNullableNumber(entry.value_density),
    within_budget: toNullableBoolean(entry.within_budget),
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

function toNullableBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
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
