const exchangeRateFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 4,
  minimumFractionDigits: 4,
})

const unitPriceFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 4,
  minimumFractionDigits: 4,
  roundingMode: 'trunc',
})

export function formatProductMovementExchangeRate(value?: number | null): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? exchangeRateFormatter.format(value)
    : '-'
}

export function formatProductMovementUnitPrice(value?: number | null): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? unitPriceFormatter.format(value)
    : '-'
}
