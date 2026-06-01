const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export function formatMoney(value: number | undefined | null): string {
  if (value === undefined || value === null) {
    return ''
  }

  return moneyFormatter.format(value)
}
