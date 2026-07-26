import { describe, expect, it } from 'vitest'
import {
  buildOrderableQtyHint,
  buildReorderExplanation,
  isOrderableQtyAdjusted,
  toOrderableQty,
} from './procurementOrderQty'
import type { ReorderSuggestion } from './procurementTypes'

const identity = (value: string) => value
const formatQty = (value: number) => String(value)

describe('toOrderableQty', () => {
  it('rounds the optimizer fraction up to a whole unit', () => {
    expect(toOrderableQty({ moq: null, order_multiple: null, suggested_qty: 3.87 })).toBe(4)
    expect(toOrderableQty({ moq: null, order_multiple: null, suggested_qty: 843.97 })).toBe(844)
  })

  it('never lowers a quantity that is already whole', () => {
    expect(toOrderableQty({ moq: null, order_multiple: null, suggested_qty: 5 })).toBe(5)
  })

  it('lifts the quantity to the supplier minimum order', () => {
    expect(toOrderableQty({ moq: 10, order_multiple: null, suggested_qty: 3.2 })).toBe(10)
  })

  it('aligns to the order multiple after the minimum', () => {
    expect(toOrderableQty({ moq: 10, order_multiple: 4, suggested_qty: 3.2 })).toBe(12)
    expect(toOrderableQty({ moq: null, order_multiple: 6, suggested_qty: 7.1 })).toBe(12)
  })

  it('keeps zero when nothing is suggested', () => {
    expect(toOrderableQty({ moq: 5, order_multiple: null, suggested_qty: 0 })).toBe(0)
  })
})

describe('buildOrderableQtyHint', () => {
  it('explains the rounding and states that totals stay on the raw quantity', () => {
    const hint = buildOrderableQtyHint(
      { moq: 10, order_multiple: 4, suggested_qty: 3.2 },
      identity,
      formatQty,
    )

    expect(hint).toContain('Розрахунок: 3.2')
    expect(hint).toContain('мінімальна партія 10')
    expect(hint).toContain('кратність 4')
    expect(hint).toContain('суми плану рахуються за розрахунковою кількістю')
  })

  it('stays silent when nothing was adjusted', () => {
    expect(buildOrderableQtyHint({ moq: null, order_multiple: null, suggested_qty: 4 }, identity, formatQty)).toBe('')
    expect(isOrderableQtyAdjusted({ moq: null, order_multiple: null, suggested_qty: 4 })).toBe(false)
  })
})

describe('buildReorderExplanation', () => {
  const suggestion = {
    days_of_cover: 0,
    inventory: { available: 0, on_hand: 0, on_order: 0, position: 0, product_id: 1, reserved: 0 },
    reason: 'position 0 vs reorder_point 3; 0d cover, lead 7d',
    reorder_point: 3,
  } as unknown as ReorderSuggestion

  it('rebuilds the English shorthand as a readable sentence', () => {
    const explanation = buildReorderExplanation(suggestion, identity)

    expect(explanation).toContain('Доступно з урахуванням замовлень 0 шт при точці дозамовлення 3 шт')
    expect(explanation).toContain('запасу вже немає')
    expect(explanation).toContain('постачання 7 дн.')
    expect(explanation).not.toContain('reorder_point')
    expect(explanation).not.toContain('lead')
  })

  it('reports remaining cover when there is stock left', () => {
    const explanation = buildReorderExplanation(
      { ...suggestion, days_of_cover: 21, reason: 'position 5 vs reorder_point 6; 21d cover, lead 7d' },
      identity,
    )

    expect(explanation).toContain('запасу вистачить на 21 дн.')
  })
})
