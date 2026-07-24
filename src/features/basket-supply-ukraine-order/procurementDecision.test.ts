import { describe, expect, it } from 'vitest'
import type { ReorderSuggestion } from './procurementTypes'
import { calculateProcurementDecision } from './procurementDecision'

describe('calculateProcurementDecision', () => {
  it('explains whether stock can last through the supplier lead time', () => {
    const decision = calculateProcurementDecision(
      suggestion({
        forecast: { mean_daily: 2, std_daily: 0.4, method: 'croston', horizon_days: 30, forecast_units: 60 },
        inventory: { on_hand: 10, reserved: 2, on_order: 0, available: 8, position: 8 },
        lead_demand: 12,
        unit_cost_eur: 4.5,
      }),
      30,
    )

    expect(decision).toMatchObject({
      arrivalPosition: 38,
      isArrivalRisk: true,
      leadTimeDays: 6,
      selectedCostEur: 135,
      stockoutDays: 4,
    })
  })

  it('uses reorder inputs when enriched target fields are absent', () => {
    const decision = calculateProcurementDecision(
      suggestion({
        lead_demand: null,
        order_up_to: null,
        reorder_point: 20,
        safety_stock: 6,
        suggested_qty: 12,
      }),
      10,
    )

    expect(decision.leadDemand).toBe(14)
    expect(decision.orderUpTo).toBe(32)
  })

  it('keeps timing unknown when the forecast has no daily demand', () => {
    const decision = calculateProcurementDecision(
      suggestion({
        forecast: { mean_daily: 0, std_daily: 0, method: 'none', horizon_days: 30, forecast_units: 0 },
      }),
      5,
    )

    expect(decision.leadTimeDays).toBeNull()
    expect(decision.stockoutDays).toBeNull()
    expect(decision.isArrivalRisk).toBe(false)
  })
})

function suggestion(overrides: Partial<ReorderSuggestion> = {}): ReorderSuggestion {
  return {
    abc: 'A',
    applied_service_level: 0.95,
    cheaper_alt: null,
    days_of_cover: 4,
    forecast: {
      forecast_units: 60,
      horizon_days: 30,
      mean_daily: 2,
      method: 'croston',
      std_daily: 0.4,
    },
    image_url: null,
    inventory: {
      available: 8,
      on_hand: 10,
      on_order: 0,
      position: 8,
      reserved: 2,
    },
    lead_demand: 12,
    learned_factor: null,
    line_cost_eur: 135,
    moq: null,
    oe_number: null,
    order_multiple: null,
    order_up_to: 38,
    producer_id: 42,
    producer_name: 'Acme',
    product_id: 100,
    product_name: 'Товар',
    quadrant: 'AX',
    raw_qty: 30,
    reason: '',
    reorder_point: 18,
    safety_stock: 6,
    suggested_qty: 30,
    unit_cost_eur: 4.5,
    unit_margin_eur: 3,
    unit_sale_eur: 7.5,
    urgency: 'critical',
    value_density: null,
    vendor_code: 'SKU-100',
    within_budget: null,
    xyz: 'X',
    ...overrides,
  }
}
