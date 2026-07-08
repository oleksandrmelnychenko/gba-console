import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  createCockpitDraftOrder,
  getBudgetCartPlan,
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
      mean_daily: 3.2,
      std_daily: 0.8,
      method: 'croston',
      horizon_days: 30,
      forecast_units: 96,
    })
    expect(item.inventory).toEqual({
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
      lead_time_source: 'default',
      item_count: 1,
      items: [
        {
          product_id: 200,
          producer_id: 42,
          suggested_qty: 5,
          reorder_point: 3,
          safety_stock: 1,
          days_of_cover: 4,
          urgency: 'normal',
          reason: 'cover low',
          forecast: { mean_daily: 1 },
          inventory: { on_hand: 2 },
          unit_cost_eur: null,
          line_cost_eur: null,
          unit_sale_eur: null,
          unit_margin_eur: null,
          applied_service_level: null,
          abc: null,
          xyz: null,
          quadrant: null,
          cheaper_alt: null,
        },
      ],
    })

    const plan = await getProducerPlan(42)
    const item = plan.items[0] as ReorderSuggestion

    expect(plan.lead_time_std_days).toBe(0)
    expect(plan.model_version).toBe('')
    expect(plan.as_of_date).toBeNull()
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
      mean_daily: 1,
      std_daily: 0,
      method: '',
      horizon_days: 0,
      forecast_units: 0,
    })
    expect(item.inventory).toEqual({
      on_hand: 2,
      reserved: 0,
      on_order: 0,
      available: 0,
      position: 0,
    })
  })

  it('drops malformed item rows and a malformed cheaper_alt', async () => {
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

    const plan = await getProducerPlan(42)

    expect(plan.items).toHaveLength(1)
    expect(plan.items[0]?.product_id).toBe(9)
    expect(plan.items[0]?.urgency).toBe('high')
    expect(plan.items[0]?.cheaper_alt).toBeNull()
    expect(plan.item_count).toBe(1)
  })

  it('returns an empty plan for a null response', async () => {
    apiRequestMock.mockResolvedValueOnce(null)

    await expect(getProducerPlan(42)).resolves.toEqual({
      producer_id: null,
      producer_name: '',
      lead_time_days: 0,
      lead_time_std_days: 0,
      lead_time_source: '',
      item_count: 0,
      as_of_date: null,
      model_version: '',
      items: [],
    })
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
    apiRequestMock.mockResolvedValueOnce({ Body: { Id: 555, Number: 'SO-2026-1' } })

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
    expect(created).toEqual({ Id: 555, Number: 'SO-2026-1' })
  })

  it('forwards the abort signal and posts an empty items array when none are given', async () => {
    apiRequestMock.mockResolvedValueOnce({ Body: { Id: 1 } })
    const controller = new AbortController()

    await createCockpitDraftOrder(42, [], controller.signal)

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/ukraine/order/new/cockpit/draft', {
      method: 'POST',
      body: { supplierId: 42, items: [] },
      signal: controller.signal,
    })
  })

  it('tolerates a malformed response by returning it unwrapped', async () => {
    apiRequestMock.mockResolvedValueOnce('noise')

    await expect(createCockpitDraftOrder(42, [{ productId: 100, qty: 30 }])).resolves.toBe('noise')

    apiRequestMock.mockResolvedValueOnce(null)

    await expect(createCockpitDraftOrder(42, [{ productId: 100, qty: 30 }])).resolves.toBeNull()
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
    expect(plan.budget_used_eur).toBe(42350.5)
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
    apiRequestMock.mockResolvedValueOnce({ Body: buildFullCartPlan() })

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

  it('falls back to greedy and zero budget for an invalid method or non-finite budget', async () => {
    apiRequestMock.mockResolvedValueOnce({ Body: buildFullCartPlan() })

    await getBudgetCartPlan({ budgetEur: Number.NaN, method: 'unknown' as never })

    expect(apiRequestMock).toHaveBeenCalledWith('/procurement/cart', {
      method: 'POST',
      body: {
        budget_eur: 0,
        method: 'greedy',
        only_needed: true,
      },
    })
  })

  it('forwards the abort signal when provided', async () => {
    apiRequestMock.mockResolvedValueOnce({ Body: buildFullCartPlan() })
    const controller = new AbortController()

    await getBudgetCartPlan({ budgetEur: 1000, method: 'greedy' }, controller.signal)

    expect(apiRequestMock).toHaveBeenCalledWith('/procurement/cart', {
      method: 'POST',
      body: { budget_eur: 1000, method: 'greedy', only_needed: true },
      signal: controller.signal,
    })
  })

  it('defaults budget fields to zero and tolerates null optional item fields', async () => {
    apiRequestMock.mockResolvedValueOnce({
      items: [
        {
          product_id: 200,
          producer_id: 42,
          suggested_qty: 5,
          urgency: 'normal',
          line_cost_eur: null,
          unit_cost_eur: null,
          unit_margin_eur: null,
          value_density: null,
          within_budget: null,
        },
      ],
    })

    const plan = await getBudgetCartPlan({ budgetEur: 1000, method: 'greedy' })

    expect(plan.budget_eur).toBe(0)
    expect(plan.budget_used_eur).toBe(0)
    expect(plan.value_captured_eur).toBe(0)
    expect(plan.selected_count).toBe(0)
    expect(plan.deferred_count).toBe(0)
    expect(plan.item_count).toBe(1)

    const [item] = plan.items

    expect(item?.value_density).toBeNull()
    expect(item?.within_budget).toBeNull()
    expect(item?.line_cost_eur).toBeNull()
  })

  it('drops malformed item rows and coerces within_budget false', async () => {
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

    const plan = await getBudgetCartPlan({ budgetEur: 1000, method: 'greedy' })

    expect(plan.items).toHaveLength(1)
    expect(plan.items[0]?.product_id).toBe(9)
    expect(plan.items[0]?.within_budget).toBe(false)
    expect(plan.items[0]?.value_density).toBe(0.4)
    expect(plan.item_count).toBe(1)
  })

  it('returns an empty cart plan for a null response', async () => {
    apiRequestMock.mockResolvedValueOnce(null)

    await expect(getBudgetCartPlan({ budgetEur: 1000, method: 'greedy' })).resolves.toEqual({
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
    })
  })
})

function buildFullCartPlan() {
  return {
    item_count: 3,
    as_of_date: '2026-06-15',
    budget_eur: 50000,
    budget_used_eur: 42350.5,
    value_captured_eur: 8120.25,
    selected_count: 2,
    deferred_count: 1,
    method_used: 'milp',
    model_version: 'procure-hist120-v1',
    items: [
      {
        product_id: 100,
        producer_id: 42,
        suggested_qty: 30,
        urgency: 'critical',
        line_cost_eur: 135,
        unit_cost_eur: 4.5,
        unit_margin_eur: 4.5,
        quadrant: 'AX',
        value_density: 1.25,
        within_budget: true,
      },
      {
        product_id: 101,
        producer_id: 42,
        suggested_qty: 12,
        urgency: 'high',
        line_cost_eur: 90,
        unit_cost_eur: 7.5,
        unit_margin_eur: 2.1,
        quadrant: 'BX',
        value_density: 0.8,
        within_budget: true,
      },
      {
        product_id: 102,
        producer_id: 7,
        suggested_qty: 4,
        urgency: 'normal',
        line_cost_eur: 60,
        unit_cost_eur: 15,
        unit_margin_eur: 1,
        quadrant: 'CZ',
        value_density: 0.2,
        within_budget: false,
      },
    ],
  }
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
      {
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
          mean_daily: 3.2,
          std_daily: 0.8,
          method: 'croston',
          horizon_days: 30,
          forecast_units: 96,
        },
        inventory: {
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
        cheaper_alt: { producer_id: 7, cost_eur: 4.1 },
        learned_factor: 1.2,
      },
    ],
  }
}
