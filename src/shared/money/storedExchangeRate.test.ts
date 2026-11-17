import { describe, expect, it } from 'vitest'
import { formatStoredExchangeRate } from './storedExchangeRate'

describe('formatStoredExchangeRate (outgoing#18, bank#8)', () => {
  it('shows a dash instead of «0» for an order without conversion', () => {
    expect(formatStoredExchangeRate(0)).toBe('—')
    expect(formatStoredExchangeRate(null)).toBe('—')
  })

  it('prints a real rate with a comma', () => {
    expect(formatStoredExchangeRate(51.2)).toBe('51,2')
    expect(formatStoredExchangeRate(1.10822511)).toBe('1,108225')
  })
})
