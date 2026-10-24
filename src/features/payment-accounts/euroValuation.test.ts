import { expect, it } from 'vitest'
import { formatEuroValuation, readEuroValuation } from './euroValuation'

it.each([null, undefined, '', ' ', 'invalid', Infinity, NaN, false])('keeps unavailable valuation %s distinct from zero', value => {
  expect(readEuroValuation(value)).toBeNull()
  expect(formatEuroValuation(readEuroValuation(value))).toBe('Не визначено')
})
it('preserves known zero and negative valuations', () => {
  expect(readEuroValuation('0')).toBe(0)
  expect(readEuroValuation('-12.34')).toBe(-12.34)
  expect(formatEuroValuation(0)).toBe('0,00')
  expect(formatEuroValuation(-12.34)).toBe('-12,34')
})
