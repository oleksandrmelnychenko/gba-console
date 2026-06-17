import { isFiniteNumber } from './chartTheme'

export type ForecastPoint = {
  period: string
  value: number | null | undefined
  forecast?: boolean
}

export type ForecastRow = {
  period: string
  actual: number | null
  forecast: number | null
}

export function buildForecastRows(
  points: ForecastPoint[],
  actualKey = 'actual',
  forecastKey = 'forecast',
): { rows: Record<string, string | number | null>[]; hasActual: boolean; hasForecast: boolean } {
  const firstForecastIndex = points.findIndex((point) => point.forecast === true)
  let hasActual = false
  let hasForecast = false

  const rows = points.map((point, index) => {
    const value = isFiniteNumber(point.value) ? point.value : null
    const isForecast = point.forecast === true
    const isBridge =
      firstForecastIndex > 0 && index === firstForecastIndex - 1

    const actual = isForecast ? null : value
    const forecast = isForecast || isBridge ? value : null

    if (actual !== null) {
      hasActual = true
    }

    if (isForecast && forecast !== null) {
      hasForecast = true
    }

    return { period: point.period, [actualKey]: actual, [forecastKey]: forecast }
  })

  return { rows, hasActual, hasForecast }
}
