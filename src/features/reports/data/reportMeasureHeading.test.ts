import { expect, it } from 'vitest'
import { compactMeasureCaptions, isMeasureOnlyColumnSchema } from './reportMeasureHeading'

it('drops the repeated measure group and keeps its currency', () => {
  expect(compactMeasureCaptions([
    ['Кількість продажу', 'Кількість з урахуванням повернень'],
    ['Вартість продажу, EUR', 'Продажі без ПДВ з урахуванням повернень'],
    ['Собівартість, EUR', 'Собівартість без ПДВ'],
    ['Націнка, %', 'Націнка без ПДВ, %'],
  ])).toEqual(['Кількість з урахуванням повернень', 'Продажі без ПДВ з урахуванням повернень, EUR', 'Собівартість без ПДВ, EUR', 'Націнка без ПДВ, %'])
})
it('keeps the full path when the short caption would be ambiguous or generic', () => {
  expect(compactMeasureCaptions([['Вартість продажу (EUR)', 'Без ПДВ'], ['Собівартість (EUR)', 'Без ПДВ']])).toBeNull()
  expect(compactMeasureCaptions([['Собівартість, EUR', 'Без ПДВ']])).toBeNull()
  expect(compactMeasureCaptions([['Продажі', 'Продажі без ПДВ, EUR'], ['Повернення', 'Продажі без ПДВ, EUR']])).toBeNull()
  expect(compactMeasureCaptions([['Клієнт', 'Продажі', 'Продажі без ПДВ']])).toBeNull()
  expect(compactMeasureCaptions([])).toBeNull()
})
it('recognises a column axis made of measures only', () => {
  expect(isMeasureOnlyColumnSchema([{ Identity: '$measureGroup' }, { Identity: '$measure' }])).toBe(true)
  expect(isMeasureOnlyColumnSchema([{ Identity: 'Client' }, { Identity: '$measureGroup' }, { Identity: '$measure' }])).toBe(false)
  expect(isMeasureOnlyColumnSchema([{}, {}])).toBe(false)
})
