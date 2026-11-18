type ColumnValue = number | ''

export type ImportColumnsForm = {
  endRow: ColumnValue
  grossWeightColumnNumber: ColumnValue
  isImportedProductColumnNumber: ColumnValue
  qtyColumnNumber: ColumnValue
  specificationCodeColumnNumber: ColumnValue
  startRow: ColumnValue
  totalAmountColumnNumber: ColumnValue
  unitPriceColumnNumber: ColumnValue
  vendorCodeColumnNumber: ColumnValue
  weightColumnNumber: ColumnValue
  withGrossWeight: boolean
  withImportedProduct: boolean
  withSpecificationCode: boolean
  withTotalAmount: boolean
  withWeight: boolean
}

/**
 * The order import said only «Заповніть колонки імпорту»; name the fields (labels as on the form),
 * like the cart import does. Returns null when every required column is set.
 */
export function describeImportColumnsProblem(
  form: ImportColumnsForm,
  isToUkraineMode: boolean,
  t: (key: string) => string,
): string | null {
  const required: Array<[ColumnValue, string]> = [
    [form.vendorCodeColumnNumber, 'Код товару'],
    [form.qtyColumnNumber, 'Кількість'],
    [form.startRow, 'З рядка'],
    [form.endRow, 'До рядка'],
    form.withTotalAmount ? [form.totalAmountColumnNumber, 'Колонка суми'] : [form.unitPriceColumnNumber, 'Колонка ціни'],
  ]

  if (form.withWeight) required.push([form.weightColumnNumber, 'Колонка ваги нетто'])
  if (form.withGrossWeight) required.push([form.grossWeightColumnNumber, 'Колонка ваги брутто'])
  if (isToUkraineMode && form.withSpecificationCode) required.push([form.specificationCodeColumnNumber, 'Колонка коду специфікації'])
  if (isToUkraineMode && form.withImportedProduct) required.push([form.isImportedProductColumnNumber, 'Колонка ознаки імпорту'])

  const missing = required.filter(([value]) => !value).map(([, label]) => t(label))

  if (missing.length) {
    return `${t('Заповніть колонки імпорту')}: ${missing.join(', ')}`
  }

  if (typeof form.startRow === 'number' && typeof form.endRow === 'number' && form.startRow > form.endRow) {
    return t('«До рядка» має бути не менше ніж «З рядка»')
  }

  return null
}

export type ParsedColumnNumber = {
  /** Column or row number the form receives; '' when the text is empty or refused. */
  value: ColumnValue
  error: string | null
}

/**
 * Reads a column or row number typed as text. The import fields used to drop every
 * character that was not a digit, so «abc-1e99» became 199 and «-5» became 5 without
 * a word; now anything that is not a whole number from 1 is kept as typed and refused.
 */
export function parseColumnNumberText(text: string, t: (key: string) => string): ParsedColumnNumber {
  const compact = text.trim()

  if (!compact) {
    return { error: null, value: '' }
  }

  if (/^-/.test(compact)) {
    return { error: t('Номер не може бути від’ємним'), value: '' }
  }

  if (!/^\d+$/.test(compact)) {
    return { error: t('Введіть ціле число від 1, наприклад 3'), value: '' }
  }

  const value = Number(compact)

  if (!Number.isSafeInteger(value) || value < 1) {
    return { error: t('Введіть ціле число від 1, наприклад 3'), value: '' }
  }

  return { error: null, value }
}
