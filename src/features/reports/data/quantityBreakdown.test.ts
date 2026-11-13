import { describe, expect, it } from 'vitest'
import { isNegativeSingleUnitQuantity, isSingleUnitQuantity, quantityBreakdownText } from './quantityBreakdown'

describe('quantity breakdown text', () => {
  it('keeps each unit part on one line and breaks only between units', () => {
    expect(quantityBreakdownText('3\u00a0420 шт · 593 компл · 35 м · 4 без одиниці'))
      .toBe('3\u00a0420\u00a0шт · 593\u00a0компл · 35\u00a0м · 4\u00a0без\u00a0одиниці')
  })

  it('tells a single-unit quantity from a breakdown and marks only a negative single unit', () => {
    expect(isSingleUnitQuantity('3\u00a0шт')).toBe(true)
    expect(isSingleUnitQuantity('30\u00a0шт · 5\u00a0м')).toBe(false)
    expect(isNegativeSingleUnitQuantity('−2\u00a0шт')).toBe(true)
    expect(isNegativeSingleUnitQuantity('3\u00a0шт')).toBe(false)
    expect(isNegativeSingleUnitQuantity('−3\u00a0м · −2\u00a0шт')).toBe(false)
  })
})
