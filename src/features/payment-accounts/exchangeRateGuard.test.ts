import { describe, expect, it } from 'vitest'
import { getExchangeSystemRate, isExchangeRateFarFromSystem } from './exchangeRateGuard'

const rates = [{ Code: 'USD', Amount: 46.2 }, { Code: 'EUR', Amount: 51.2 }]

describe('exchange rate guard', () => {
  it('knows the hryvnia rate of the foreign side in both directions', () => {
    expect(getExchangeSystemRate(rates, 'EUR', 'UAH')).toBe(51.2)
    expect(getExchangeSystemRate(rates, 'UAH', 'USD')).toBe(46.2)
    expect(getExchangeSystemRate(rates, 'EUR', 'USD')).toBeNull()
  })

  it('flags a rate more than 20% away and accepts a normal spread', () => {
    expect(isExchangeRateFarFromSystem(99_999_999_999, 51.2)).toBe(true)
    expect(isExchangeRateFarFromSystem(40, 51.2)).toBe(true)
    expect(isExchangeRateFarFromSystem(50, 51.2)).toBe(false)
    expect(isExchangeRateFarFromSystem(50, null)).toBe(false)
  })
})
