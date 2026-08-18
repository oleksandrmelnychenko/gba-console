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
  it('does not round a synchronized unit cost above its source value', () => {
    expect(formatProductMovementUnitPrice(1.49649265052695)).toBe('1,4964')
    expect(formatProductMovementUnitPrice(1.49749265052695)).toBe('1,4974')
    expect(formatProductMovementUnitPrice(1.49495805077420)).toBe('1,4949')
    expect(formatProductMovementUnitPrice(1.49612471744087)).toBe('1,4961')
    expect(formatProductMovementUnitPrice(1.62683846424832)).toBe('1,6268')
    expect(formatProductMovementUnitPrice(1.62783846424832)).toBe('1,6278')
  })

  it('truncates the exact BUG-1132 costs to the four displayed decimals', () => {
    expect(formatProductMovementUnitPrice(1.49627496527016)).toBe('1,4962')
    expect(formatProductMovementUnitPrice(1.62803464706762)).toBe('1,6280')
  })

  it('pads an exact unit cost to four decimal places', () => {
    expect(formatProductMovementUnitPrice(1.5)).toBe('1,5000')
  })

  it('renders missing or invalid unit costs as unavailable', () => {
    expect(formatProductMovementUnitPrice(undefined)).toBe('-')
    expect(formatProductMovementUnitPrice(Number.NaN)).toBe('-')
  })
})
