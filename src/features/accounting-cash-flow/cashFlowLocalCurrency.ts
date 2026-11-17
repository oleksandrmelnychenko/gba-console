import type { AccountingCashFlowHeadItem } from './types'

function currencyCodeOf(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const currency = (value as { Currency?: unknown }).Currency

  if (!currency || typeof currency !== 'object') return ''
  const code = (currency as { Code?: unknown }).Code

  return typeof code === 'string' ? code.trim() : ''
}

/**
 * Currency of a statement row's second amount (CurrentValueLocal).
 *
 * CurrentValue is in the agreement currency; CurrentValueLocal is the document's own
 * amount: a 2 300 UAH payment on a USD agreement is 49.78 / UAH 2 300.00, a sale on a
 * USD agreement is in USD. The label used to be hard-coded «UAH», so a USD sale read as
 * «UAH 138.53». Returns '' when the currency is unknown (the amount is then shown
 * without a code rather than with a wrong one).
 */
export function getCashFlowLocalCurrency(item: AccountingCashFlowHeadItem, agreementCurrency: string): string {
  const documentCurrency = currencyCodeOf(item.IncomePaymentOrder) || currencyCodeOf(item.OutcomePaymentOrder)

  return documentCurrency || agreementCurrency.trim()
}

/** «QAUНо00000010» for a row without a Name (the server sends only Number for sales and payments). */
export function getCashFlowDocumentTitle(item: Pick<AccountingCashFlowHeadItem, 'Name' | 'Number'>): string {
  const name = typeof item.Name === 'string' ? item.Name.trim() : ''
  const number = typeof item.Number === 'string' ? item.Number.trim() : ''

  return name || number || '-'
}
