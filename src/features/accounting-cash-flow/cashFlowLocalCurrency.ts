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

function paymentCurrencyCode(item: AccountingCashFlowHeadItem): string {
  const outcome = item.OutcomePaymentOrder as { PaymentCurrencyRegister?: unknown } | null | undefined

  return currencyCodeOf(item.IncomePaymentOrder)
    || currencyCodeOf(item.OutcomePaymentOrder)
    || currencyCodeOf(outcome?.PaymentCurrencyRegister)
}

/**
 * Second amount of a row in the CLIENT statement. For a payment the server sends the
 * hryvnia value (GetGovExchangedToUahValue): a UAH payment is its own amount, a EUR or USD
 * payment is converted at the NBU rate of the payment date (50 EUR -> UAH 2 511.10 at
 * 50.222), while the agreement amount above it was converted at the commercial rate. The
 * row says so (owner decision: the user is told which rate is used). Other rows keep
 * getCashFlowLocalCurrency.
 */
export function getClientCashFlowLocalAmount(
  item: AccountingCashFlowHeadItem,
  agreementCurrency: string,
): { currency: string; atNbuRate: boolean } {
  if (!item.IncomePaymentOrder && !item.OutcomePaymentOrder) {
    return { currency: getCashFlowLocalCurrency(item, agreementCurrency), atNbuRate: false }
  }

  const paymentCurrency = paymentCurrencyCode(item).toUpperCase()

  return { currency: 'UAH', atNbuRate: paymentCurrency !== '' && paymentCurrency !== 'UAH' }
}

/** «QAUНо00000010» for a row without a Name (the server sends only Number for sales and payments). */
export function getCashFlowDocumentTitle(item: Pick<AccountingCashFlowHeadItem, 'Name' | 'Number'>): string {
  const name = typeof item.Name === 'string' ? item.Name.trim() : ''
  const number = typeof item.Number === 'string' ? item.Number.trim() : ''

  return name || number || '-'
}
