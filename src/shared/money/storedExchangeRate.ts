/**
 * «Курс» of a saved cash order. The server stores 0 when no conversion happened
 * (payment and agreement in the same currency), which read as «Курс 0».
 */
export function formatStoredExchangeRate(rate: unknown): string {
  const value = typeof rate === 'number' ? rate : typeof rate === 'string' ? Number(rate.replace(',', '.')) : Number.NaN

  if (!Number.isFinite(value) || value <= 0) {
    return '—'
  }

  return String(Math.round(value * 1_000_000) / 1_000_000).replace('.', ',')
}
