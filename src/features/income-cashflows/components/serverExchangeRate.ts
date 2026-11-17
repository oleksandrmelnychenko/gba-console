/** Rate shown with up to 6 decimals and a comma; empty / 0 is «—». */
export function formatServerExchangeRate(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    return '—'
  }

  return String(Math.round(value * 1_000_000) / 1_000_000).replace('.', ',')
}
