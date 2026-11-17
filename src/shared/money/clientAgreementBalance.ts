/**
 * A client agreement's balance (ClientAgreement.CurrentAmount, the unspent advance)
 * is stored by the server in EUR for every agreement currency: a 777,77 UAH advance
 * is 15,19 there. It must never be printed with the agreement's own currency code.
 */
export const CLIENT_AGREEMENT_BALANCE_CURRENCY = 'EUR'

export function formatClientAgreementBalance(
  currentAmount: number | null | undefined,
  formatMoney: (value: number) => string,
): string {
  const amount = typeof currentAmount === 'number' && Number.isFinite(currentAmount) ? currentAmount : 0

  return `${formatMoney(amount)} ${CLIENT_AGREEMENT_BALANCE_CURRENCY}`
}
