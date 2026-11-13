import { describe, expect, it } from 'vitest'
import { agreementCurrencyCodes, resolveCurrencyCode } from './solvencyCurrency'

describe('solvency currency lookup', () => {
  it('collects currency codes from the client agreements', () => {
    expect(agreementCurrencyCodes([
      { Agreement: { CurrencyId: 2, Currency: { Id: 2, Code: 'EUR' } } },
      { Agreement: { CurrencyId: 4, Currency: { Code: ' UAH ' } } },
      { Agreement: { CurrencyId: 5 } },
      {},
    ])).toEqual({ 2: 'EUR', 4: 'UAH' })
    expect(agreementCurrencyCodes(undefined)).toEqual({})
  })

  it('resolves a code from agreements first, then from the payload debt rows', () => {
    const debt = [{ currency_id: 7, currency: 'PLN', lines: 1, amount: 10 }]
    expect(resolveCurrencyCode(2, { 2: 'EUR' }, debt)).toBe('EUR')
    expect(resolveCurrencyCode(7, { 2: 'EUR' }, null, debt)).toBe('PLN')
  })

  it('returns null instead of a guessed code', () => {
    expect(resolveCurrencyCode(9, { 2: 'EUR' }, [{ currency_id: 9, currency: null, lines: 1, amount: 1 }])).toBeNull()
    expect(resolveCurrencyCode(null, { 2: 'EUR' })).toBeNull()
    expect(resolveCurrencyCode(2, undefined)).toBeNull()
  })
})
