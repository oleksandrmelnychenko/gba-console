import { describe, expect, it } from 'vitest'
import { formatProductMovementExchangeRate } from './productMovementFormatters'

describe('formatProductMovementExchangeRate', () => {
  it('keeps the four source decimals required by the product card', () => {
    expect(formatProductMovementExchangeRate(50.9781)).toBe('50,9781')
    expect(formatProductMovementExchangeRate(51.06)).toBe('51,0600')
  })

  it('renders missing or invalid values as unavailable', () => {
    expect(formatProductMovementExchangeRate(undefined)).toBe('-')
    expect(formatProductMovementExchangeRate(Number.NaN)).toBe('-')
  })
})
