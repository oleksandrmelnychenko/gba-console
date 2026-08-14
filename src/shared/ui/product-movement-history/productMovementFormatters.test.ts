import { describe, expect, it } from 'vitest'
import {
  formatProductMovementExchangeRate,
  formatProductMovementUnitPrice,
} from './productMovementFormatters'

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

describe('formatProductMovementUnitPrice', () => {
  it('shows the exact synchronized unit-cost difference for BUG-1111 examples', () => {
    expect(formatProductMovementUnitPrice(1.49649265052695)).toBe('1,4965')
    expect(formatProductMovementUnitPrice(1.49749265052695)).toBe('1,4975')
    expect(formatProductMovementUnitPrice(1.49495805077420)).toBe('1,4950')
    expect(formatProductMovementUnitPrice(1.49612471744087)).toBe('1,4961')
    expect(formatProductMovementUnitPrice(1.62683846424832)).toBe('1,6268')
    expect(formatProductMovementUnitPrice(1.62783846424832)).toBe('1,6278')
  })

  it('renders missing or invalid unit costs as unavailable', () => {
    expect(formatProductMovementUnitPrice(undefined)).toBe('-')
    expect(formatProductMovementUnitPrice(Number.NaN)).toBe('-')
  })
})
