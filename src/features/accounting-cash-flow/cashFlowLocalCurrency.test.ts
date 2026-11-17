import { describe, expect, it } from 'vitest'
import { getCashFlowDocumentTitle, getCashFlowLocalCurrency } from './cashFlowLocalCurrency'

describe('getCashFlowLocalCurrency', () => {
  it('labels a payment row with the payment currency', () => {
    // 2 300 UAH paid on a USD agreement: 49.78 USD / UAH 2 300.
    expect(getCashFlowLocalCurrency({ IncomePaymentOrder: { Currency: { Code: 'UAH' } } }, 'USD')).toBe('UAH')
    expect(getCashFlowLocalCurrency({ OutcomePaymentOrder: { Currency: { Code: 'EUR' } } }, 'UAH')).toBe('EUR')
  })

  it('labels a sale on a USD agreement USD, never a hard-coded UAH (currency#10)', () => {
    expect(getCashFlowLocalCurrency({ Sale: {} } as never, 'USD')).toBe('USD')
  })

  it('returns no code when nothing tells the currency', () => {
    expect(getCashFlowLocalCurrency({}, '')).toBe('')
  })
})

describe('getCashFlowDocumentTitle', () => {
  it('uses the document number when the server sends no Name (debts#8)', () => {
    expect(getCashFlowDocumentTitle({ Number: 'QAUНо00000010' })).toBe('QAUНо00000010')
  })

  it('keeps the name when there is one', () => {
    expect(getCashFlowDocumentTitle({ Name: 'Прибутковий ордер', Number: 'QAU1' })).toBe('Прибутковий ордер')
  })

  it('falls back to a dash', () => {
    expect(getCashFlowDocumentTitle({})).toBe('-')
  })
})
