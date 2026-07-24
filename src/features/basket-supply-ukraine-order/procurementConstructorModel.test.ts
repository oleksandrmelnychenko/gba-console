import { describe, expect, it } from 'vitest'
import type { ReorderSuggestion } from './procurementTypes'
import {
  filterProcurementRows,
  getProcurementOrderQuantity,
  procurementLineKey,
} from './procurementConstructorModel'

describe('procurement constructor model', () => {
  it('keeps the same product from different producers as separate order lines', () => {
    const first = suggestion({ producer_id: 501, product_id: 42 })
    const second = suggestion({ producer_id: 777, product_id: 42 })

    expect(procurementLineKey(first)).toBe('501:42')
    expect(procurementLineKey(second)).toBe('777:42')
    expect(new Set([procurementLineKey(first), procurementLineKey(second)]).size).toBe(2)
  })

  it('reads new composite draft quantities and remains compatible with old sessions', () => {
    const row = suggestion({ producer_id: 501, product_id: 42, suggested_qty: 6 })

    expect(getProcurementOrderQuantity({ '501:42': 9, 42: 3 }, row)).toBe(9)
    expect(getProcurementOrderQuantity({ 42: 3 }, row)).toBe(3)
    expect(getProcurementOrderQuantity({}, row)).toBe(6)
  })

  it('searches the operational fields and preserves the original rows when query is empty', () => {
    const rows = [
      suggestion({
        oe_number: 'OE-441',
        producer_id: 501,
        producer_name: 'Meyle',
        product_name: 'Гальмівний диск',
        vendor_code: 'BR-2048',
      }),
      suggestion({
        producer_id: 777,
        producer_name: 'Lemforder',
        product_id: 77,
        product_name: 'Сайлентблок',
      }),
    ]

    expect(filterProcurementRows(rows, '')).toBe(rows)
    expect(filterProcurementRows(rows, 'meyle')).toEqual([rows[0]])
    expect(filterProcurementRows(rows, 'OE-441')).toEqual([rows[0]])
    expect(filterProcurementRows(rows, '77')).toEqual([rows[1]])
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
      available: 2,
      on_hand: 2,
      on_order: 0,
      position: 2,
      reserved: 0,
    },
    lead_demand: 12,
    learned_factor: null,
    line_cost_eur: 30,
    moq: null,
    oe_number: null,
    order_multiple: null,
    order_up_to: 38,
    producer_id: 501,
    producer_name: 'Meyle',
    product_id: 42,
    product_name: 'Гальмівний диск',
    quadrant: 'AX',
    raw_qty: 6,
    reason: '',
    reorder_point: 18,
    safety_stock: 6,
    suggested_qty: 6,
    unit_cost_eur: 5,
    unit_margin_eur: 3,
    unit_sale_eur: 8,
    urgency: 'critical',
    value_density: null,
    vendor_code: 'BR-2048',
    within_budget: null,
    xyz: 'X',
    ...overrides,
  }
}
