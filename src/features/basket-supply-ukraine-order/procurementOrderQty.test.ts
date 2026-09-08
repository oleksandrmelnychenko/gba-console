import { describe, expect, it } from 'vitest'
import { buildReorderExplanation } from './procurementOrderQty'
import type { ReorderSuggestion } from './procurementTypes'

const identity = (value: string) => value
describe('buildReorderExplanation', () => {
  const suggestion = {
    days_of_cover: 0,
    inventory: { available: 0, on_hand: 0, on_order: 0, position: 0, product_id: 1, reserved: 0 },
    reason: 'position 0 vs reorder_point 3; 0d cover, lead 7d',
    reorder_point: 3,
  } as unknown as ReorderSuggestion

  it('rebuilds the English shorthand as a readable sentence', () => {
    const explanation = buildReorderExplanation(suggestion, identity)

    expect(explanation).toContain('Доступно з урахуванням замовлень 0 при точці дозамовлення 3')
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
