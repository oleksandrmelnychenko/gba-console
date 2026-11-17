import { userErrorText } from '../api/userErrorText'
import { translate } from '../i18n/translate'

/** Layout of the usual import workbook: code in A, quantity in B, a header row on top. */
export const DEFAULT_EXCEL_IMPORT_LAYOUT = {
  codeColumn: 1,
  qtyColumn: 2,
  startRow: 2,
} as const

export const EXCEL_FILE_REQUIRED_MESSAGE = 'Додайте файл.'
/** Shown under the file field of the code/quantity imports (WH-26). */
export const EXCEL_IMPORT_LAYOUT_HINT = 'Файл .xlsx: у колонці 1 — код товару, у колонці 2 — кількість, перший рядок — заголовки. Кінцевий рядок — номер останнього рядка з даними.'
const INVALID_WORKBOOK_MESSAGE = 'Файл не є коректною книгою Excel (.xlsx).'
/** A server failure while importing is not a broken workbook: say so, not «not an Excel file». */
const IMPORT_SERVER_FAILURE_MESSAGE = 'Не вдалося виконати імпорт через помилку сервера. Файл прочитано; спробуйте ще раз або зверніться до адміністратора.'

/* Raw server keys and parser texts that may still reach the console. The
   server is being fixed to send Ukrainian texts; this is the client fallback. */
const KNOWN_IMPORT_ERRORS: Array<[RegExp, string]> = [
  [/^UnsupportedFileFormat$/i, INVALID_WORKBOOK_MESSAGE],
  [/^NeedUploadFile$/i, EXCEL_FILE_REQUIRED_MESSAGE],
  [/^InvalidData$/i, 'Файл містить некоректні значення (код товару, кількість, вага або ціна). Перевірте файл.'],
  [/could not be (parsed|generated)|not a valid Package file|Could not read block|Sequence contains no elements|End of Central Directory/i, INVALID_WORKBOOK_MESSAGE],
  [/import failed unexpectedly|creation failed unexpectedly/i, IMPORT_SERVER_FAILURE_MESSAGE],
  [/availability quantity must be a finite non-negative number/i, 'Кількість у файлі має бути більшою за 0.'],
  [/^Товару із кодом \{0\} не існує\.?$/, 'У файлі є код товару, якого не існує. Перевірте коди товарів.'],
]

/** Ukrainian text for an Excel import failure, whatever form the server error took. */
export function excelImportErrorText(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message.trim() : typeof error === 'string' ? error.trim() : ''
  const known = KNOWN_IMPORT_ERRORS.find(([pattern]) => pattern.test(message))

  return known ? translate(known[1]) : userErrorText(error, fallback)
}
