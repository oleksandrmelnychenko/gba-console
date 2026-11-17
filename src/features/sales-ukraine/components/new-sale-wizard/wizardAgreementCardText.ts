import type { Agreement } from '../../../clients/types'

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

/* The agreement balance (CurrentAmount) is kept in EUR for every agreement, while
   debts and the credit limit are in the agreement currency. A bare «15,19» on a card
   with a «UAH» chip read as hryvnias, so every amount carries its unit. */
export const AGREEMENT_BALANCE_CURRENCY = 'EUR'

export function formatAgreementMoney(value: number | null, currencyCode: string): string {
  if (value === null) return 'Не визначено'
  const amount = amountFormatter.format(Math.round(value * 100) / 100)
  return currencyCode ? `${amount} ${currencyCode}` : amount
}

/* «Ліміт не налаштовано» was shown for an agreement saved with 100 000 / 30 days whose
   control switches are off: say what is set and that it is not enforced. */
export function describeCreditLimit(
  agreement: Pick<Agreement, 'AmountDebt' | 'NumberDaysDebt' | 'IsControlAmountDebt' | 'IsControlNumberDaysDebt'> | undefined,
  creditLimit: number | null,
  currencyCode: string,
): string {
  const amount = typeof agreement?.AmountDebt === 'number' && agreement.AmountDebt > 0 ? agreement.AmountDebt : 0
  const days = typeof agreement?.NumberDaysDebt === 'number' && agreement.NumberDaysDebt > 0 ? agreement.NumberDaysDebt : 0

  if (creditLimit !== null) {
    const daysPart = days > 0 && agreement?.IsControlNumberDaysDebt ? ` / ${days} дн.` : ''
    return `${formatAgreementMoney(creditLimit, currencyCode)}${daysPart}`
  }

  const parts = [
    amount > 0 ? formatAgreementMoney(amount, currencyCode) : null,
    days > 0 ? `${days} дн.` : null,
  ].filter(Boolean)

  if (parts.length === 0) return 'Ліміт не налаштовано'

  return agreement?.IsControlNumberDaysDebt && days > 0
    ? `${parts.join(' / ')} (контроль суми вимкнено)`
    : `${parts.join(' / ')} (контроль вимкнено)`
}
