import type { DocumentaryAgreementDebt, DocumentaryDebt, DocumentaryDebtAging } from './documentaryDebtAging'

export function documentaryDebtFixture(patch: Partial<DocumentaryDebt> = {}): DocumentaryDebt {
  return {
    DebtId: '41', ClientId: '7', AgreementId: '9', LocalAmount: 100, ScopeKnown: true,
    ObligationDateBasis: 'native_utc', ObligationBusinessDay: '2026-10-25T00:00:00',
    DueBusinessDay: '2026-10-25T00:00:00', TermDays: 0, DebtAgeDays: 0, DaysPastDue: 0,
    AgingStatus: 'due_today', AgingUnknownReason: null, ...patch,
  }
}

export function documentarySummaryFixture(patch: Partial<DocumentaryAgreementDebt> = {}): DocumentaryAgreementDebt {
  return {
    ClientId: '7', AgreementId: '9', CurrencyId: '1', PositiveDebtTotal: 100, CreditBalance: 0,
    KnownOverdueTotal: 0, KnownNotOverdueTotal: 100, UnknownDateDebtTotal: 0, UnknownTermsDebtTotal: 0,
    KnownOverdueCount: 0, KnownNotOverdueCount: 1, UnknownDateDebtCount: 0, UnknownTermsDebtCount: 0,
    UnknownScopeDebtCount: 0, HasCompleteAging: true, OverdueTotal: 0, MaxKnownDebtAgeDays: 0,
    MaxKnownDaysPastDue: 0, ...patch,
  }
}

export function documentaryOverlayFixture(patch: Partial<DocumentaryDebtAging> = {}): DocumentaryDebtAging {
  return { Version: 1, AsOfBusinessDay: '2026-10-25T00:00:00', TermBasis: 'current_agreement',
    Debts: [documentaryDebtFixture()], Agreements: [documentarySummaryFixture()], ...patch }
}
