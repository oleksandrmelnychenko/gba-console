const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export function formatMoney(value: number | undefined | null): string {
  if (!value) {
    return ''
  }

  return moneyFormatter.format(value)
}
