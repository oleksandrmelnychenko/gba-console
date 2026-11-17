/** Local calendar day as YYYY-MM-DD (the date input's value format). */
export function localDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${date.getFullYear()}-${month}-${day}`
}

/** True when a YYYY-MM-DD order date is after today in the user's own calendar. */
export function isFutureOrderDate(dateValue: string, now: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return false
  }

  return dateValue > localDateKey(now)
}

export function formatOrderDate(dateValue: string): string {
  const match = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  return match ? `${match[3]}.${match[2]}.${match[1]}` : dateValue
}

export type IncomeConfirmLine = { label: string; value: string }

/**
 * What the create confirmation repeats: a typo in the amount, the payer or the register
 * is caught here, and a future date (the order then drops out of the default registry
 * period while already changing debts and the register) is called out.
 */
export function buildIncomeConfirmLines({
  amount,
  currencyCode,
  date,
  formatMoney,
  payer,
  register,
}: {
  amount: number
  currencyCode?: string | null
  date: string
  formatMoney: (value: number) => string
  payer?: string | null
  register?: string | null
}): IncomeConfirmLine[] {
  return [
    { label: 'Платник', value: payer?.trim() || '—' },
    { label: 'Сума', value: `${formatMoney(amount)} ${currencyCode || ''}`.trim() },
    { label: 'Каса / рахунок', value: register?.trim() || '—' },
    { label: 'Дата', value: formatOrderDate(date) },
  ]
}
