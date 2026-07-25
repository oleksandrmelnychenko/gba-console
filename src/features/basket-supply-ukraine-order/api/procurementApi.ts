import { apiRequest } from '../../../shared/api/apiClient'
import type {
  CartOptimizeMethod,
  CartPlan,
  CartPlanQuery,
  CockpitDraftItem,
  CockpitDraftResult,
  CockpitDraftResultItem,
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
const MAX_DRAFT_ITEMS = 500
const MAX_DRAFT_QTY = 1_000_000
const DRAFT_QTY_SCALE = 3
const MAX_MONEY_EUR = 1_000_000_000
const QUANTITY_TOLERANCE = 0.001

export class ProcurementContractError extends Error {
  constructor(path: string, reason: string) {
    super(`Некоректна відповідь AI Procurement (${path}): ${reason}`)
    this.name = 'ProcurementContractError'
  }
}

export async function getProducerPlan(
  producerId: number,
  asOfDate?: string,
  signal?: AbortSignal,
): Promise<ProducerPlan> {
  assertSafePositiveInteger(producerId, 'request.producer_id')

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
  if (!KNOWN_CART_METHODS.includes(query.method)) {
    throw new ProcurementContractError('request.method', 'unsupported optimization method')
  }

  const method = query.method
  const budgetEur = requireNumberInRange(query.budgetEur, 'request.budget_eur', 0, MAX_MONEY_EUR)

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

  return normalizeCartPlan(result, budgetEur)
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
  assertSafePositiveInteger(producerId, 'request.producer_id')

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
  assertSafePositiveInteger(producerId, 'request.producer_id')

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
): Promise<CockpitDraftResult> {
  validateCockpitDraftRequest(supplierId, items)

  const result = await apiRequest<unknown>('/supplies/ukraine/order/new/cockpit/draft', {
    method: 'POST',
    body: {
      supplierId,
      items: items.map((item) => ({ productId: item.productId, qty: item.qty })),
    },
    ...(signal ? { signal } : {}),
  })

  return normalizeCockpitDraftResult(result, supplierId, items)
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

  if (query.producerId !== undefined) {
    assertSafePositiveInteger(query.producerId, 'request.producer_id')
    params.producerId = query.producerId
  }

  if (query.topN !== undefined) {
    if (!Number.isSafeInteger(query.topN) || query.topN < 1 || query.topN > 100) {
      throw new ProcurementContractError('request.top_n', 'must be an integer from 1 to 100')
    }
    params.topN = query.topN
  }

  return params
}

function normalizeCharts(result: unknown): ProcurementCharts {
  const data = requireRecord(unwrap(result), 'charts')
  const producerId = requireNullableSafePositiveInteger(data.producer_id, 'charts.producer_id')
  const topN = requireIntegerInRange(data.top_n, 'charts.top_n', 1, 100)
  const urgencyMix = normalizeUrgencyMix(data.urgency_mix)
  const daysOfCover = normalizeDaysOfCover(data.days_of_cover_hist)
  const topItems = normalizeTopItems(data.top_items)
  const demandSeries = normalizeDemandSeries(data.demand_series)
  const topProductIds = new Set(topItems.map((item) => item.product_id))

  for (const series of demandSeries) {
    if (!topProductIds.has(series.product_id)) {
      throw new ProcurementContractError(
        `charts.demand_series[product_id=${series.product_id}]`,
        'product is absent from top_items',
      )
    }
  }

  return {
    producer_id: producerId,
    as_of_date: requireNonEmptyString(data.as_of_date, 'charts.as_of_date'),
    top_n: topN,
    urgency_mix: urgencyMix,
    days_of_cover_hist: daysOfCover,
    top_items: topItems,
    demand_series: demandSeries,
    model_version: requireNonEmptyString(data.model_version, 'charts.model_version'),
  }
}

function normalizeUrgencyMix(value: unknown) {
  const seen = new Set<string>()

  return requireArray(value, 'charts.urgency_mix').map((item, index) => {
    const path = `charts.urgency_mix[${index}]`
    const bucket = requireRecord(item, path)
    const urgency = normalizeUrgency(bucket.urgency)

    if (urgency === null) {
      throw new ProcurementContractError(`${path}.urgency`, 'unknown urgency')
    }
    if (seen.has(urgency)) {
      throw new ProcurementContractError(`${path}.urgency`, 'duplicate urgency bucket')
    }
    seen.add(urgency)

    return {
      urgency,
      count: requireIntegerInRange(bucket.count, `${path}.count`, 0, Number.MAX_SAFE_INTEGER),
    }
  })
}

function normalizeDaysOfCover(value: unknown) {
  const seen = new Set<string>()

  return requireArray(value, 'charts.days_of_cover_hist').map((item, index) => {
    const path = `charts.days_of_cover_hist[${index}]`
    const entry = requireRecord(item, path)
    const bucket = requireNonEmptyString(entry.bucket, `${path}.bucket`)

    if (seen.has(bucket)) {
      throw new ProcurementContractError(`${path}.bucket`, 'duplicate cover bucket')
    }
    seen.add(bucket)

    return {
      bucket,
      count: requireIntegerInRange(entry.count, `${path}.count`, 0, Number.MAX_SAFE_INTEGER),
    }
  })
}

function normalizeTopItems(value: unknown) {
  const seen = new Set<number>()

  return requireArray(value, 'charts.top_items').map((item, index) => {
    const path = `charts.top_items[${index}]`
    const entry = requireRecord(item, path)
    const productId = requireSafePositiveInteger(entry.product_id, `${path}.product_id`)
    const urgency = normalizeUrgency(entry.urgency)

    if (urgency === null) {
      throw new ProcurementContractError(`${path}.urgency`, 'unknown urgency')
    }
    if (seen.has(productId)) {
      throw new ProcurementContractError(`${path}.product_id`, 'duplicate product')
    }
    seen.add(productId)

    return {
      image_url: requireNullableString(entry.image_url, `${path}.image_url`),
      oe_number: requireNullableString(entry.oe_number, `${path}.oe_number`),
      producer_id: requireNullableSafePositiveInteger(entry.producer_id, `${path}.producer_id`),
      producer_name: requireNullableString(entry.producer_name, `${path}.producer_name`),
      product_id: productId,
      product_name: requireNullableString(entry.product_name, `${path}.product_name`),
      suggested_qty: requireNumberInRange(
        entry.suggested_qty,
        `${path}.suggested_qty`,
        0,
        MAX_DRAFT_QTY,
      ),
      on_hand: requireFiniteNumber(entry.on_hand, `${path}.on_hand`),
      reorder_point: requireNumberInRange(
        entry.reorder_point,
        `${path}.reorder_point`,
        0,
        Number.MAX_SAFE_INTEGER,
      ),
      urgency,
      vendor_code: requireNullableString(entry.vendor_code, `${path}.vendor_code`),
    }
  })
}

function normalizeDemandSeries(value: unknown) {
  const seen = new Set<number>()

  return requireArray(value, 'charts.demand_series').map((item, index) => {
    const path = `charts.demand_series[${index}]`
    const series = requireRecord(item, path)
    const productId = requireSafePositiveInteger(series.product_id, `${path}.product_id`)

    if (seen.has(productId)) {
      throw new ProcurementContractError(`${path}.product_id`, 'duplicate demand series')
    }
    seen.add(productId)

    return {
      image_url: requireNullableString(series.image_url, `${path}.image_url`),
      oe_number: requireNullableString(series.oe_number, `${path}.oe_number`),
      product_id: productId,
      product_name: requireNullableString(series.product_name, `${path}.product_name`),
      points: requireArray(series.points, `${path}.points`).map((point, pointIndex) => {
        const pointPath = `${path}.points[${pointIndex}]`
        const entry = requireRecord(point, pointPath)
        const period = requireNonEmptyString(entry.period, `${pointPath}.period`)

        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
          throw new ProcurementContractError(`${pointPath}.period`, 'must use yyyy-MM')
        }

        return {
          period,
          units: requireNumberInRange(
            entry.units,
            `${pointPath}.units`,
            0,
            Number.MAX_SAFE_INTEGER,
          ),
          is_forecast: requireBoolean(entry.is_forecast, `${pointPath}.is_forecast`),
        }
      }),
      vendor_code: requireNullableString(series.vendor_code, `${path}.vendor_code`),
    }
  })
}

function normalizeProducerPlan(result: unknown): ProducerPlan {
  const data = requireRecord(unwrap(result), 'producer_plan')
  const producerId = requireSafePositiveInteger(data.producer_id, 'producer_plan.producer_id')
  const items = normalizeReorderSuggestions(data.items, 'producer_plan.items')
  assertUniqueSuggestionProducts(items, 'producer_plan.items')

  for (const item of items) {
    if (item.producer_id !== producerId) {
      throw new ProcurementContractError(
        `producer_plan.items[product_id=${item.product_id}].producer_id`,
        `expected ${producerId}`,
      )
    }
  }

  const itemCount = requireIntegerInRange(
    data.item_count,
    'producer_plan.item_count',
    0,
    Number.MAX_SAFE_INTEGER,
  )
  if (itemCount !== items.length) {
    throw new ProcurementContractError(
      'producer_plan.item_count',
      `declares ${itemCount}, received ${items.length}`,
    )
  }

  return {
    producer_id: producerId,
    producer_name: requireNullableString(data.producer_name, 'producer_plan.producer_name') ?? '',
    lead_time_days: requireNumberInRange(
      data.lead_time_days,
      'producer_plan.lead_time_days',
      0,
      Number.MAX_SAFE_INTEGER,
    ),
    lead_time_std_days: requireNumberInRange(
      data.lead_time_std_days,
      'producer_plan.lead_time_std_days',
      0,
      Number.MAX_SAFE_INTEGER,
    ),
    lead_time_source: requireNonEmptyString(
      data.lead_time_source,
      'producer_plan.lead_time_source',
    ),
    item_count: itemCount,
    as_of_date: requireNullableString(data.as_of_date, 'producer_plan.as_of_date'),
    model_version: requireNonEmptyString(data.model_version, 'producer_plan.model_version'),
    items,
  }
}

function normalizeCartPlan(result: unknown, expectedBudgetEur: number): CartPlan {
  const data = requireRecord(unwrap(result), 'cart')
  const items = normalizeReorderSuggestions(data.items, 'cart.items')
  assertUniqueSuggestionProducts(items, 'cart.items')

  const itemCount = requireIntegerInRange(data.item_count, 'cart.item_count', 0, Number.MAX_SAFE_INTEGER)
  if (itemCount !== items.length) {
    throw new ProcurementContractError('cart.item_count', `declares ${itemCount}, received ${items.length}`)
  }

  const totalItemCount = requireIntegerInRange(
    data.total_item_count,
    'cart.total_item_count',
    itemCount,
    Number.MAX_SAFE_INTEGER,
  )
  const isTruncated = requireBoolean(data.is_truncated, 'cart.is_truncated')
  if (isTruncated !== (totalItemCount > itemCount)) {
    throw new ProcurementContractError(
      'cart.is_truncated',
      'must equal total_item_count > item_count',
    )
  }

  const unpricedItemCount = requireIntegerInRange(
    data.unpriced_item_count,
    'cart.unpriced_item_count',
    0,
    totalItemCount,
  )
  const pricedCostEur = requireMoney(data.priced_cost_eur, 'cart.priced_cost_eur', true)
  const totalCostEur = requireNullableMoney(data.total_cost_eur, 'cart.total_cost_eur')
  const totalSuggestedQty = requireNumberInRange(
    data.total_suggested_qty,
    'cart.total_suggested_qty',
    0,
    Number.MAX_SAFE_INTEGER,
  )

  if (!isTruncated) {
    const actualUnpriced = items.filter((item) => item.line_cost_eur === null).length
    const actualPricedCents = items.reduce(
      (sum, item) => sum + (item.line_cost_eur === null ? 0n : toCents(item.line_cost_eur)),
      0n,
    )
    const actualSuggestedQty = roundToScale(
      items.reduce((sum, item) => sum + item.suggested_qty, 0),
      2,
    )

    if (actualUnpriced !== unpricedItemCount) {
      throw new ProcurementContractError(
        'cart.unpriced_item_count',
        `declares ${unpricedItemCount}, calculated ${actualUnpriced}`,
      )
    }
    if (toCents(pricedCostEur) !== actualPricedCents) {
      throw new ProcurementContractError(
        'cart.priced_cost_eur',
        'does not equal the sum of priced line_cost_eur values',
      )
    }
    if (!nearlyEqual(totalSuggestedQty, actualSuggestedQty, QUANTITY_TOLERANCE)) {
      throw new ProcurementContractError(
        'cart.total_suggested_qty',
        'does not equal the sum of item quantities',
      )
    }
  }

  if (unpricedItemCount > 0 && totalCostEur !== null) {
    throw new ProcurementContractError(
      'cart.total_cost_eur',
      'must be null while any item is unpriced',
    )
  }
  if (unpricedItemCount === 0) {
    if (totalCostEur === null || toCents(totalCostEur) !== toCents(pricedCostEur)) {
      throw new ProcurementContractError(
        'cart.total_cost_eur',
        'must equal priced_cost_eur when every item is priced',
      )
    }
  }

  const budgetEur = requireNullableMoney(data.budget_eur, 'cart.budget_eur') ?? 0
  const budgetUsedEur = requireNullableMoney(data.budget_used_eur, 'cart.budget_used_eur') ?? 0
  const valueCapturedEur =
    requireNullableMoney(data.value_captured_eur, 'cart.value_captured_eur') ?? 0
  const selectedCount =
    requireNullableInteger(data.selected_count, 'cart.selected_count', 0, itemCount) ?? 0
  const deferredCount =
    requireNullableInteger(data.deferred_count, 'cart.deferred_count', 0, itemCount) ?? 0
  const methodUsed = normalizeCartMethod(data.method_used)

  if (expectedBudgetEur > 0) {
    if (toCents(budgetEur) !== toCents(expectedBudgetEur)) {
      throw new ProcurementContractError('cart.budget_eur', 'does not match the requested budget')
    }
    if (methodUsed === null) {
      throw new ProcurementContractError('cart.method_used', 'is required for a budget plan')
    }
    if (selectedCount + deferredCount !== itemCount) {
      throw new ProcurementContractError(
        'cart.selected_count',
        'selected_count + deferred_count must equal item_count',
      )
    }

    const selectedItems = items.filter((item) => item.within_budget === true)
    const deferredItems = items.filter((item) => item.within_budget === false)
    if (selectedItems.length !== selectedCount || deferredItems.length !== deferredCount) {
      throw new ProcurementContractError(
        'cart.selected_count',
        'does not match item within_budget decisions',
      )
    }
    const selectedCostCents = selectedItems.reduce(
      (sum, item) => sum + (item.line_cost_eur === null ? 0n : toCents(item.line_cost_eur)),
      0n,
    )
    if (selectedCostCents !== toCents(budgetUsedEur)) {
      throw new ProcurementContractError(
        'cart.budget_used_eur',
        'does not equal selected line costs',
      )
    }
    if (toCents(budgetUsedEur) > toCents(budgetEur)) {
      throw new ProcurementContractError('cart.budget_used_eur', 'exceeds budget_eur')
    }
  }

  return {
    items,
    item_count: itemCount,
    total_item_count: totalItemCount,
    is_truncated: isTruncated,
    duplicate_supplier_options_removed: requireIntegerInRange(
      data.duplicate_supplier_options_removed,
      'cart.duplicate_supplier_options_removed',
      0,
      Number.MAX_SAFE_INTEGER,
    ),
    total_suggested_qty: totalSuggestedQty,
    total_cost_eur: totalCostEur,
    priced_cost_eur: pricedCostEur,
    unpriced_item_count: unpricedItemCount,
    as_of_date: requireNullableString(data.as_of_date, 'cart.as_of_date'),
    budget_eur: budgetEur,
    budget_used_eur: budgetUsedEur,
    value_captured_eur: valueCapturedEur,
    selected_count: selectedCount,
    deferred_count: deferredCount,
    method_used: methodUsed,
    model_version: requireNonEmptyString(data.model_version, 'cart.model_version'),
  }
}

function normalizeCartMethod(value: unknown): CartOptimizeMethod | null {
  if (value === undefined || value === null) {
    return null
  }
  if (typeof value === 'string' && KNOWN_CART_METHODS.includes(value as CartOptimizeMethod)) {
    return value as CartOptimizeMethod
  }

  throw new ProcurementContractError('cart.method_used', 'unknown optimization method')
}

function normalizeReorderSuggestions(value: unknown, path: string): ReorderSuggestion[] {
  return requireArray(value, path).map((item, index) =>
    normalizeReorderSuggestion(item, `${path}[${index}]`),
  )
}

function normalizeReorderSuggestion(value: unknown, path: string): ReorderSuggestion {
  const entry = requireRecord(value, path)
  const productId = requireSafePositiveInteger(entry.product_id, `${path}.product_id`)
  const producerId = requireSafePositiveInteger(entry.producer_id, `${path}.producer_id`)
  const urgency = normalizeUrgency(entry.urgency)

  if (urgency === null) {
    throw new ProcurementContractError(`${path}.urgency`, 'unknown urgency')
  }

  const suggestedQty = requireNumberInRange(
    entry.suggested_qty,
    `${path}.suggested_qty`,
    0,
    MAX_DRAFT_QTY,
  )
  const unitCostEur = requireNullableMoney(entry.unit_cost_eur, `${path}.unit_cost_eur`, false)
  const lineCostEur = requireNullableMoney(entry.line_cost_eur, `${path}.line_cost_eur`)

  if ((unitCostEur === null) !== (lineCostEur === null)) {
    throw new ProcurementContractError(
      `${path}.line_cost_eur`,
      'unit_cost_eur and line_cost_eur must be both present or both null',
    )
  }
  if (
    unitCostEur !== null &&
    lineCostEur !== null &&
    multiplyToCents(unitCostEur, suggestedQty) !== toCents(lineCostEur)
  ) {
    throw new ProcurementContractError(
      `${path}.line_cost_eur`,
      'does not equal unit_cost_eur × suggested_qty to cents',
    )
  }

  return {
    product_id: productId,
    product_name: requireNullableString(entry.product_name, `${path}.product_name`),
    vendor_code: requireNullableString(entry.vendor_code, `${path}.vendor_code`),
    oe_number: requireNullableString(entry.oe_number, `${path}.oe_number`),
    image_url: requireNullableString(entry.image_url, `${path}.image_url`),
    producer_id: producerId,
    producer_name: requireNullableString(entry.producer_name, `${path}.producer_name`),
    suggested_qty: suggestedQty,
    raw_qty: requireNullableNumber(entry.raw_qty, `${path}.raw_qty`, 0),
    moq: requireNullableNumber(entry.moq, `${path}.moq`, 0),
    order_multiple: requireNullableNumber(entry.order_multiple, `${path}.order_multiple`, 0),
    reorder_point: requireNumberInRange(
      entry.reorder_point,
      `${path}.reorder_point`,
      0,
      Number.MAX_SAFE_INTEGER,
    ),
    safety_stock: requireNumberInRange(
      entry.safety_stock,
      `${path}.safety_stock`,
      0,
      Number.MAX_SAFE_INTEGER,
    ),
    lead_demand: requireNullableNumber(entry.lead_demand, `${path}.lead_demand`, 0),
    order_up_to: requireNullableNumber(entry.order_up_to, `${path}.order_up_to`, 0),
    days_of_cover: requireFiniteNumber(entry.days_of_cover, `${path}.days_of_cover`),
    urgency,
    reason: requireNonEmptyString(entry.reason, `${path}.reason`),
    forecast: normalizeForecast(entry.forecast, productId, `${path}.forecast`),
    inventory: normalizeInventory(entry.inventory, productId, `${path}.inventory`),
    unit_cost_eur: unitCostEur,
    line_cost_eur: lineCostEur,
    unit_sale_eur: requireNullableMoney(entry.unit_sale_eur, `${path}.unit_sale_eur`),
    unit_margin_eur: requireNullableFiniteNumber(
      entry.unit_margin_eur,
      `${path}.unit_margin_eur`,
    ),
    applied_service_level: requireNullableNumber(
      entry.applied_service_level,
      `${path}.applied_service_level`,
      0,
      1,
    ),
    abc: requireNullableString(entry.abc, `${path}.abc`),
    xyz: requireNullableString(entry.xyz, `${path}.xyz`),
    quadrant: requireNullableString(entry.quadrant, `${path}.quadrant`),
    seasonal_factor: requireNullableNumber(
      entry.seasonal_factor,
      `${path}.seasonal_factor`,
      0,
    ),
    cheaper_alt: normalizeCheaperAlt(entry.cheaper_alt, `${path}.cheaper_alt`),
    learned_factor: requireNullableNumber(entry.learned_factor, `${path}.learned_factor`, 0),
    value_density: requireNullableNumber(entry.value_density, `${path}.value_density`, 0),
    within_budget: requireNullableBoolean(entry.within_budget, `${path}.within_budget`),
  }
}

function normalizeForecast(value: unknown, productId: number, path: string): ReorderForecast {
  const entry = requireRecord(value, path)
  const nestedProductId = requireSafePositiveInteger(entry.product_id, `${path}.product_id`)

  if (nestedProductId !== productId) {
    throw new ProcurementContractError(`${path}.product_id`, `expected ${productId}`)
  }

  return {
    product_id: nestedProductId,
    mean_daily: requireNumberInRange(entry.mean_daily, `${path}.mean_daily`, 0, Number.MAX_SAFE_INTEGER),
    std_daily: requireNumberInRange(entry.std_daily, `${path}.std_daily`, 0, Number.MAX_SAFE_INTEGER),
    method: requireNonEmptyString(entry.method, `${path}.method`),
    horizon_days: requireIntegerInRange(
      entry.horizon_days,
      `${path}.horizon_days`,
      1,
      Number.MAX_SAFE_INTEGER,
    ),
    forecast_units: requireNumberInRange(
      entry.forecast_units,
      `${path}.forecast_units`,
      0,
      Number.MAX_SAFE_INTEGER,
    ),
  }
}

function normalizeInventory(value: unknown, productId: number, path: string): ReorderInventory {
  const entry = requireRecord(value, path)
  const nestedProductId = requireSafePositiveInteger(entry.product_id, `${path}.product_id`)

  if (nestedProductId !== productId) {
    throw new ProcurementContractError(`${path}.product_id`, `expected ${productId}`)
  }

  const onHand = requireNumberInRange(entry.on_hand, `${path}.on_hand`, 0, Number.MAX_SAFE_INTEGER)
  const reserved = requireNumberInRange(entry.reserved, `${path}.reserved`, 0, Number.MAX_SAFE_INTEGER)
  const onOrder = requireNumberInRange(entry.on_order, `${path}.on_order`, 0, Number.MAX_SAFE_INTEGER)
  const available = requireFiniteNumber(entry.available, `${path}.available`)
  const position = requireFiniteNumber(entry.position, `${path}.position`)

  if (!nearlyEqual(available, onHand - reserved, QUANTITY_TOLERANCE)) {
    throw new ProcurementContractError(`${path}.available`, 'must equal on_hand - reserved')
  }
  if (!nearlyEqual(position, available + onOrder, QUANTITY_TOLERANCE)) {
    throw new ProcurementContractError(`${path}.position`, 'must equal available + on_order')
  }

  return {
    product_id: nestedProductId,
    on_hand: onHand,
    reserved,
    on_order: onOrder,
    available,
    position,
  }
}

function normalizeCheaperAlt(value: unknown, path: string): ReorderCheaperAlt | null {
  if (value === undefined || value === null) {
    return null
  }

  const entry = requireRecord(value, path)

  return {
    producer_id: requireSafePositiveInteger(entry.producer_id, `${path}.producer_id`),
    cost_eur: requireMoney(entry.cost_eur, `${path}.cost_eur`, false),
  }
}

function validateCockpitDraftRequest(supplierId: number, items: CockpitDraftItem[]) {
  assertSafePositiveInteger(supplierId, 'cockpit_draft.supplierId')

  if (!Array.isArray(items) || items.length === 0) {
    throw new ProcurementContractError('cockpit_draft.items', 'at least one product is required')
  }
  if (items.length > MAX_DRAFT_ITEMS) {
    throw new ProcurementContractError(
      'cockpit_draft.items',
      `cannot contain more than ${MAX_DRAFT_ITEMS} products`,
    )
  }

  const productIds = new Set<number>()
  items.forEach((item, index) => {
    const path = `cockpit_draft.items[${index}]`

    if (!item || typeof item !== 'object') {
      throw new ProcurementContractError(path, 'product line must be an object')
    }
    assertSafePositiveInteger(item.productId, `${path}.productId`)
    requireNumberInRange(item.qty, `${path}.qty`, Number.EPSILON, MAX_DRAFT_QTY)

    if (roundToScale(item.qty, DRAFT_QTY_SCALE) !== item.qty) {
      throw new ProcurementContractError(
        `${path}.qty`,
        `cannot have more than ${DRAFT_QTY_SCALE} decimal places`,
      )
    }
    if (productIds.has(item.productId)) {
      throw new ProcurementContractError(`${path}.productId`, 'duplicate product')
    }
    productIds.add(item.productId)
  })
}

function normalizeCockpitDraftResult(
  result: unknown,
  expectedSupplierId: number,
  requestedItems: CockpitDraftItem[],
): CockpitDraftResult {
  const data = requireRecord(unwrap(result), 'cockpit_draft_result')
  const supplierId = requireSafePositiveInteger(
    readField(data, 'SupplierId', 'supplierId'),
    'cockpit_draft_result.SupplierId',
  )
  if (supplierId !== expectedSupplierId) {
    throw new ProcurementContractError(
      'cockpit_draft_result.SupplierId',
      `expected ${expectedSupplierId}`,
    )
  }

  const rawItems = requireArray(
    readField(data, 'Items', 'items'),
    'cockpit_draft_result.Items',
  )
  if (rawItems.length !== requestedItems.length) {
    throw new ProcurementContractError(
      'cockpit_draft_result.Items',
      `expected ${requestedItems.length} lines, received ${rawItems.length}`,
    )
  }

  const seen = new Set<number>()
  const items: CockpitDraftResultItem[] = rawItems.map((value, index) => {
    const path = `cockpit_draft_result.Items[${index}]`
    const entry = requireRecord(value, path)
    const productId = requireSafePositiveInteger(
      readField(entry, 'ProductId', 'productId'),
      `${path}.ProductId`,
    )
    const qty = requireNumberInRange(
      readField(entry, 'Qty', 'qty'),
      `${path}.Qty`,
      Number.EPSILON,
      MAX_DRAFT_QTY,
    )
    const unitPrice = requireMoney(
      readField(entry, 'UnitPrice', 'unitPrice'),
      `${path}.UnitPrice`,
      false,
    )
    const lineNetAmount = requireMoney(
      readField(entry, 'LineNetAmount', 'lineNetAmount'),
      `${path}.LineNetAmount`,
      false,
    )

    if (roundToScale(qty, DRAFT_QTY_SCALE) !== qty) {
      throw new ProcurementContractError(
        `${path}.Qty`,
        `cannot have more than ${DRAFT_QTY_SCALE} decimal places`,
      )
    }
    if (seen.has(productId)) {
      throw new ProcurementContractError(`${path}.ProductId`, 'duplicate product')
    }
    seen.add(productId)
    if (multiplyToCents(unitPrice, qty) !== toCents(lineNetAmount)) {
      throw new ProcurementContractError(
        `${path}.LineNetAmount`,
        'does not equal UnitPrice × Qty to cents',
      )
    }

    return {
      ProductId: productId,
      Qty: qty,
      UnitPrice: unitPrice,
      LineNetAmount: lineNetAmount,
    }
  })

  const resultByProduct = new Map(items.map((item) => [item.ProductId, item]))
  for (const requestedItem of requestedItems) {
    const persisted = resultByProduct.get(requestedItem.productId)

    if (!persisted || persisted.Qty !== requestedItem.qty) {
      throw new ProcurementContractError(
        `cockpit_draft_result.Items[product_id=${requestedItem.productId}]`,
        'persisted quantity does not match the request',
      )
    }
  }

  const totalQty = requireNumberInRange(
    readField(data, 'TotalQty', 'totalQty'),
    'cockpit_draft_result.TotalQty',
    Number.EPSILON,
    MAX_DRAFT_QTY * MAX_DRAFT_ITEMS,
  )
  const totalNetAmount = requireMoney(
    readField(data, 'TotalNetAmount', 'totalNetAmount'),
    'cockpit_draft_result.TotalNetAmount',
    false,
  )
  const calculatedQty = roundToScale(
    items.reduce((sum, item) => sum + item.Qty, 0),
    DRAFT_QTY_SCALE,
  )
  const calculatedNetCents = items.reduce(
    (sum, item) => sum + toCents(item.LineNetAmount),
    0n,
  )

  if (totalQty !== calculatedQty) {
    throw new ProcurementContractError(
      'cockpit_draft_result.TotalQty',
      'does not equal the persisted line quantities',
    )
  }
  if (toCents(totalNetAmount) !== calculatedNetCents) {
    throw new ProcurementContractError(
      'cockpit_draft_result.TotalNetAmount',
      'does not equal the persisted line amounts',
    )
  }

  return {
    OrderId: requireSafePositiveInteger(
      readField(data, 'OrderId', 'orderId'),
      'cockpit_draft_result.OrderId',
    ),
    OrderNumber: requireNonEmptyString(
      readField(data, 'OrderNumber', 'orderNumber'),
      'cockpit_draft_result.OrderNumber',
    ),
    SupplierId: supplierId,
    OrganizationId: requireSafePositiveInteger(
      readField(data, 'OrganizationId', 'organizationId'),
      'cockpit_draft_result.OrganizationId',
    ),
    ClientAgreementId: requireSafePositiveInteger(
      readField(data, 'ClientAgreementId', 'clientAgreementId'),
      'cockpit_draft_result.ClientAgreementId',
    ),
    CurrencyId: requireSafePositiveInteger(
      readField(data, 'CurrencyId', 'currencyId'),
      'cockpit_draft_result.CurrencyId',
    ),
    CurrencyCode: requireNonEmptyString(
      readField(data, 'CurrencyCode', 'currencyCode'),
      'cockpit_draft_result.CurrencyCode',
    ),
    TotalQty: totalQty,
    TotalNetAmount: totalNetAmount,
    Items: items,
  }
}

function normalizeUrgency(value: unknown): ProcurementUrgency | null {
  return KNOWN_URGENCIES.find((urgency) => urgency === value) ?? null
}

function assertUniqueSuggestionProducts(items: ReorderSuggestion[], path: string) {
  const seen = new Set<number>()

  items.forEach((item, index) => {
    if (seen.has(item.product_id)) {
      throw new ProcurementContractError(`${path}[${index}].product_id`, 'duplicate product')
    }
    seen.add(item.product_id)
  })
}

function readField(record: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (key in record) {
      return record[key]
    }
  }

  return undefined
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ProcurementContractError(path, 'expected an object')
  }

  return value as Record<string, unknown>
}

function requireArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new ProcurementContractError(path, 'expected an array')
  }

  return value
}

function assertSafePositiveInteger(value: unknown, path: string): asserts value is number {
  requireSafePositiveInteger(value, path)
}

function requireSafePositiveInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new ProcurementContractError(path, 'must be a positive safe integer')
  }

  return value
}

function requireNullableSafePositiveInteger(value: unknown, path: string): number | null {
  if (value === undefined || value === null) {
    return null
  }

  return requireSafePositiveInteger(value, path)
}

function requireFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ProcurementContractError(path, 'must be a finite number')
  }

  return value
}

function requireNumberInRange(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
): number {
  const number = requireFiniteNumber(value, path)

  if (number < minimum || number > maximum) {
    throw new ProcurementContractError(path, `must be between ${minimum} and ${maximum}`)
  }

  return number
}

function requireNullableNumber(
  value: unknown,
  path: string,
  minimum = Number.NEGATIVE_INFINITY,
  maximum = Number.POSITIVE_INFINITY,
): number | null {
  if (value === undefined || value === null) {
    return null
  }

  return requireNumberInRange(value, path, minimum, maximum)
}

function requireNullableFiniteNumber(value: unknown, path: string): number | null {
  if (value === undefined || value === null) {
    return null
  }

  return requireFiniteNumber(value, path)
}

function requireIntegerInRange(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new ProcurementContractError(path, `must be an integer between ${minimum} and ${maximum}`)
  }

  return value
}

function requireNullableInteger(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
): number | null {
  if (value === undefined || value === null) {
    return null
  }

  return requireIntegerInRange(value, path, minimum, maximum)
}

function requireBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    throw new ProcurementContractError(path, 'must be a boolean')
  }

  return value
}

function requireNullableBoolean(value: unknown, path: string): boolean | null {
  if (value === undefined || value === null) {
    return null
  }

  return requireBoolean(value, path)
}

function requireNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ProcurementContractError(path, 'must be a non-empty string')
  }

  return value
}

function requireNullableString(value: unknown, path: string): string | null {
  if (value === undefined || value === null || value === '') {
    return null
  }
  if (typeof value !== 'string') {
    throw new ProcurementContractError(path, 'must be a string or null')
  }

  return value
}

function requireMoney(value: unknown, path: string, allowZero = true): number {
  return requireNumberInRange(
    value,
    path,
    allowZero ? 0 : Number.EPSILON,
    MAX_MONEY_EUR,
  )
}

function requireNullableMoney(
  value: unknown,
  path: string,
  allowZero = true,
): number | null {
  if (value === undefined || value === null) {
    return null
  }

  return requireMoney(value, path, allowZero)
}

function toCents(value: number): bigint {
  return roundDecimalToScale(decimalParts(value), 2)
}

function multiplyToCents(left: number, right: number): bigint {
  // The service calculates money with Decimal ROUND_HALF_UP. Multiplying the
  // parsed JSON numbers as IEEE-754 values makes valid half-cent ties (4.975)
  // drift below the boundary, so multiply their decimal coefficients instead.
  const leftParts = decimalParts(left)
  const rightParts = decimalParts(right)

  return roundDecimalToScale(
    {
      coefficient: leftParts.coefficient * rightParts.coefficient,
      scale: leftParts.scale + rightParts.scale,
    },
    2,
  )
}

function decimalParts(value: number): { coefficient: bigint; scale: number } {
  if (!Number.isFinite(value)) {
    throw new TypeError('Cannot convert a non-finite number to decimal parts')
  }

  const [mantissa, exponentPart] = value.toString().toLowerCase().split('e')
  const exponent = exponentPart === undefined ? 0 : Number(exponentPart)
  const negative = mantissa.startsWith('-')
  const unsignedMantissa = negative ? mantissa.slice(1) : mantissa
  const [integerPart, fractionPart = ''] = unsignedMantissa.split('.')
  const digits = `${integerPart}${fractionPart}`.replace(/^0+(?=\d)/, '') || '0'
  let coefficient = BigInt(digits)
  let scale = fractionPart.length - exponent

  if (negative) {
    coefficient = -coefficient
  }
  if (scale < 0) {
    coefficient *= 10n ** BigInt(-scale)
    scale = 0
  }

  return { coefficient, scale }
}

function roundDecimalToScale(
  value: { coefficient: bigint; scale: number },
  targetScale: number,
): bigint {
  if (value.scale <= targetScale) {
    return value.coefficient * 10n ** BigInt(targetScale - value.scale)
  }

  const divisor = 10n ** BigInt(value.scale - targetScale)
  const quotient = value.coefficient / divisor
  const remainder = value.coefficient % divisor
  const absoluteRemainder = remainder < 0n ? -remainder : remainder

  if (absoluteRemainder * 2n < divisor) {
    return quotient
  }

  return quotient + (value.coefficient < 0n ? -1n : 1n)
}

function roundToScale(value: number, scale: number): number {
  const factor = 10 ** scale

  return Math.round((value + Number.EPSILON) * factor) / factor
}

function nearlyEqual(left: number, right: number, tolerance: number): boolean {
  return Math.abs(left - right) <= tolerance
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
