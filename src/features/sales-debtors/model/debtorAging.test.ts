import { describe, expect, it } from 'vitest'
import { getAgingDateLabel, getKnownAgingDays, getKnownOverdueEuro, getMaximumKnownAgingDays, hasIncompleteAging } from './debtorAging'
import { getDebtorCurrencyAmounts, getDebtorEuroAmount, getDebtBalanceLines } from './debtorCurrency'
import { agingFixture } from './debtorAging.testData'

describe('canonical debt aging presentation', () => {
  it('uses the known subtotal even when the complete overdue aliases are unknown', () => {
    const Aging = agingFixture({ KnownOverdue: 20, KnownOverdueEuro: 10, KnownOverdueCount: 1, UnknownDateDebt: 80, UnknownDateDebtEuro: null, UnknownDateDebtCount: 1, HasCompleteAging: false, MaxKnownDaysPastDue: 7 })
    const row = { Aging, OverdueDebt: null, OverdueDebtEuro: null, CurrencyDebts: [{ CurrencyCode: 'USD', OverdueDebt: null, Aging }] }
    expect(getDebtorEuroAmount(row, 'OverdueDebt')).toBe(10)
    expect(getDebtorCurrencyAmounts(row, 'OverdueDebt')).toEqual([{ currencyCode: 'USD', amount: 20 }])
    expect(hasIncompleteAging(Aging)).toBe(true)
  })

  it('keeps FX unknown separate from known aging, and only falls back when Aging is absent', () => {
    const Aging = agingFixture({ KnownOverdueCount: 1, KnownOverdueEuro: null, MaxKnownDaysPastDue: 4 })
    expect(getKnownOverdueEuro({ Aging }, 999)).toBeNull()
    expect(getKnownAgingDays(Aging)).toBe(4)
    expect(hasIncompleteAging(Aging)).toBe(false)
    expect(getKnownOverdueEuro({ Aging: null }, 999)).toBeNull()
    expect(getKnownOverdueEuro({}, 42)).toBe(42)
    expect(getKnownOverdueEuro({}, null)).toBeNull()
  })

  it('preserves unknown days, known zero and maximum without summing document ages', () => {
    const unknown = agingFixture({ HasCompleteAging: false, UnknownTermsDebtCount: 2 })
    expect(getKnownAgingDays(unknown)).toBeNull()
    expect(getMaximumKnownAgingDays([unknown, null])).toBeNull()
    expect(getMaximumKnownAgingDays([unknown, agingFixture({ MaxKnownDaysPastDue: 0 })])).toBe(0)
    expect(getMaximumKnownAgingDays([agingFixture({ MaxKnownDaysPastDue: 3 }), agingFixture({ MaxKnownDaysPastDue: 7 }), unknown])).toBe(7)
  })

  it('keeps the business calendar day without timezone conversion', () => {
    expect(getAgingDateLabel('2026-10-25T00:00:00')).toBe('25.10.2026')
    expect(getAgingDateLabel('2026-03-29')).toBe('29.03.2026')
    expect(getAgingDateLabel(undefined)).toBeNull()
  })

  it('shares known overdue and separate credit with sale/payment read summaries', () => {
    const Aging = agingFixture({ KnownOverdue: 20, KnownOverdueEuro: 10, KnownOverdueCount: 1, UnknownTermsDebtCount: 1, HasCompleteAging: false })
    expect(getDebtBalanceLines({ TotalInEuro: 50, OverdueInEuro: null, CreditBalanceEuro: 5, Aging,
      Currencies: [{ CurrencyCode: 'USD', Total: 100, CreditBalance: 10, Aging }],
    })).toEqual([
      { label: 'Борг', currencyCode: 'USD', value: 100 },
      { label: 'Кредитовий залишок', currencyCode: 'USD', value: 10 },
      { label: 'Борг, EUR', currencyCode: 'EUR', value: 50 },
      { label: 'Кредитовий залишок, EUR', currencyCode: 'EUR', value: 5 },
      { label: 'Відоме прострочення', currencyCode: 'USD', value: 20 },
      { label: 'Відоме прострочення, EUR', currencyCode: 'EUR', value: 10 },
    ])
  })
})
