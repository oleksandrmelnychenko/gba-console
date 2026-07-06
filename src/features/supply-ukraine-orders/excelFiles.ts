export const EXCEL_FILE_ACCEPT = '.xls,.xlsx,.xlsm,.xlsb'

const EXCEL_FILE_EXTENSIONS = new Set(['xls', 'xlsx', 'xlsm', 'xlsb'])
const EXCEL_MIME_TYPES = new Set([
  'application/vnd.ms-excel',
  'application/vnd.ms-excel.sheet.binary.macroenabled.12',
  'application/vnd.ms-excel.sheet.macroenabled.12',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

export function isExcelFile(file: File): boolean {
  const extension = file.name.split('.').pop()?.toLowerCase()

  return Boolean((extension && EXCEL_FILE_EXTENSIONS.has(extension)) || EXCEL_MIME_TYPES.has(file.type))
}
