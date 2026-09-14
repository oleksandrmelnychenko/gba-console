import { describe, expect, it } from 'vitest'
import { nativeReportMeasurementUnit } from './nativeReportProfiles'

describe('source27 measurement units', () => {
  it('does not claim that raw global-price formulas were converted to management currency', () => {
    expect(nativeReportMeasurementUnit(27, 'Сума за глобальним типом цін без валютного перерахунку (1С)'))
      .toBe('Значення за формулою 1С без валютного перерахунку')
    expect(nativeReportMeasurementUnit(27, 'Різниця між сумою продажу і сумою за типом цін без валютного перерахунку (1С)'))
      .toBe('Значення за формулою 1С без валютного перерахунку')
    expect(nativeReportMeasurementUnit(27, 'Сума продажу з ПДВ у валюті управлінського обліку 1С'))
      .toBe('Валюта управлінського обліку 1С')
    expect(nativeReportMeasurementUnit(27, 'Знижка без ПДВ, % (1С)')).toBe('Відсотки')
  })
})
