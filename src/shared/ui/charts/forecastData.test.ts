import { describe, expect, it } from 'vitest'
import { buildForecastRows } from './forecastData'

describe('buildForecastRows', () => {
  it('splits actual and forecast and bridges the seam point', () => {
    const { rows, hasActual, hasForecast } = buildForecastRows([
      { period: 'Jan', value: 10 },
      { period: 'Feb', value: 12 },
      { period: 'Mar', value: 14, forecast: true },
      { period: 'Apr', value: 16, forecast: true },
    ])

    expect(hasActual).toBe(true)
    expect(hasForecast).toBe(true)
    expect(rows[1]).toMatchObject({ actual: 12, forecast: 12 })
    expect(rows[2]).toMatchObject({ actual: null, forecast: 14 })
  })

  it('handles a history-only series with no forecast segment', () => {
    const { rows, hasActual, hasForecast } = buildForecastRows([
      { period: 'Jan', value: 10 },
      { period: 'Feb', value: 12 },
    ])

    expect(hasActual).toBe(true)
    expect(hasForecast).toBe(false)
    expect(rows.every((row) => row.forecast === null)).toBe(true)
  })

  it('reports empty when every value is null', () => {
    const { hasActual, hasForecast } = buildForecastRows([
      { period: 'Jan', value: null },
      { period: 'Feb', value: undefined },
    ])

    expect(hasActual).toBe(false)
    expect(hasForecast).toBe(false)
  })
})
