import { describe, expect, it } from 'vitest'
import { describeImportColumnsProblem, parseColumnNumberText, type ImportColumnsForm } from './importColumnsValidation'

const t = (key: string) => key
const FORM: ImportColumnsForm = {
  endRow: 10,
  grossWeightColumnNumber: '',
  isImportedProductColumnNumber: '',
  qtyColumnNumber: 2,
  specificationCodeColumnNumber: '',
  startRow: 2,
  totalAmountColumnNumber: '',
  unitPriceColumnNumber: '',
  vendorCodeColumnNumber: 1,
  weightColumnNumber: '',
  withGrossWeight: false,
  withImportedProduct: false,
  withSpecificationCode: false,
  withTotalAmount: false,
  withWeight: false,
}

describe('describeImportColumnsProblem', () => {
  it('names the empty price column instead of a generic message', () => {
    expect(describeImportColumnsProblem(FORM, true, t)).toBe('Заповніть колонки імпорту: Колонка ціни')
  })

  it('names checked optional columns only in the mode that has them', () => {
    const form = { ...FORM, unitPriceColumnNumber: 3 as const, withSpecificationCode: true }

    expect(describeImportColumnsProblem(form, true, t)).toBe('Заповніть колонки імпорту: Колонка коду специфікації')
    expect(describeImportColumnsProblem(form, false, t)).toBeNull()
  })

  it('reports rows in the wrong order', () => {
    expect(describeImportColumnsProblem({ ...FORM, unitPriceColumnNumber: 3, startRow: 10, endRow: 2 }, false, t))
      .toBe('«До рядка» має бути не менше ніж «З рядка»')
  })
})

describe('parseColumnNumberText', () => {
  it('reads whole numbers from 1', () => {
    expect(parseColumnNumberText(' 3 ', t)).toEqual({ error: null, value: 3 })
    expect(parseColumnNumberText('', t)).toEqual({ error: null, value: '' })
  })

  it('refuses text and exponents instead of keeping their digits (w1-11)', () => {
    expect(parseColumnNumberText('abc-1e99', t)).toEqual({ error: 'Введіть ціле число від 1, наприклад 3', value: '' })
    expect(parseColumnNumberText('1e5', t).value).toBe('')
    expect(parseColumnNumberText('2,5', t).value).toBe('')
    expect(parseColumnNumberText('0', t).value).toBe('')
  })

  it('refuses negatives instead of dropping the minus (w1-11)', () => {
    expect(parseColumnNumberText('-5', t)).toEqual({ error: 'Номер не може бути від’ємним', value: '' })
  })
})
