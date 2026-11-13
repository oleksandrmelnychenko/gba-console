const formatters = new Map<number, Intl.NumberFormat>()

export function formatRatioPercent(ratio: number, maximumFractionDigits = 0): string {
  let formatter = formatters.get(maximumFractionDigits)
  if (!formatter) {
    formatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits })
    formatters.set(maximumFractionDigits, formatter)
  }

  const percent = ratio * 100
  const isNegative = percent < 0 && Number(Math.abs(percent).toFixed(maximumFractionDigits)) !== 0

  return `${isNegative ? '\u2212' : ''}${formatter.format(Math.abs(percent))}\u00a0%`
}
