const axisFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 0 })

export function formatAxisMoney(value: number): string {
  return `${axisFormatter.format(value)}\u00a0EUR`
}
