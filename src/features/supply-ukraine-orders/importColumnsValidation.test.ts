import { describe, expect, it } from 'vitest'
import { describeImportColumnsProblem, type ImportColumnsForm } from './importColumnsValidation'

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
