import { describe, expect, it } from 'vitest'
import type { ProcurementTopItem, ReorderSuggestion } from './procurementTypes'
import {
  compareLineCostUnpricedLast,
  formatSuggestedQtyByUnit,
  isBelowReorderPoint,
  summarizeDraftCost,
  topItemShortage,
  unpricedLinesNote,
} from './procurementTotals'

const t = (value: string) => value
const nbsp = (value: string) => value.replace(/\u00a0/g, ' ')

describe('procurementTotals', () => {
  it('prints suggested quantities per unit of measure instead of one mixed sum', () => {
    expect(nbsp(formatSuggestedQtyByUnit({ шт: 22861, компл: 2187, м: 3179.19 }, t) ?? '')).toBe(
      '22 861 шт · 2 187 компл · 3 179,19 м',
    )
    expect(formatSuggestedQtyByUnit({ '': 4, шт: 0 }, t)).toBe('4 без одиниці')
    expect(formatSuggestedQtyByUnit(null, t)).toBeNull()
    expect(formatSuggestedQtyByUnit(undefined, t)).toBeNull()
    expect(formatSuggestedQtyByUnit({}, t)).toBeNull()
  })

  it('measures the shortage against the position the service decides on', () => {
    const base: ProcurementTopItem = { product_id: 1, suggested_qty: 5, on_hand: 10, reorder_point: 12, urgency: 'high' }
    const evidence = {
      available: 4, reserved: 6, on_order: 3, forecast_method: 'naive', forecast_units: 1, forecast_horizon_days: 30,
      unit_cost_eur: null, line_cost_eur: null, cost_coverage: 'none', budget_eligible: false, reason: 'r',
    }

    expect(topItemShortage({ ...base, evidence })).toBe(5)
    expect(topItemShortage({ ...base, evidence: { ...evidence, position: 9 } })).toBe(3)
    expect(topItemShortage({ ...base, evidence: { ...evidence, on_order: 30 } })).toBe(0)
    expect(topItemShortage(base)).toBe(2)
  })

  it('flags a line below the reorder point by position, not by free stock alone', () => {
    const line = (position: number, available: number) => ({
      reorder_point: 10, inventory: { product_id: 1, on_hand: available, reserved: 0, on_order: position - available, available, position },
    }) as ReorderSuggestion

    expect(isBelowReorderPoint(line(4, 4))).toBe(true)
    expect(isBelowReorderPoint(line(24, 4))).toBe(false)
  })

  it('totals priced draft lines and counts the unpriced ones separately', () => {
    const line = (unit: number | null, lineCost: number | null, qty: number) => ({
      unit_cost_eur: unit, line_cost_eur: lineCost, suggested_qty: qty,
    }) as ReorderSuggestion
    const summary = summarizeDraftCost(
      [line(5, 30, 6), line(null, 20, 4), line(null, null, 7)],
      (item) => item.suggested_qty,
    )

    expect(summary).toEqual({ lineCount: 3, pricedCost: 50, unpricedCount: 1 })
  })

  it('words the unpriced note for every Ukrainian plural form and stays silent for zero', () => {
    expect(unpricedLinesNote(0, t)).toBeNull()
    expect(unpricedLinesNote(1, t)).toBe('1 рядок без ціни не враховано')
    expect(unpricedLinesNote(3, t)).toBe('3 рядки без ціни не враховано')
    expect(unpricedLinesNote(5, t)).toBe('5 рядків без ціни не враховано')
    expect(unpricedLinesNote(12, t)).toBe('12 рядків без ціни не враховано')
    expect(unpricedLinesNote(21, t)).toBe('21 рядок без ціни не враховано')
  })

  it('sorts unpriced lines after every priced line', () => {
    expect([null, 0, 12, null, 3].toSorted(compareLineCostUnpricedLast)).toEqual([12, 3, 0, null, null])
  })
})
