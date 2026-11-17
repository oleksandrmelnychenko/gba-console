import type { BasketSupplyUploadForm } from '../types'

/** Field labels, also used as the dialog's input labels so the message names what is on screen. */
export const UPLOAD_FIELD_LABELS = {
  endRow: 'До рядка',
  file: 'Файл замовлення',
  fromDateColumnNumber: 'Колонка дати',
  grossWeightColumnNumber: 'Колонка ваги брутто',
  isImportedProductColumnNumber: 'Колонка імпорту',
  priorityColumnNumber: 'Колонка пріоритету',
  qtyColumnNumber: 'Колонка кількості',
  specificationCodeColumnNumber: 'Колонка митного коду',
  startRow: 'З рядка',
  vendorCodeColumnNumber: 'Колонка коду виробника',
  weightColumnNumber: 'Колонка ваги нетто',
} as const

export type UploadField = keyof typeof UPLOAD_FIELD_LABELS

/** Fields the server needs for this mode; the preview import reads only codes and quantities. */
export function requiredUploadFields(form: BasketSupplyUploadForm, isPreview: boolean): UploadField[] {
  const fields: UploadField[] = ['file', 'vendorCodeColumnNumber', 'qtyColumnNumber', 'startRow', 'endRow']

  if (isPreview) {
    return fields
  }

  fields.push('fromDateColumnNumber', 'priorityColumnNumber')
  if (form.withWeight) fields.push('weightColumnNumber')
  if (form.withGrossWeight) fields.push('grossWeightColumnNumber')
  if (form.withSpecificationCode) fields.push('specificationCodeColumnNumber')
  if (form.withIsImportedProduct) fields.push('isImportedProductColumnNumber')
  return fields
}

/**
 * Returns the message to show, or null when the form can be sent. Column and row numbers
 * must be whole numbers from 1; the inputs drop anything else, so an emptied field after
 * typing 0 or -1 is reported here by name.
 */
export function validateUploadForm(
  form: BasketSupplyUploadForm,
  isPreview: boolean,
  t: (key: string) => string,
): string | null {
  const missing = requiredUploadFields(form, isPreview).filter((field) => !form[field])

  if (missing.length) {
    return `${t('Заповніть поля (номери колонок і рядків — цілі числа від 1)')}: ${missing
      .map((field) => t(UPLOAD_FIELD_LABELS[field]))
      .join(', ')}`
  }

  if (typeof form.startRow === 'number' && typeof form.endRow === 'number' && form.endRow < form.startRow) {
    return t('«До рядка» має бути не менше ніж «З рядка»')
  }

  return null
}
