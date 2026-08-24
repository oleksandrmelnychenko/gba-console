import { describe, expect, it } from 'vitest'
import { buildIncomeCashflowCurrencyOptions } from './incomeCashflowCurrencyOptions'

describe('buildIncomeCashflowCurrencyOptions', () => {
  it('shows only the currency in the buyer payment selector when the register has a balance', () => {
    expect(buildIncomeCashflowCurrencyOptions({
      PaymentCurrencyRegisters: [{
        Amount: 5001.08,
        Currency: {
          Code: 'EUR',
          NetUid: 'currency-eur',
        },
      }],
    })).toEqual([{ label: 'EUR', value: 'currency-eur' }])
  })

  it('keeps valid currency options when a balance is not supplied', () => {
    expect(buildIncomeCashflowCurrencyOptions({
      PaymentCurrencyRegisters: [
        {
          Currency: {
            Code: 'UAH',
            NetUid: 'currency-uah',
          },
        },
        {
          Currency: {
            Id: 42,
            Name: 'Євро',
          },
        },
      ],
    })).toEqual([
      { label: 'UAH', value: 'currency-uah' },
      { label: 'Євро', value: '42' },
    ])
  })
})
