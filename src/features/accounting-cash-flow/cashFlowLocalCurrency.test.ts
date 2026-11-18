import { describe, expect, it } from 'vitest'
import { getCashFlowDocumentTitle, getCashFlowLocalCurrency, getClientCashFlowLocalAmount } from './cashFlowLocalCurrency'

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

describe('getClientCashFlowLocalAmount', () => {
  it('labels the hryvnia equivalent of a EUR or USD payment as converted at the NBU rate', () => {
    // 50 EUR payment: the server sends UAH 2 511.10 (x 50.222 NBU), not EUR.
    expect(getClientCashFlowLocalAmount({ IncomePaymentOrder: { Currency: { Code: 'EUR' } } }, 'EUR')).toEqual({ currency: 'UAH', atNbuRate: true })
    expect(getClientCashFlowLocalAmount({ OutcomePaymentOrder: { PaymentCurrencyRegister: { Currency: { Code: 'USD' } } } } as never, 'USD')).toEqual({ currency: 'UAH', atNbuRate: true })
  })

  it('shows a hryvnia payment as its own amount, without an NBU note', () => {
    expect(getClientCashFlowLocalAmount({ IncomePaymentOrder: { Currency: { Code: 'UAH' } } }, 'EUR')).toEqual({ currency: 'UAH', atNbuRate: false })
  })

  it('keeps the document currency for sales', () => {
    expect(getClientCashFlowLocalAmount({ Sale: {} } as never, 'USD')).toEqual({ currency: 'USD', atNbuRate: false })
  })
})
