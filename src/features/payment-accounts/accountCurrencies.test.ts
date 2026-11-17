import { describe, expect, it } from 'vitest'
import { getCurrencyCodes } from './accountCurrencies'

describe('getCurrencyCodes', () => {
  it('lists every currency of a multi-currency cash account', () => {
    expect(getCurrencyCodes({
      PaymentCurrencyRegisters: [
        { Amount: 1000, Currency: { Code: 'EUR' }, NetUid: 'r-eur' },
        { Amount: 5000, Currency: { Code: 'UAH' }, NetUid: 'r-uah' },
      ],
    })).toBe('EUR, UAH')
  })

  it('has nothing for an account without registers', () => {
    expect(getCurrencyCodes({})).toBeUndefined()
  })
})
