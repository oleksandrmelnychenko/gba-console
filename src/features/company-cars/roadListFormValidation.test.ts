import { describe, expect, it } from 'vitest'
import { parseWholeKilometers, validateRoadListForm, type RoadListFormValues } from './roadListFormValidation'

const t = (text: string) => text
const valid: RoadListFormValues = {
  comment: 'Київ',
  inCityKilometers: '40',
  mileage: '1200',
  mixedModeKilometers: '',
  outsideCityKilometers: '40',
}

describe('road list form validation', () => {
  it('accepts whole kilometres with a recipient', () => {
    expect(validateRoadListForm(valid, 1, t, true)).toEqual({})
  })

  it('rejects text, negatives and fractions visibly instead of reading 0', () => {
    expect(Number.isNaN(parseWholeKilometers('abc'))).toBe(true)
    expect(validateRoadListForm({ ...valid, outsideCityKilometers: 'abc' }, 1, t, false).outsideCityKilometers).toBe('Введіть число')
    expect(validateRoadListForm({ ...valid, inCityKilometers: '-5' }, 1, t, false).inCityKilometers).toBe('Значення не може бути від’ємним')
    expect(validateRoadListForm({ ...valid, mixedModeKilometers: '2,5' }, 1, t, false).mixedModeKilometers).toBe('Введіть ціле число кілометрів')
  })

  it('applies the server ranges and the comment length', () => {
    expect(validateRoadListForm({ ...valid, mileage: '0' }, 1, t, false).mileage).toBeTruthy()
    expect(validateRoadListForm({ ...valid, mileage: '10000001' }, 1, t, false).mileage).toBeTruthy()
    expect(validateRoadListForm({ ...valid, inCityKilometers: '100001' }, 1, t, false).inCityKilometers).toBeTruthy()
    expect(validateRoadListForm({ ...valid, comment: 'x'.repeat(151) }, 1, t, false).comment).toBeTruthy()
  })

  it('requires the odometer and «Кому видано» on save', () => {
    expect(validateRoadListForm({ ...valid, mileage: '' }, 0, t, false)).toEqual({})
    const errors = validateRoadListForm({ ...valid, mileage: '' }, 0, t, true)
    expect(errors.mileage).toBe('Вкажіть показники одометра')
    expect(errors.drivers).toBe('Вкажіть, кому видано шляховий лист')
  })
})
