import type { DebtCurrencyAging } from '../types'

export function agingFixture(overrides: Partial<DebtCurrencyAging> = {}): DebtCurrencyAging {
  return {
    KnownOverdueCount: 0, KnownNotOverdueCount: 0, UnknownDateDebtCount: 0, UnknownTermsDebtCount: 0,
    KnownOverdue: 0, KnownNotOverdue: 0, UnknownDateDebt: 0, UnknownTermsDebt: 0,
    KnownOverdueEuro: 0, KnownNotOverdueEuro: 0, UnknownDateDebtEuro: 0, UnknownTermsDebtEuro: 0,
    MaxKnownDaysPastDue: null, HasCompleteAging: true, AsOfBusinessDay: '2026-10-24T00:00:00', TermBasis: 'current_agreement',
    ...overrides,
  }
}
