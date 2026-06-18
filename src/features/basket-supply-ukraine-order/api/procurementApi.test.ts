import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getProducerPlan } from './procurementApi'
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
    expect(item.unit_cost_eur).toBeNull()
    expect(item.line_cost_eur).toBeNull()
    expect(item.unit_sale_eur).toBeNull()
    expect(item.unit_margin_eur).toBeNull()
    expect(item.applied_service_level).toBeNull()
    expect(item.abc).toBeNull()
    expect(item.xyz).toBeNull()
    expect(item.quadrant).toBeNull()
    expect(item.cheaper_alt).toBeNull()
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
      },
    ],
  }
}
