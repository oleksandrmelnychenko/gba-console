const exchangeRateFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 4,
  minimumFractionDigits: 4,
})

export function formatProductMovementExchangeRate(value?: number | null): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? exchangeRateFormatter.format(value)
    : '-'
}
