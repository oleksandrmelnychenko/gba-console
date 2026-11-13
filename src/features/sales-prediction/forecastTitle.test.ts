import { describe, expect, it } from 'vitest'
import { forecastTitle, monthsPhrase } from './forecastTitle'

describe('forecast title', () => {
  it('states the server horizon, not the number of returned points', () => {
    expect(forecastTitle('Прогноз продажів по клієнту: А', 6, 4, false)).toBe('Прогноз продажів по клієнту: А на 6 місяців')
  })

  it('declines the month word', () => {
    expect([1, 2, 4, 5, 11, 12, 21, 22, 25].map(monthsPhrase))
      .toEqual(['1 місяць', '2 місяці', '4 місяці', '5 місяців', '11 місяців', '12 місяців', '21 місяць', '22 місяці', '25 місяців'])
  })

  it('says there is not enough history instead of «на 0 місяців»', () => {
    expect(forecastTitle('Прогноз продажів по клієнту: А', 6, 0, false))
      .toBe('Прогноз продажів по клієнту: А — недостатньо історії продажів для прогнозу')
  })

  it('omits the horizon while it is unknown or loading', () => {
    expect(forecastTitle('Прогноз', undefined, 3, false)).toBe('Прогноз')
    expect(forecastTitle('Прогноз', 6, 0, true)).toBe('Прогноз на 6 місяців')
  })
})
