export function monthsPhrase(months: number): string {
  const tens = months % 100
  const units = months % 10
  const word = tens >= 11 && tens <= 14 ? 'місяців' : units === 1 ? 'місяць' : units >= 2 && units <= 4 ? 'місяці' : 'місяців'
  return `${months} ${word}`
}

export function forecastTitle(subject: string, horizonMonths: number | null | undefined, points: number, isLoading: boolean): string {
  if (!isLoading && points === 0) return `${subject} — недостатньо історії продажів для прогнозу`
  if (horizonMonths == null || !Number.isInteger(horizonMonths) || horizonMonths <= 0) return subject
  return `${subject} на ${monthsPhrase(horizonMonths)}`
}

export const FORECAST_EMPTY_LABEL = 'Прогноз не побудовано: замало місяців з продажами за вибраний період історії'
