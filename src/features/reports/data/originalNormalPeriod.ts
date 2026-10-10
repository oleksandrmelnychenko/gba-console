/** Complete normal journals use inclusive calendar months, including partial first and last months. */
export function originalNormalPeriodError(from: string, through: string): string | null {
  const valid = (value: string) => {
    if (!/^20[2-9][0-9]-\d{2}-\d{2}$/.test(value) || value < '2025-01-01') return false
    const date = new Date(value + 'T00:00:00Z')
    return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value
  }
  const months = (Number(through.slice(0, 4)) - Number(from.slice(0, 4))) * 12
    + Number(through.slice(5, 7)) - Number(from.slice(5, 7)) + 1
  return !valid(from) || !valid(through) || through < from || months > 120
    ? 'Оберіть коректний період від 01.01.2025 до 120 календарних місяців.' : null
}
