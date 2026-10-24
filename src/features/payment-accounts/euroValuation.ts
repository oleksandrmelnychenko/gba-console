const formatter = new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function readEuroValuation(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string' || !value.trim()) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function formatEuroValuation(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? formatter.format(value) : 'Не визначено'
}
