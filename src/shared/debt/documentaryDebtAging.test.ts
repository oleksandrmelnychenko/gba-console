import { describe, expect, it } from 'vitest'
import { documentaryAgreementPresentation, documentaryBusinessDate, omitDocumentaryAgreementRead, documentaryDebtAge, documentaryIdentity, findDocumentaryDebt, indexDocumentaryDebt, omitDocumentaryDebtAging } from './documentaryDebtAging'
import { documentaryDebtFixture, documentaryOverlayFixture, documentarySummaryFixture } from './documentaryDebtAging.test-fixtures'

const row = { ClientId: 7, AgreementId: 9, DebtId: 41, Debt: { Id: 41, Days: 90 } }
const scope = { ClientId: 7, Agreement: { Id: 9 } }
const indexed = (overlay = documentaryOverlayFixture()) => indexDocumentaryDebt({ DocumentaryDebtAging: overlay })

describe('documentary debt read presentation', () => {
  it('only an omitted overlay permits legacy age; explicit null and missing entries remain unknown', () => {
    expect(documentaryDebtAge(indexDocumentaryDebt({}), row)).toBe(90)
    expect(documentaryDebtAge(indexDocumentaryDebt({ DocumentaryDebtAging: null }), row)).toBeNull()
    expect(documentaryDebtAge(indexed(documentaryOverlayFixture({ Debts: [] })), row)).toBeNull()
  })
  it('shows known zero without reusing legacy age90 or credit-control fields', () => {
    expect(documentaryDebtAge(indexed(), row)).toBe(0)
    expect(documentaryAgreementPresentation(indexed(), scope)).toMatchObject({ ageDays: 0, overdueDays: 0, overdue: false, complete: true })
  })
  it('keeps exact string IDs beyond JS safe integer and refuses rounded number identities', () => {
    expect(documentaryIdentity('9007199254740993')).toBe('9007199254740993')
    expect(documentaryIdentity(9007199254740992)).toBeNull()
    const index = indexed(documentaryOverlayFixture({ Debts: [documentaryDebtFixture({ DebtId: '9007199254740993' })] }))
    expect(documentaryDebtAge(index, { DebtId: '9007199254740993' })).toBe(0)
  })
  it('does not reinterpret ClientInDebt.Id as DebtId', () => {
    expect(findDocumentaryDebt(indexed(), { Debt: { Days: 90 } })).toBeNull()
  })
  it.each([
    { DebtId: 42 }, { Debt: { Id: 42, Days: 90 } }, { ClientId: 8 }, { AgreementId: 10 },
  ])('refuses conflicting exact ownership/identity %j', (patch) => {
    expect(documentaryDebtAge(indexed(), { ...row, ...patch })).toBeNull()
  })
  it('unknown scope never borrows a plausible old age', () => {
    expect(documentaryDebtAge(indexed(documentaryOverlayFixture({ Debts: [documentaryDebtFixture({ ScopeKnown: false, DebtAgeDays: 99 })] })), row)).toBeNull()
  })
  it('duplicate IDs do not use last-write-wins', () => {
    const overlay = documentaryOverlayFixture({ Debts: [documentaryDebtFixture(), documentaryDebtFixture({ DebtAgeDays: 8 })], Agreements: [documentarySummaryFixture(), documentarySummaryFixture()] })
    expect(documentaryDebtAge(indexed(overlay), row)).toBeNull()
    expect(documentaryAgreementPresentation(indexed(overlay), scope).summary).toBeNull()
  })
  it('reports a known partial maximum and overdue amount without claiming a complete total', () => {
    const overlay = documentaryOverlayFixture({ Agreements: [documentarySummaryFixture({ PositiveDebtTotal: 150, KnownOverdueTotal: 100, KnownOverdueCount: 1, KnownNotOverdueCount: 0, UnknownDateDebtCount: 1, UnknownDateDebtTotal: 50, HasCompleteAging: false, OverdueTotal: null, MaxKnownDaysPastDue: 12, MaxKnownDebtAgeDays: 42 })] })
    expect(documentaryAgreementPresentation(indexed(overlay), scope)).toMatchObject({ complete: false, overdue: true, overdueDays: 12, ageDays: 42, knownOverdue: 100, unknownCount: 1 })
    expect(overlay.Agreements[0].OverdueTotal).toBeNull()
  })
  it('all-unknown aging is not a known-zero or no-overdue claim', () => {
    const overlay = documentaryOverlayFixture({ Debts: [documentaryDebtFixture({ AgingStatus: 'unknown_date', DebtAgeDays: null, DaysPastDue: null })], Agreements: [documentarySummaryFixture({ KnownNotOverdueCount: 0, UnknownDateDebtCount: 1, HasCompleteAging: false, OverdueTotal: null, MaxKnownDebtAgeDays: null, MaxKnownDaysPastDue: null })] })
    expect(documentaryDebtAge(indexed(overlay), row)).toBeNull()
    expect(documentaryAgreementPresentation(indexed(overlay), scope)).toMatchObject({ overdue: null, ageDays: null, overdueDays: null, complete: false })
  })
  it('positive debt and credit remain separate despite net balance zero', () => {
    const overlay = documentaryOverlayFixture({ Agreements: [documentarySummaryFixture({ PositiveDebtTotal: 100, CreditBalance: 100, KnownOverdueTotal: 100, KnownOverdueCount: 1, KnownNotOverdueCount: 0, MaxKnownDaysPastDue: 12 })] })
    expect(documentaryAgreementPresentation(indexed(overlay), scope)).toMatchObject({ positiveDebt: 100, creditBalance: 100, knownOverdue: 100, overdue: true })
  })
  it('does not mix or fallback between explicitly unavailable and older broader overlays', () => {
    const index = indexDocumentaryDebt({ DocumentaryDebtAging: null }, { DocumentaryDebtAging: documentaryOverlayFixture() })
    expect(index.present).toBe(true)
    expect(documentaryDebtAge(index, row)).toBeNull()
  })
  it('omitting read metadata preserves business fields and does not mutate input', () => {
    const original = { Id: 9, CurrentAmount: 35, DocumentaryDebtAging: documentaryOverlayFixture() }
    expect(omitDocumentaryDebtAging(original)).toEqual({ Id: 9, CurrentAmount: 35 })
    expect(original.DocumentaryDebtAging.Version).toBe(1)
  })
})

it('keeps all business-day labels calendar based across midnight and DST', () => {
  for (const value of ['2026-10-25T00:00:00', '2026-10-25']) expect(documentaryBusinessDate(value)).toBe('25.10.2026')
  expect(documentaryBusinessDate('2026-03-29T00:00:00')).toBe('29.03.2026')
  expect(documentaryBusinessDate(null)).toBeNull()
})
it('preserves sale selection/credit-control fields while removing documentary read wrappers', () => {
  const selection = { Id: 17, ClientId: 7, AgreementId: 9,
    Client: { Id: 7, DocumentaryDebtAging: documentaryOverlayFixture() },
    Agreement: { Id: 9, DebtAgeDays: 90, OverdueDays: 60, IsOverdue: true },
    DocumentaryDebtAging: documentaryOverlayFixture(), CurrentAmount: 23,
  }
  expect(omitDocumentaryAgreementRead(selection)).toEqual({ Id: 17, ClientId: 7, AgreementId: 9, Client: { Id: 7 }, Agreement: { Id: 9, DebtAgeDays: 90, OverdueDays: 60, IsOverdue: true }, CurrentAmount: 23 })
  expect(selection.DocumentaryDebtAging.Version).toBe(1)
})

it('known documentary age does not invent due days when payment terms are unknown', () => {
  const overlay = documentaryOverlayFixture({
    Debts: [documentaryDebtFixture({ DebtAgeDays: 42, DaysPastDue: null, TermDays: null, AgingStatus: 'unknown_terms', AgingUnknownReason: 'invalid_terms' })],
    Agreements: [documentarySummaryFixture({ MaxKnownDebtAgeDays: 42, MaxKnownDaysPastDue: null, KnownNotOverdueCount: 0, UnknownTermsDebtCount: 1, HasCompleteAging: false, OverdueTotal: null })],
  })
  const index = indexDocumentaryDebt({ DocumentaryDebtAging: overlay })
  expect(documentaryDebtAge(index, { DebtId: 41, Debt: { Days: 90 } })).toBe(42)
  expect(documentaryAgreementPresentation(index, { ClientId: 7, AgreementId: 9 })).toMatchObject({ ageDays: 42, overdueDays: null, overdue: null, complete: false })
})
