/** The server reads at most this many rows per transfer import and stops at the sheet's last used row. */
export const TRANSFER_IMPORT_MAX_ROWS = 500

/**
 * «Кінцевий рядок» left empty means «to the end of the file» (WH-26): send the largest end row the server
 * accepts for this start row; the server stops at the last used row of the sheet anyway.
 */
export function resolveTransferImportEndRow(startRow: number | '', endRow: number | ''): number | '' {
  if (endRow !== '') {
    return endRow
  }

  return typeof startRow === 'number' && startRow > 0 ? startRow + TRANSFER_IMPORT_MAX_ROWS - 1 : ''
}

export const TRANSFER_IMPORT_TEMPLATE_FILE_NAME = 'shablon-peremishchennia.xlsx'

/** Rows of the downloadable template: header row, then code / quantity examples in columns 1 and 2. */
export function transferImportTemplateRows(t: (key: string) => string): Array<Array<string | number>> {
  return [
    [t('Код товару'), t('Кількість')],
    ['ABC-001', 1],
    ['ABC-002', 2],
  ]
}

/** Builds the .xlsx template (layout matches the dialog defaults: code 1, quantity 2, data from row 2). */
export async function buildTransferImportTemplate(t: (key: string) => string): Promise<Blob> {
  const XLSX = await import('xlsx')
  const sheet = XLSX.utils.aoa_to_sheet(transferImportTemplateRows(t))
  const book = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(book, sheet, t('Переміщення'))

  return new Blob([XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

export async function downloadTransferImportTemplate(t: (key: string) => string): Promise<void> {
  const blob = await buildTransferImportTemplate(t)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = TRANSFER_IMPORT_TEMPLATE_FILE_NAME
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
