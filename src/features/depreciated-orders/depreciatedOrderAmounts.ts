/** Write-off amounts are in EUR: the printed act's currency (the server sends no currency field). */
export const WRITE_OFF_CURRENCY = 'EUR'

const moneyFormat = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

export function formatWriteOffMoney(value?: number | null): string {
  return typeof value === 'number' && Number.isFinite(value) ? moneyFormat.format(value) : '-'
}

/** Page total of the registry: the sum of the loaded acts' amounts; null when none has an amount. */
export function sumWriteOffAmounts(orders: ReadonlyArray<{ Amount?: number | null }>): number | null {
  const amounts = orders
    .map((order) => order.Amount)
    .filter((amount): amount is number => typeof amount === 'number' && Number.isFinite(amount))

  return amounts.length > 0 ? Math.round(amounts.reduce((sum, amount) => sum + amount, 0) * 100) / 100 : null
}
