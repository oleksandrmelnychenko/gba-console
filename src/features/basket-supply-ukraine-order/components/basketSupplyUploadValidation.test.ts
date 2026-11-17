import { describe, expect, it } from 'vitest'
import type { BasketSupplyUploadForm } from '../types'
import { validateUploadForm } from './basketSupplyUploadValidation'

const t = (key: string) => key

const FILLED: BasketSupplyUploadForm = {
  endRow: 10,
  file: new File(['x'], 'cart.xlsx'),
  fromDateColumnNumber: '',
  grossWeightColumnNumber: '',
  isImportedProductColumnNumber: '',
  isWeightPerItem: false,
  priorityColumnNumber: '',
  qtyColumnNumber: 2,
  specificationCodeColumnNumber: '',
  startRow: 2,
  vendorCodeColumnNumber: 1,
  weightColumnNumber: '',
  withGrossWeight: false,
  withIsImportedProduct: false,
  withSpecificationCode: false,
  withWeight: false,
}

describe('validateUploadForm', () => {
  it('names the date and priority columns the cart import needs', () => {
    expect(validateUploadForm(FILLED, false, t)).toBe(
      'Заповніть поля (номери колонок і рядків — цілі числа від 1): Колонка дати, Колонка пріоритету',
    )
  })

  it('preview import needs only codes, quantities and rows', () => {
    expect(validateUploadForm(FILLED, true, t)).toBeNull()
  })

  it('names a column emptied by typing 0 or a negative number, and checked optional columns', () => {
    const message = validateUploadForm(
      { ...FILLED, vendorCodeColumnNumber: '', fromDateColumnNumber: 3, priorityColumnNumber: 4, withWeight: true },
      false,
      t,
    )

    expect(message).toContain('Колонка коду виробника')
    expect(message).toContain('Колонка ваги нетто')
    expect(message).not.toContain('Колонка дати')
  })

  it('rejects an end row before the start row', () => {
    expect(validateUploadForm({ ...FILLED, startRow: 10, endRow: 2 }, true, t)).toBe(
      '«До рядка» має бути не менше ніж «З рядка»',
    )
  })
})
