import { describe, expect, it } from 'vitest'
import type { ClientInDebt } from '../types'
import {
  formatCurrencyAmounts,
  getDebtorCurrencyAmounts,
  getDebtorEuroAmount,
  getStructureCurrencyTotals,
  getSummaryCurrencyAmounts,
  hasCurrencyBreakdown,
} from './debtorCurrency'

const multiCurrencyDebtor: ClientInDebt = {
  ClientNetId: 'b36475e5-5773-498f-b465-ef4b2e4ae312',
  CurrencyDebts: [
    {
      CurrencyCode: 'UAH',
      OverdueDebt: 4389.78,
      OverdueDebtEuro: 85.91,
      RemainderDebt: 4389.78,
      RemainderDebtEuro: 85.91,
      TotalDebtInDays: 0,
      TotalDebtInDaysEuro: 0,
    },
    {
      CurrencyCode: 'EUR',
      OverdueDebt: 0,
      OverdueDebtEuro: 0,
      RemainderDebt: 804.11,
      RemainderDebtEuro: 804.11,
      TotalDebtInDays: 804.11,
      TotalDebtInDaysEuro: 804.11,
    },
  ],
  OverdueDebt: 85.91,
  OverdueDebtEuro: 85.91,
  RemainderDebt: 890.02,
  RemainderDebtEuro: 890.02,
  TotalDebtInDays: 804.11,
  TotalDebtInDaysEuro: 804.11,
}

describe('debtorCurrency', () => {
  it('lists each non-zero debt currency in a stable order', () => {
    expect(getDebtorCurrencyAmounts(multiCurrencyDebtor, 'RemainderDebt')).toEqual([
      { amount: 804.11, currencyCode: 'EUR' },
      { amount: 4389.78, currencyCode: 'UAH' },
    ])
    expect(getDebtorCurrencyAmounts(multiCurrencyDebtor, 'OverdueDebt')).toEqual([{ amount: 4389.78, currencyCode: 'UAH' }])
    expect(getDebtorCurrencyAmounts(multiCurrencyDebtor, 'TotalDebtInDays')).toEqual([{ amount: 804.11, currencyCode: 'EUR' }])
  })

  it('reads the euro equivalents from the explicit euro fields', () => {
    expect(getDebtorEuroAmount(multiCurrencyDebtor, 'RemainderDebt')).toBe(890.02)
    expect(getDebtorEuroAmount(multiCurrencyDebtor, 'OverdueDebt')).toBe(85.91)
    expect(getDebtorEuroAmount(multiCurrencyDebtor, 'TotalDebtInDays')).toBe(804.11)
  })

  it('falls back to the legacy euro fields when the server sends no breakdown', () => {
    const legacy: ClientInDebt = { OverdueDebt: 433.3855, RemainderDebt: 433.3855, TotalDebtInDays: 35773 }

    expect(hasCurrencyBreakdown(legacy)).toBe(false)
    expect(getDebtorCurrencyAmounts(legacy, 'RemainderDebt')).toEqual([])
    expect(getDebtorEuroAmount(legacy, 'RemainderDebt')).toBe(433.3855)
    expect(getDebtorEuroAmount(legacy, 'TotalDebtInDays')).toBe(0)
  })

  it('summarises the footer per currency', () => {
    const amounts = getSummaryCurrencyAmounts(
      [
        { CurrencyCode: 'UAH', OverdueDebt: 4181286.99, RemainderDebt: 9400025.48 },
        { CurrencyCode: 'EUR', OverdueDebt: 39757.31, RemainderDebt: 44708.81 },
      ],
      'RemainderDebt',
    )

    expect(formatCurrencyAmounts(amounts, (value) => value.toFixed(2))).toBe('44708.81 EUR · 9400025.48 UAH')
  })

  it('uses the structure currency breakdown and keeps the legacy totals readable', () => {
    expect(
      getStructureCurrencyTotals({
        Currencies: [
          { CurrencyCode: 'UAH', Total: 35773, TotalInEuro: 700.06 },
          { CurrencyCode: 'PLN', Total: 0, TotalInEuro: 0 },
        ],
        TotalEuro: 0,
        TotalLocal: 35773,
      }),
    ).toEqual([{ CurrencyCode: 'UAH', Total: 35773, TotalInEuro: 700.06 }])
    expect(getStructureCurrencyTotals({ TotalEuro: 65.26, TotalLocal: 50804.28 })).toEqual([
      { CurrencyCode: 'EUR', Total: 65.26, TotalInEuro: 65.26 },
      { CurrencyCode: '', Total: 50804.28 },
    ])
    expect(getStructureCurrencyTotals(null)).toEqual([])
  })
})
