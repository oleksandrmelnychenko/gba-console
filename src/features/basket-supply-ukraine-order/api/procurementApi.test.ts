import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  createCockpitDraftOrder,
  getBudgetCartPlan,
  getProcurementCharts,
  getProducerPlan,
  getProducerProfile,
  getProductTerms,
  recordFeedback,
  upsertProducerProfile,
  upsertProductTerms,
} from './procurementApi'
import type { ReorderSuggestion } from '../procurementTypes'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('getProducerPlan', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('posts the producer plan request with only_needed and unwraps the envelope', async () => {
    apiRequestMock.mockResolvedValueOnce({ Body: buildFullPlan() })

    const plan = await getProducerPlan(42, '2026-06-15')

    expect(apiRequestMock).toHaveBeenCalledWith('/procurement/producer/plan', {
      method: 'POST',
      body: {
        producer_id: 42,
        as_of_date: '2026-06-15',
        only_needed: true,
      },
    })

    expect(plan.producer_id).toBe(42)
    expect(plan.producer_name).toBe('Acme')
    expect(plan.lead_time_days).toBe(14)
    expect(plan.lead_time_std_days).toBe(2.5)
    expect(plan.lead_time_source).toBe('empirical')
    expect(plan.item_count).toBe(1)
    expect(plan.model_version).toBe('v3')
    expect(plan.items).toHaveLength(1)

    const item = plan.items[0] as ReorderSuggestion

    expect(item).toMatchObject({
      product_id: 100,
      producer_id: 42,
      suggested_qty: 30,
      raw_qty: 27.4,
      moq: 10,
      order_multiple: 5,
      reorder_point: 12,
      safety_stock: 5,
      days_of_cover: 8.5,
      urgency: 'critical',
      reason: 'below reorder point',
      unit_cost_eur: 4.5,
      line_cost_eur: 135,
      unit_sale_eur: 9,
      unit_margin_eur: 4.5,
      applied_service_level: 0.95,
      abc: 'A',
      xyz: 'X',
      quadrant: 'AX',
    })
    expect(item.forecast).toEqual({
      product_id: 100,
      mean_daily: 3.2,
      std_daily: 0.8,
      method: 'croston',
      horizon_days: 30,
      forecast_units: 96,
    })
    expect(item.inventory).toEqual({
      product_id: 100,
      on_hand: 10,
      reserved: 2,
      on_order: 0,
      available: 8,
      position: 8,
    })
    expect(item.cheaper_alt).toEqual({ producer_id: 7, cost_eur: 4.1 })
    expect(item.learned_factor).toBe(1.2)
  })

  it('omits as_of_date from the body when not provided', async () => {
    apiRequestMock.mockResolvedValueOnce({ Body: buildFullPlan() })

    await getProducerPlan(42)

    expect(apiRequestMock).toHaveBeenCalledWith('/procurement/producer/plan', {
      method: 'POST',
      body: {
        producer_id: 42,
        only_needed: true,
      },
    })
  })

  it('tolerates null or absent optional enriched fields', async () => {
    apiRequestMock.mockResolvedValueOnce({
      producer_id: 42,
      producer_name: 'Acme',
      lead_time_days: 7,
      lead_time_std_days: 0,
      lead_time_source: 'default',
      item_count: 1,
      as_of_date: '2026-06-15',
      model_version: 'v3',
      items: [
        buildSuggestion({
          product_id: 200,
          producer_id: 42,
          suggested_qty: 5,
          reorder_point: 3,
          safety_stock: 1,
          days_of_cover: 4,
          urgency: 'normal',
          reason: 'cover low',
          forecast: {
            product_id: 200,
            mean_daily: 1,
            std_daily: 0,
            method: 'naive',
            horizon_days: 30,
            forecast_units: 30,
          },
          inventory: {
            product_id: 200,
            on_hand: 2,
            reserved: 0,
            on_order: 0,
            available: 2,
            position: 2,
          },
          unit_cost_eur: null,
          line_cost_eur: null,
          unit_sale_eur: null,
          unit_margin_eur: null,
          applied_service_level: null,
          abc: null,
          xyz: null,
          quadrant: null,
          cheaper_alt: null,
        }),
      ],
    })

    const plan = await getProducerPlan(42)
    const item = plan.items[0] as ReorderSuggestion

    expect(plan.lead_time_std_days).toBe(0)
    expect(plan.model_version).toBe('v3')
    expect(plan.as_of_date).toBe('2026-06-15')
    expect(item.raw_qty).toBeNull()
    expect(item.moq).toBeNull()
    expect(item.order_multiple).toBeNull()
    expect(item.unit_cost_eur).toBeNull()
    expect(item.line_cost_eur).toBeNull()
    expect(item.unit_sale_eur).toBeNull()
    expect(item.unit_margin_eur).toBeNull()
    expect(item.applied_service_level).toBeNull()
    expect(item.abc).toBeNull()
    expect(item.xyz).toBeNull()
    expect(item.quadrant).toBeNull()
    expect(item.cheaper_alt).toBeNull()
    expect(item.learned_factor).toBeNull()
    expect(item.forecast).toEqual({
      product_id: 200,
      mean_daily: 1,
      std_daily: 0,
      method: 'naive',
      horizon_days: 30,
      forecast_units: 30,
    })
    expect(item.inventory).toEqual({
      product_id: 200,
      on_hand: 2,
      reserved: 0,
      on_order: 0,
      available: 2,
      position: 2,
    })
  })

  it('fails closed for malformed item rows', async () => {
    apiRequestMock.mockResolvedValueOnce({
      producer_id: 42,
      producer_name: 'Acme',
      items: [
        null,
        'noise',
        { producer_id: 42, urgency: 'critical' },
        { product_id: 5, urgency: 'unknown' },
        {
          product_id: 9,
          urgency: 'high',
          cheaper_alt: { producer_id: 'x' },
        },
      ],
    })

    await expect(getProducerPlan(42)).rejects.toThrow('producer_plan.items[0]')
  })

  it('fails closed for a null response', async () => {
    apiRequestMock.mockResolvedValueOnce(null)

    await expect(getProducerPlan(42)).rejects.toThrow('producer_plan')
  })

  it('rejects nested product identity and inventory equation drift', async () => {
    const wrongForecastIdentity = buildFullPlan()
    wrongForecastIdentity.items[0].forecast.product_id = 999
    apiRequestMock.mockResolvedValueOnce({ Body: wrongForecastIdentity })

    await expect(getProducerPlan(42)).rejects.toThrow('forecast.product_id')

    const wrongInventoryEquation = buildFullPlan()
    wrongInventoryEquation.items[0].inventory.position = 999
    apiRequestMock.mockResolvedValueOnce({ Body: wrongInventoryEquation })

    await expect(getProducerPlan(42)).rejects.toThrow('inventory.position')
  })
})

describe('getProducerProfile', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('requests the producer master with the camelCase producerId query and unwraps the envelope', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Body: {
        producer_id: 42,
        service_level_target: 0.97,
        lead_time_override_days: 9,
        ordering_cost_eur: 25,
        holding_rate_pct: 0.18,
        autonomy_level: 2,
        auto_place_max_eur: 500,
      },
    })

    const profile = await getProducerProfile(42)

    expect(apiRequestMock).toHaveBeenCalledWith('/procurement/masters/producer', {
      query: { producerId: 42 },
    })
    expect(profile).toEqual({
      producer_id: 42,
      service_level_target: 0.97,
      lead_time_override_days: 9,
      ordering_cost_eur: 25,
      holding_rate_pct: 0.18,
      autonomy_level: 2,
      auto_place_max_eur: 500,
    })
  })

  it('returns nulls for absent fields when only producer_id is set', async () => {
    apiRequestMock.mockResolvedValueOnce({ producer_id: 42 })

    const profile = await getProducerProfile(42)

    expect(profile).toEqual({
      producer_id: 42,
      service_level_target: null,
      lead_time_override_days: null,
      ordering_cost_eur: null,
      holding_rate_pct: null,
      autonomy_level: null,
      auto_place_max_eur: null,
    })
  })

  it('returns an all-null profile for a null or malformed response', async () => {
    apiRequestMock.mockResolvedValueOnce(null)

    await expect(getProducerProfile(42)).resolves.toEqual({
      producer_id: null,
      service_level_target: null,
      lead_time_override_days: null,
      ordering_cost_eur: null,
      holding_rate_pct: null,
      autonomy_level: null,
      auto_place_max_eur: null,
    })

    apiRequestMock.mockResolvedValueOnce('noise')

    await expect(getProducerProfile(42)).resolves.toEqual({
      producer_id: null,
      service_level_target: null,
      lead_time_override_days: null,
      ordering_cost_eur: null,
      holding_rate_pct: null,
      autonomy_level: null,
      auto_place_max_eur: null,
    })
  })
})

describe('upsertProducerProfile', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('posts only defined numeric fields and omits null or undefined ones', async () => {
    apiRequestMock.mockResolvedValueOnce({ Body: { producer_id: 42, lead_time_override_days: 9 } })

    const saved = await upsertProducerProfile({
      producer_id: 42,
      lead_time_override_days: 9,
      service_level_target: null,
      ordering_cost_eur: undefined,
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/procurement/masters/producer', {
      method: 'POST',
      body: { producer_id: 42, lead_time_override_days: 9 },
    })
    expect(saved.producer_id).toBe(42)
    expect(saved.lead_time_override_days).toBe(9)
    expect(saved.service_level_target).toBeNull()
  })

  it('drops non-finite numbers from the posted body', async () => {
    apiRequestMock.mockResolvedValueOnce({ producer_id: 42 })

    await upsertProducerProfile({
      producer_id: 42,
      service_level_target: Number.NaN,
      lead_time_override_days: 7,
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/procurement/masters/producer', {
      method: 'POST',
      body: { producer_id: 42, lead_time_override_days: 7 },
    })
  })
})

describe('getProductTerms', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('requests the product terms with the camelCase producerId query and normalizes rows', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Body: {
        producer_id: 42,
        terms: [
          { producer_id: 42, product_id: 100, moq: 10, order_multiple: 5, unit_cost_override: 4.2 },
          { producer_id: 42, product_id: 101 },
        ],
      },
    })

    const result = await getProductTerms(42)

    expect(apiRequestMock).toHaveBeenCalledWith('/procurement/masters/product-terms', {
      query: { producerId: 42 },
    })
    expect(result.producer_id).toBe(42)
    expect(result.terms).toEqual([
      { producer_id: 42, product_id: 100, moq: 10, order_multiple: 5, unit_cost_override: 4.2 },
      { producer_id: 42, product_id: 101, moq: null, order_multiple: null, unit_cost_override: null },
    ])
  })

  it('drops malformed term rows and tolerates a null response', async () => {
    apiRequestMock.mockResolvedValueOnce({
      producer_id: 42,
      terms: [null, 'noise', { producer_id: 42 }, { product_id: 9, moq: 3 }],
    })

    const result = await getProductTerms(42)

    expect(result.terms).toHaveLength(1)
    expect(result.terms[0]).toEqual({
      producer_id: null,
      product_id: 9,
      moq: 3,
      order_multiple: null,
      unit_cost_override: null,
    })

    apiRequestMock.mockResolvedValueOnce(null)

    await expect(getProductTerms(42)).resolves.toEqual({ producer_id: null, terms: [] })
  })
})

describe('upsertProductTerms', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('posts producer and product ids with only defined numeric fields', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Body: { producer_id: 42, product_id: 100, moq: 10, order_multiple: 5 },
    })

    const saved = await upsertProductTerms({
      producer_id: 42,
      product_id: 100,
      moq: 10,
      order_multiple: 5,
      unit_cost_override: null,
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/procurement/masters/product-terms', {
      method: 'POST',
      body: { producer_id: 42, product_id: 100, moq: 10, order_multiple: 5 },
    })
    expect(saved).toEqual({
      producer_id: 42,
      product_id: 100,
      moq: 10,
      order_multiple: 5,
      unit_cost_override: null,
    })
  })

  it('returns an all-null term for a malformed response', async () => {
    apiRequestMock.mockResolvedValueOnce('noise')

    await expect(
      upsertProductTerms({ producer_id: 42, product_id: 100, moq: 10 }),
    ).resolves.toEqual({
      producer_id: null,
      product_id: null,
      moq: null,
      order_multiple: null,
      unit_cost_override: null,
    })
  })
})

describe('recordFeedback', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('posts the full body for an accept decision and unwraps the envelope', async () => {
    apiRequestMock.mockResolvedValueOnce({ Body: { id: 'fb-1', action: 'accept' } })

    const saved = await recordFeedback({
      producer_id: 42,
      product_id: 100,
      suggested_qty: 30,
      final_qty: 36,
      action: 'accept',
      abc: 'A',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/procurement/feedback', {
      method: 'POST',
      body: {
        producer_id: 42,
        product_id: 100,
        action: 'accept',
        suggested_qty: 30,
        final_qty: 36,
        abc: 'A',
      },
    })
    expect(saved).toEqual({ id: 'fb-1', action: 'accept' })
  })

  it('always sends action and omits null, undefined, non-finite, or empty fields', async () => {
    apiRequestMock.mockResolvedValueOnce({ Body: { ok: true } })

    await recordFeedback({
      producer_id: 42,
      product_id: 100,
      action: 'dismiss',
      suggested_qty: null,
      final_qty: 0,
      abc: '',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/procurement/feedback', {
      method: 'POST',
      body: {
        producer_id: 42,
        product_id: 100,
        action: 'dismiss',
        final_qty: 0,
      },
    })
  })

  it('forwards the abort signal when provided', async () => {
    apiRequestMock.mockResolvedValueOnce({ Body: {} })
    const controller = new AbortController()

    await recordFeedback({ producer_id: 42, product_id: 100, action: 'edit', final_qty: 25 }, controller.signal)

    expect(apiRequestMock).toHaveBeenCalledWith('/procurement/feedback', {
      method: 'POST',
      body: { producer_id: 42, product_id: 100, action: 'edit', final_qty: 25 },
      signal: controller.signal,
    })
  })

  it('tolerates a malformed response by returning it unwrapped', async () => {
    apiRequestMock.mockResolvedValueOnce('noise')

    await expect(recordFeedback({ producer_id: 42, product_id: 100, action: 'edit' })).resolves.toBe('noise')

    apiRequestMock.mockResolvedValueOnce(null)

    await expect(recordFeedback({ producer_id: 42, product_id: 100, action: 'accept' })).resolves.toBeNull()
  })
})

describe('createCockpitDraftOrder', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('posts the supplier id and items and unwraps the created draft', async () => {
    const draft = buildCockpitDraftResult(42, [
      { productId: 100, qty: 30, unitPrice: 4.5 },
      { productId: 101, qty: 5, unitPrice: 7.25 },
    ])
    apiRequestMock.mockResolvedValueOnce({ Body: draft })

    const created = await createCockpitDraftOrder(42, [
      { productId: 100, qty: 30 },
      { productId: 101, qty: 5 },
    ])

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/ukraine/order/new/cockpit/draft', {
      method: 'POST',
      body: {
        supplierId: 42,
        items: [
          { productId: 100, qty: 30 },
          { productId: 101, qty: 5 },
        ],
      },
    })
    expect(created).toEqual(draft)
  })

  it('forwards the abort signal for a validated request', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Body: buildCockpitDraftResult(42, [{ productId: 100, qty: 1, unitPrice: 4.5 }]),
    })
    const controller = new AbortController()

    await createCockpitDraftOrder(42, [{ productId: 100, qty: 1 }], controller.signal)

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/ukraine/order/new/cockpit/draft', {
      method: 'POST',
      body: { supplierId: 42, items: [{ productId: 100, qty: 1 }] },
      signal: controller.signal,
    })
  })

  it('rejects an empty request before making a network call', async () => {
    await expect(createCockpitDraftOrder(42, [])).rejects.toThrow('cockpit_draft.items')
    expect(apiRequestMock).not.toHaveBeenCalled()
  })

  it('rejects duplicate products and excess quantity precision', async () => {
    await expect(
      createCockpitDraftOrder(42, [
        { productId: 100, qty: 1 },
        { productId: 100, qty: 2 },
      ]),
    ).rejects.toThrow('duplicate product')
    await expect(
      createCockpitDraftOrder(42, [{ productId: 100, qty: 1.0001 }]),
    ).rejects.toThrow('decimal places')
    expect(apiRequestMock).not.toHaveBeenCalled()
  })

  it('fails closed for a malformed or mismatched persisted result', async () => {
    apiRequestMock.mockResolvedValueOnce('noise')

    await expect(createCockpitDraftOrder(42, [{ productId: 100, qty: 30 }])).rejects.toThrow(
      'cockpit_draft_result',
    )

    apiRequestMock.mockResolvedValueOnce({
      Body: buildCockpitDraftResult(42, [{ productId: 100, qty: 29, unitPrice: 4.5 }]),
    })

    await expect(createCockpitDraftOrder(42, [{ productId: 100, qty: 30 }])).rejects.toThrow(
      'persisted quantity',
    )
  })
})

describe('getProcurementCharts', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('preserves product identity fields used by the dashboard table and forecast', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Body: {
        as_of_date: '2026-07-25',
        producer_id: 42,
        top_n: 8,
        model_version: 'procure-hist120-v1',
        urgency_mix: [{ urgency: 'critical', count: 1 }],
        days_of_cover_hist: [{ bucket: '0-7', count: 1 }],
        demand_series: [
          {
            image_url: 'https://cdn.example.test/product.png',
            oe_number: 'OE-100',
            points: [{ is_forecast: true, period: '2026-08', units: 12 }],
            product_id: 100,
            product_name: 'Гальмівний диск',
            vendor_code: 'BR-100',
          },
        ],
        top_items: [
          {
            image_url: 'https://cdn.example.test/product.png',
            oe_number: 'OE-100',
            on_hand: 2,
            producer_id: 42,
            producer_name: 'Brembo',
            product_id: 100,
            product_name: 'Гальмівний диск',
            reorder_point: 10,
            suggested_qty: 8,
            urgency: 'critical',
            vendor_code: 'BR-100',
          },
        ],
      },
    })

    const charts = await getProcurementCharts({ producerId: 42, topN: 8 })

    expect(apiRequestMock).toHaveBeenCalledWith('/procurement/charts', {
      query: { producerId: 42, topN: 8 },
    })
    expect(charts.top_items[0]).toMatchObject({
      image_url: 'https://cdn.example.test/product.png',
      oe_number: 'OE-100',
      producer_id: 42,
      producer_name: 'Brembo',
      product_id: 100,
      product_name: 'Гальмівний диск',
      vendor_code: 'BR-100',
    })
    expect(charts.demand_series[0]).toMatchObject({
      image_url: 'https://cdn.example.test/product.png',
      oe_number: 'OE-100',
      product_id: 100,
      product_name: 'Гальмівний диск',
      vendor_code: 'BR-100',
    })
    expect(charts.model_version).toBe('procure-hist120-v1')
  })
})

describe('getBudgetCartPlan', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('posts the cart request with budget, method, only_needed and unwraps the envelope', async () => {
    apiRequestMock.mockResolvedValueOnce({ Body: buildFullCartPlan() })

    const plan = await getBudgetCartPlan({ budgetEur: 50000, method: 'milp', asOfDate: '2026-06-15' })

    expect(apiRequestMock).toHaveBeenCalledWith('/procurement/cart', {
      method: 'POST',
      body: {
        budget_eur: 50000,
        method: 'milp',
        only_needed: true,
        as_of_date: '2026-06-15',
      },
    })

    expect(plan.budget_eur).toBe(50000)
    expect(plan.budget_used_eur).toBe(225)
    expect(plan.value_captured_eur).toBe(8120.25)
    expect(plan.selected_count).toBe(2)
    expect(plan.deferred_count).toBe(1)
    expect(plan.item_count).toBe(3)
    expect(plan.as_of_date).toBe('2026-06-15')
    expect(plan.method_used).toBe('milp')
    expect(plan.model_version).toBe('procure-hist120-v1')
    expect(plan.items).toHaveLength(3)

    const [first] = plan.items

    expect(first).toMatchObject({
      product_id: 100,
      producer_id: 42,
      suggested_qty: 30,
      line_cost_eur: 135,
      unit_cost_eur: 4.5,
      unit_margin_eur: 4.5,
      urgency: 'critical',
      quadrant: 'AX',
      value_density: 1.25,
      within_budget: true,
    })
  })

  it('omits as_of_date from the body when not provided', async () => {
    apiRequestMock.mockResolvedValueOnce({ Body: buildFullCartPlan(25000, 'greedy') })

    await getBudgetCartPlan({ budgetEur: 25000, method: 'greedy' })

    expect(apiRequestMock).toHaveBeenCalledWith('/procurement/cart', {
      method: 'POST',
      body: {
        budget_eur: 25000,
        method: 'greedy',
        only_needed: true,
      },
    })
  })

  it('rejects an invalid method or non-finite budget before making a network call', async () => {
    await expect(
      getBudgetCartPlan({ budgetEur: Number.NaN, method: 'unknown' as never }),
    ).rejects.toThrow('request.method')
    expect(apiRequestMock).not.toHaveBeenCalled()
  })

  it('forwards the abort signal when provided', async () => {
    apiRequestMock.mockResolvedValueOnce({ Body: buildFullCartPlan(1000, 'greedy') })
    const controller = new AbortController()

    await getBudgetCartPlan({ budgetEur: 1000, method: 'greedy' }, controller.signal)

    expect(apiRequestMock).toHaveBeenCalledWith('/procurement/cart', {
      method: 'POST',
      body: { budget_eur: 1000, method: 'greedy', only_needed: true },
      signal: controller.signal,
    })
  })

  it('preserves explicit unpriced items and validates unpriced totals', async () => {
    apiRequestMock.mockResolvedValueOnce({
      ...buildCartEnvelope({
        budgetEur: 1000,
        items: [
          buildSuggestion({
          product_id: 200,
          producer_id: 42,
          suggested_qty: 5,
          line_cost_eur: null,
          unit_cost_eur: null,
          unit_margin_eur: null,
          value_density: null,
          within_budget: false,
          }),
        ],
        selectedCount: 0,
        deferredCount: 1,
        totalCostEur: null,
        pricedCostEur: 0,
        unpricedItemCount: 1,
      }),
    })

    const plan = await getBudgetCartPlan({ budgetEur: 1000, method: 'greedy' })

    expect(plan.budget_eur).toBe(1000)
    expect(plan.budget_used_eur).toBe(0)
    expect(plan.value_captured_eur).toBe(0)
    expect(plan.selected_count).toBe(0)
    expect(plan.deferred_count).toBe(1)
    expect(plan.item_count).toBe(1)

    const [item] = plan.items

    expect(item?.value_density).toBeNull()
    expect(item?.within_budget).toBe(false)
    expect(item?.line_cost_eur).toBeNull()
  })

  it('fails closed for malformed rows', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Body: {
        budget_eur: 1000,
        items: [
          null,
          'noise',
          { producer_id: 42, urgency: 'critical' },
          { product_id: 5, urgency: 'unknown' },
          { product_id: 9, urgency: 'high', within_budget: false, value_density: 0.4 },
        ],
      },
    })

    await expect(getBudgetCartPlan({ budgetEur: 1000, method: 'greedy' })).rejects.toThrow(
      'cart.items[0]',
    )
  })

  it('fails closed for a null response', async () => {
    apiRequestMock.mockResolvedValueOnce(null)

    await expect(getBudgetCartPlan({ budgetEur: 1000, method: 'greedy' })).rejects.toThrow(
      'cart',
    )
  })

  it('rejects item_count drift and duplicate product options', async () => {
    const wrongCount = buildFullCartPlan()
    wrongCount.item_count = 4
    apiRequestMock.mockResolvedValueOnce({ Body: wrongCount })

    await expect(getBudgetCartPlan({ budgetEur: 50000, method: 'milp' })).rejects.toThrow(
      'cart.item_count',
    )

    const duplicate = buildFullCartPlan()
    const duplicateItem = duplicate.items[1] as Record<string, unknown>
    const duplicateForecast = duplicateItem.forecast as Record<string, unknown>
    const duplicateInventory = duplicateItem.inventory as Record<string, unknown>
    duplicate.items[1] = buildSuggestion({
      ...duplicateItem,
      product_id: 100,
      forecast: { ...duplicateForecast, product_id: 100 },
      inventory: { ...duplicateInventory, product_id: 100 },
    })
    apiRequestMock.mockResolvedValueOnce({ Body: duplicate })

    await expect(getBudgetCartPlan({ budgetEur: 50000, method: 'milp' })).rejects.toThrow(
      'duplicate product',
    )
  })

  it('rejects line-cent and cart-total drift', async () => {
    const wrongLine = buildFullCartPlan()
    wrongLine.items[0].line_cost_eur = 134.99
    apiRequestMock.mockResolvedValueOnce({ Body: wrongLine })

    await expect(getBudgetCartPlan({ budgetEur: 50000, method: 'milp' })).rejects.toThrow(
      'line_cost_eur',
    )

    const wrongTotal = buildFullCartPlan()
    wrongTotal.priced_cost_eur = 284.99
    apiRequestMock.mockResolvedValueOnce({ Body: wrongTotal })

    await expect(getBudgetCartPlan({ budgetEur: 50000, method: 'milp' })).rejects.toThrow(
      'priced_cost_eur',
    )
  })

  it('rejects truncation and unpriced-summary drift', async () => {
    const wrongTruncation = buildFullCartPlan()
    wrongTruncation.is_truncated = true
    apiRequestMock.mockResolvedValueOnce({ Body: wrongTruncation })

    await expect(getBudgetCartPlan({ budgetEur: 50000, method: 'milp' })).rejects.toThrow(
      'is_truncated',
    )

    const wrongUnpriced = buildFullCartPlan()
    wrongUnpriced.unpriced_item_count = 1
    apiRequestMock.mockResolvedValueOnce({ Body: wrongUnpriced })

    await expect(getBudgetCartPlan({ budgetEur: 50000, method: 'milp' })).rejects.toThrow(
      'unpriced_item_count',
    )
  })
})

function buildFullCartPlan(
  budgetEur = 50000,
  method: 'greedy' | 'milp' = 'milp',
) {
  return buildCartEnvelope({
    budgetEur,
    method,
    items: [
      buildSuggestion({
        product_id: 100,
        producer_id: 42,
        suggested_qty: 30,
        urgency: 'critical',
        unit_cost_eur: 4.5,
        line_cost_eur: 135,
        unit_margin_eur: 4.5,
        quadrant: 'AX',
        value_density: 1.25,
        within_budget: true,
      }),
      buildSuggestion({
        product_id: 101,
        producer_id: 42,
        suggested_qty: 12,
        urgency: 'high',
        unit_cost_eur: 7.5,
        line_cost_eur: 90,
        unit_margin_eur: 2.1,
        quadrant: 'BX',
        value_density: 0.8,
        within_budget: true,
      }),
      buildSuggestion({
        product_id: 102,
        producer_id: 7,
        suggested_qty: 4,
        urgency: 'normal',
        unit_cost_eur: 15,
        line_cost_eur: 60,
        unit_margin_eur: 1,
        quadrant: 'CZ',
        value_density: 0.2,
        within_budget: false,
      }),
    ],
    selectedCount: 2,
    deferredCount: 1,
  })
}

function buildFullPlan() {
  return {
    producer_id: 42,
    producer_name: 'Acme',
    lead_time_days: 14,
    lead_time_std_days: 2.5,
    lead_time_source: 'empirical',
    item_count: 1,
    as_of_date: '2026-06-15',
    model_version: 'v3',
    items: [
      buildSuggestion({
        product_id: 100,
        producer_id: 42,
        suggested_qty: 30,
        raw_qty: 27.4,
        moq: 10,
        order_multiple: 5,
        reorder_point: 12,
        safety_stock: 5,
        days_of_cover: 8.5,
        urgency: 'critical',
        reason: 'below reorder point',
        forecast: {
          product_id: 100,
          mean_daily: 3.2,
          std_daily: 0.8,
          method: 'croston',
          horizon_days: 30,
          forecast_units: 96,
        },
        inventory: {
          product_id: 100,
          on_hand: 10,
          reserved: 2,
          on_order: 0,
          available: 8,
          position: 8,
        },
        unit_cost_eur: 4.5,
        line_cost_eur: 135,
        unit_sale_eur: 9,
        unit_margin_eur: 4.5,
        applied_service_level: 0.95,
        abc: 'A',
        xyz: 'X',
        quadrant: 'AX',
        seasonal_factor: 1.1,
        cheaper_alt: { producer_id: 7, cost_eur: 4.1 },
        learned_factor: 1.2,
      }),
    ],
  }
}

function buildSuggestion(overrides: Record<string, unknown> = {}) {
  const productId = typeof overrides.product_id === 'number' ? overrides.product_id : 100
  const producerId = typeof overrides.producer_id === 'number' ? overrides.producer_id : 42
  const suggestedQty =
    typeof overrides.suggested_qty === 'number' ? overrides.suggested_qty : 1
  const unitCost =
    'unit_cost_eur' in overrides ? overrides.unit_cost_eur : 4.5
  const baseForecast = {
    product_id: productId,
    mean_daily: 1,
    std_daily: 0,
    method: 'naive',
    horizon_days: 30,
    forecast_units: 30,
  }
  const baseInventory = {
    product_id: productId,
    on_hand: 10,
    reserved: 2,
    on_order: 0,
    available: 8,
    position: 8,
  }
  const forecast =
    overrides.forecast && typeof overrides.forecast === 'object'
      ? { ...baseForecast, ...(overrides.forecast as Record<string, unknown>) }
      : baseForecast
  const inventory =
    overrides.inventory && typeof overrides.inventory === 'object'
      ? { ...baseInventory, ...(overrides.inventory as Record<string, unknown>) }
      : baseInventory

  return {
    product_id: productId,
    product_name: 'Амортизатор',
    vendor_code: `SEM${productId}`,
    oe_number: `OE-${productId}`,
    image_url: null,
    producer_id: producerId,
    producer_name: 'SEM',
    suggested_qty: suggestedQty,
    raw_qty: null,
    moq: null,
    order_multiple: null,
    reorder_point: 12,
    safety_stock: 5,
    lead_demand: 7,
    order_up_to: 20,
    days_of_cover: 8,
    urgency: 'normal',
    reason: 'below reorder point',
    unit_cost_eur: unitCost,
    line_cost_eur:
      'line_cost_eur' in overrides
        ? overrides.line_cost_eur
        : typeof unitCost === 'number'
          ? Math.round(unitCost * suggestedQty * 100) / 100
          : null,
    unit_sale_eur: 9,
    unit_margin_eur: typeof unitCost === 'number' ? 9 - unitCost : null,
    applied_service_level: 0.95,
    abc: 'A',
    xyz: 'X',
    quadrant: 'AX',
    seasonal_factor: null,
    cheaper_alt: null,
    learned_factor: null,
    value_density: null,
    within_budget: null,
    ...overrides,
    forecast,
    inventory,
  }
}

function buildCartEnvelope({
  budgetEur,
  items,
  method = 'greedy',
  selectedCount,
  deferredCount,
  totalCostEur,
  pricedCostEur,
  unpricedItemCount,
}: {
  budgetEur: number
  items: Array<Record<string, unknown>>
  method?: 'greedy' | 'milp'
  selectedCount: number
  deferredCount: number
  totalCostEur?: number | null
  pricedCostEur?: number
  unpricedItemCount?: number
}) {
  const calculatedPricedCost = items.reduce(
    (sum, item) => sum + (typeof item.line_cost_eur === 'number' ? item.line_cost_eur : 0),
    0,
  )
  const calculatedUnpriced = items.filter((item) => item.line_cost_eur === null).length
  const used = items.reduce(
    (sum, item) =>
      sum +
      (item.within_budget === true && typeof item.line_cost_eur === 'number'
        ? item.line_cost_eur
        : 0),
    0,
  )

  return {
    item_count: items.length,
    total_item_count: items.length,
    is_truncated: false,
    duplicate_supplier_options_removed: 0,
    total_suggested_qty:
      Math.round(
        items.reduce(
          (sum, item) => sum + (typeof item.suggested_qty === 'number' ? item.suggested_qty : 0),
          0,
        ) * 100,
      ) / 100,
    total_cost_eur:
      totalCostEur !== undefined
        ? totalCostEur
        : calculatedUnpriced > 0
          ? null
          : Math.round(calculatedPricedCost * 100) / 100,
    priced_cost_eur:
      pricedCostEur ?? Math.round(calculatedPricedCost * 100) / 100,
    unpriced_item_count: unpricedItemCount ?? calculatedUnpriced,
    as_of_date: '2026-06-15',
    budget_eur: budgetEur,
    budget_used_eur: Math.round(used * 100) / 100,
    value_captured_eur: selectedCount > 0 ? 8120.25 : 0,
    selected_count: selectedCount,
    deferred_count: deferredCount,
    method_used: method,
    model_version: 'procure-hist120-v1',
    items,
  }
}

function buildCockpitDraftResult(
  supplierId: number,
  lines: Array<{ productId: number; qty: number; unitPrice: number }>,
) {
  const items = lines.map((line) => ({
    ProductId: line.productId,
    Qty: line.qty,
    UnitPrice: line.unitPrice,
    LineNetAmount: Math.round(line.qty * line.unitPrice * 100) / 100,
  }))

  return {
    OrderId: 555,
    OrderNumber: 'SO-2026-1',
    SupplierId: supplierId,
    OrganizationId: 10,
    ClientAgreementId: 20,
    CurrencyId: 2,
    CurrencyCode: 'EUR',
    TotalQty: Math.round(items.reduce((sum, item) => sum + item.Qty, 0) * 1000) / 1000,
    TotalNetAmount:
      Math.round(items.reduce((sum, item) => sum + item.LineNetAmount, 0) * 100) / 100,
    Items: items,
  }
}
