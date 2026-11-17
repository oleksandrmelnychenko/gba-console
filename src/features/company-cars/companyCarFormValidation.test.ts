import { describe, expect, it } from 'vitest'
import { formatCarMetric, parseCarNumber, validateCompanyCarForm, type CompanyCarFormValues } from './companyCarFormValidation'

const t = (text: string) => text
const valid: CompanyCarFormValues = {
  carBrand: 'Skoda',
  fuelAmount: '30',
  inCityConsumption: '9,5',
  licensePlate: 'AA0001QA',
  mileage: '1200',
  mixedModeConsumption: '',
  outsideCityConsumption: '6',
  tankCapacity: '50',
}

describe('company car form validation', () => {
  it('accepts a valid car, decimal comma included', () => {
    expect(validateCompanyCarForm(valid, t, true)).toEqual({})
    expect(parseCarNumber('12,5')).toBe(12.5)
  })

  it('rejects text, exponent notation and negatives', () => {
    expect(Number.isNaN(parseCarNumber('abc'))).toBe(true)
    expect(Number.isNaN(parseCarNumber('1e9'))).toBe(true)
    expect(validateCompanyCarForm({ ...valid, mileage: 'abc' }, t, true).mileage).toBe('Введіть число')
    expect(validateCompanyCarForm({ ...valid, mileage: '-100' }, t, true).mileage).toBe('Значення не може бути від’ємним')
    expect(validateCompanyCarForm({ ...valid, outsideCityConsumption: '-1' }, t, true).outsideCityConsumption).toBeTruthy()
  })

  it('applies the server ranges', () => {
    expect(validateCompanyCarForm({ ...valid, tankCapacity: '0' }, t, true).tankCapacity).toBe('Вмістимість баку має бути більшою за 0')
    expect(validateCompanyCarForm({ ...valid, tankCapacity: '2001' }, t, true).tankCapacity).toBeTruthy()
    expect(validateCompanyCarForm({ ...valid, fuelAmount: '1000000000' }, t, true).fuelAmount)
      .toBe('Кількість пального не може перевищувати вмістимість баку')
    expect(validateCompanyCarForm({ ...valid, fuelAmount: '0' }, t, true).fuelAmount).toBeUndefined()
    expect(validateCompanyCarForm({ ...valid, mileage: '10000001' }, t, true).mileage).toBeTruthy()
    expect(validateCompanyCarForm({ ...valid, inCityConsumption: '100.5' }, t, true).inCityConsumption).toBeTruthy()
    expect(validateCompanyCarForm({ ...valid, licensePlate: 'A'.repeat(21) }, t, true).licensePlate).toBeTruthy()
    expect(validateCompanyCarForm({ ...valid, carBrand: 'B'.repeat(101) }, t, true).carBrand).toBeTruthy()
  })

  it('reports required fields only when asked', () => {
    const empty = { ...valid, fuelAmount: '', licensePlate: '', mileage: '', tankCapacity: '' }

    expect(validateCompanyCarForm(empty, t, false)).toEqual({})
    expect(Object.keys(validateCompanyCarForm(empty, t, true)).sort()).toEqual(['fuelAmount', 'licensePlate', 'mileage', 'tankCapacity'])
  })

  it('never renders junk in the summary header', () => {
    expect(formatCarMetric('abc')).toBe('—')
    expect(formatCarMetric('1e9')).toBe('—')
    expect(formatCarMetric('-5')).toBe('—')
    expect(formatCarMetric('1200')).toBe('1200')
  })
})
