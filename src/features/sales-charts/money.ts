const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export function formatMoney(value: number | undefined | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return ''
  }

  return moneyFormatter.format(value)
}
