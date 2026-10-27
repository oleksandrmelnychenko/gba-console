import { describe, expect, it } from 'vitest'
import type { ClientInDebt } from '../types'
import {
  formatCurrencyAmounts,
  formatCurrentRateNote,
  getCurrentRateLabels,
  getDebtorCurrencyAmounts,
  getDebtorEuroAmount,
  getDebtBalanceLines,
  getStructureCurrencyTotals,
  getSummaryCurrencyAmounts,
  hasCurrencyBreakdown,
  hasForeignAdvance,
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
  it('preserves explicit unknown euro values rather than falling back to old amounts', () => {
    const unknown: ClientInDebt = {
      RemainderDebt: 999,
      RemainderDebtEuro: null,
      OverdueDebt: 888,
      OverdueDebtEuro: null,
      TotalDebtInDaysEuro: null,
      CreditBalanceEuro: null,
    }
    for (const field of ['RemainderDebt', 'OverdueDebt', 'TotalDebtInDays', 'CreditBalance'] as const) {
      expect(getDebtorEuroAmount(unknown, field)).toBeNull()
    }
    expect(getDebtorEuroAmount({ RemainderDebtEuro: 0, RemainderDebt: 999 }, 'RemainderDebt')).toBe(0)
    expect(getDebtorEuroAmount({ RemainderDebt: null }, 'RemainderDebt')).toBeNull()
    expect(getDebtorEuroAmount({ RemainderDebtEuro: 1.2345 }, 'RemainderDebt')).toBe(1.2345)
  })

  it('retains credit-only and unknown structure currencies without netting them into debt', () => {
    const credit = { CurrencyCode: 'USD', Total: 0, TotalInEuro: 0, CreditBalance: 25, CreditBalanceEuro: null }
    const unknown = { CurrencyCode: 'UAH', Total: 100, TotalInEuro: null }
    expect(getStructureCurrencyTotals({ Currencies: [credit, unknown] })).toEqual([credit, unknown])
    expect(getDebtorCurrencyAmounts({ CurrencyDebts: [{ CurrencyCode: 'USD', RemainderDebt: 100, CreditBalance: 25 }] }, 'RemainderDebt'))
      .toEqual([{ currencyCode: 'USD', amount: 100 }])
    expect(getDebtorCurrencyAmounts({ CurrencyDebts: [{ CurrencyCode: 'USD', RemainderDebt: 100, CreditBalance: 25 }] }, 'CreditBalance'))
      .toEqual([{ currencyCode: 'USD', amount: 25 }])
  })

  it('uses currency breakdown and unknown total in sale/payment summaries without assuming UAH', () => {
    expect(getDebtBalanceLines({
      TotalEuro: 99, TotalLocal: 999, TotalInEuro: null, CreditBalanceEuro: null,
      Currencies: [{ CurrencyCode: 'USD', Total: 100, CreditBalance: 20, CreditBalanceEuro: null }],
    })).toEqual([
      { label: 'Борг', currencyCode: 'USD', value: 100 },
      { label: 'Кредитовий залишок', currencyCode: 'USD', value: 20 },
      { label: 'Борг, EUR', currencyCode: 'EUR', value: null },
      { label: 'Кредитовий залишок, EUR', currencyCode: 'EUR', value: null },
    ])
    expect(getDebtBalanceLines({ TotalLocal: 100 })).toEqual([{ label: 'Борг', currencyCode: '', value: 100 }])
    expect(getDebtBalanceLines({ TotalInEuro: 0 })).toEqual([{ label: 'Борг, EUR', currencyCode: 'EUR', value: 0 }])
  })

})

describe('current-rate debt notes', () => {
  it('names each foreign currency rate once, skips EUR and legacy payloads, and marks missing rates', () => {
    expect(getCurrentRateLabels([
      { CurrencyCode: 'UAH', EuroRate: 51.4, EuroRateDate: '2026-10-26T00:00:00' },
      { CurrencyCode: 'EUR', EuroRate: 1 },
      { CurrencyCode: 'UAH', EuroRate: 99 },
      { CurrencyCode: 'USD', EuroRate: 1.12227074 },
      { CurrencyCode: 'PLN', EuroRate: null },
      { CurrencyCode: 'CZK' },
    ])).toEqual(['PLN: курс не визначено', '51,40 UAH/EUR на 26.10.2026', '1,1223 USD/EUR'])
    expect(formatCurrentRateNote([{ CurrencyCode: 'UAH', EuroRate: 51.4, EuroRateDate: '2026-10-26T00:00:00' }]))
      .toBe('за поточним курсом 51,40 UAH/EUR на 26.10.2026')
    expect(formatCurrentRateNote([{ CurrencyCode: 'EUR', EuroRate: 1 }])).toBeNull()
  })

  it('reports foreign advances and exposes advance and net balance in EUR', () => {
    expect(hasForeignAdvance([{ CurrencyCode: 'EUR', AdvanceEuro: 5 }])).toBe(false)
    expect(hasForeignAdvance([{ CurrencyCode: 'UAH', AdvanceEuro: 3 }])).toBe(true)
    expect(getDebtorEuroAmount({ AdvanceEuro: 33, NetBalanceEuro: 117 }, 'Advance')).toBe(33)
    expect(getDebtorEuroAmount({ AdvanceEuro: 33, NetBalanceEuro: 117 }, 'NetBalance')).toBe(117)
    expect(getDebtorEuroAmount({ RemainderDebtEuro: 10 }, 'NetBalance')).toBe(10)
    expect(getDebtorEuroAmount({ NetBalanceEuro: null }, 'NetBalance')).toBeNull()
  })
})
