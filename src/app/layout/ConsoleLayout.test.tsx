import { describe, expect, it } from 'vitest'
import { isBudgetCartRoute } from './layoutRoutes'

describe('isBudgetCartRoute', () => {
  it('matches the budget cart route with or without a trailing slash', () => {
    expect(isBudgetCartRoute('/basket-supply-ukraine-order/budget-cart')).toBe(true)
    expect(isBudgetCartRoute('/basket-supply-ukraine-order/budget-cart/')).toBe(true)
  })

  it('keeps the global footer on the other procurement routes', () => {
    expect(isBudgetCartRoute('/basket-supply-ukraine-order/cockpit')).toBe(false)
    expect(isBudgetCartRoute('/basket-supply-ukraine-order/dashboard')).toBe(false)
  })
})
