import { describe, expect, it } from 'vitest'
import { nativeReportMeasurementUnit } from './nativeReportProfiles'
import { priceTypeSalesFormDataset } from './priceTypeSalesComparison'
import { PRICE_TYPE_ID, priceTypeSalesComparisonDataset } from './priceTypeSalesComparison.test-fixtures'

describe('source27 measurement units', () => {
  it('labels the current native form in GBA quantity, EUR and percent units', () => {
    const dataset = priceTypeSalesFormDataset(priceTypeSalesComparisonDataset,
      { Version: 1, SourceWorld: 1, PriceTypeId: PRICE_TYPE_ID, SalesBasis: 0 })!
    expect(dataset.Measurements).toHaveLength(9)
    for (const field of dataset.Measurements) {
      expect(nativeReportMeasurementUnit(27, field.Name))
        .toBe(field.Type === 0 ? 'Одиниці товару GBA' : field.Type === 69 ? 'Відсотки' : 'Євро')
    }
  })

  it('does not claim that raw global-price formulas were converted to management currency', () => {
    expect(nativeReportMeasurementUnit(27, 'Сума за глобальним типом цін без валютного перерахунку (1С)'))
      .toBe('Значення за формулою 1С без валютного перерахунку')
    expect(nativeReportMeasurementUnit(27, 'Різниця між сумою продажу і сумою за типом цін без валютного перерахунку (1С)'))
      .toBe('Значення за формулою 1С без валютного перерахунку')
    expect(nativeReportMeasurementUnit(27, 'Сума продажу з ПДВ у валюті управлінського обліку 1С'))
      .toBe('Валюта управлінського обліку 1С')
    expect(nativeReportMeasurementUnit(27, 'Кількість продажу в одиницях зберігання (1С)'))
      .toBe('Одиниці зберігання 1С')
    expect(nativeReportMeasurementUnit(27, 'Знижка без ПДВ, % (1С)')).toBe('Відсотки')
  })
})
