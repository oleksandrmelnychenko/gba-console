import { ApiError } from '../../shared/api/apiClient'
import { translate } from '../../shared/i18n/translate'

/** Ukrainian labels for the field keys the server writes into import issues. */
const FIELD_LABELS: Record<string, string> = {
  address: 'Адреса',
  brand: 'Марка',
  engineVolume: 'Об’єм двигуна',
  manufactureYear: 'Рік випуску',
  model: 'Модель',
  ownerName: 'Власник',
  plateNumber: 'Держномер',
  vin: 'VIN',
}

export function getVehicleRegistryFieldLabel(field?: string | null, code?: string | null): string {
  const key = field?.trim() || ''

  if (key && FIELD_LABELS[key]) {
    return translate(FIELD_LABELS[key])
  }

  return key || code?.trim() || ''
}

const ERROR_CODE_MESSAGES: Record<string, string> = {
  FILE_TOO_LARGE: 'Файл перевищує ліміт 25 МБ.',
  MISSING_FILE: 'Оберіть Excel-файл реєстру.',
  VEHICLE_REGISTRY_IMPORT_FAILED: 'Не вдалося прочитати файл. Перевірте, що це коректний Excel-файл реєстру (.xls або .xlsx).',
}

/** The import endpoint answers with English texts; known ones are shown in Ukrainian. */
const SERVER_MESSAGE_PATTERNS: Array<[RegExp, string]> = [
  [/^Excel file is required\.?$/i, 'Оберіть Excel-файл реєстру.'],
  [/^Excel file name is required\.?$/i, 'Оберіть Excel-файл реєстру.'],
  [/^Excel file exceeds/i, 'Файл перевищує ліміт 25 МБ.'],
  [/^Only \.xls and \.xlsx/i, 'Підтримуються лише файли .xls та .xlsx.'],
  [/^Workbook does not contain the required vehicle registry columns\.?$/i, 'У файлі немає обов’язкових колонок реєстру автомобілів.'],
  [/^Workbook contains more than \d+ sheets\.?$/i, 'У файлі забагато аркушів.'],
  [/^Workbook contains more than \d+ data rows\.?$/i, 'У файлі забагато рядків.'],
  [/^Excel file is empty\.?$/i, 'Файл порожній.'],
  [/^Excel stream is not readable\.?$/i, 'Не вдалося прочитати файл.'],
  [/^Excel file does not contain vehicle rows\.?$/i, 'У файлі немає рядків з автомобілями.'],
  [/^Vehicle brand could not be determined\.?$/i, 'Не вдалося визначити марку автомобілів у файлі.'],
  [/^Vehicle registry import failed\.?$/i, ERROR_CODE_MESSAGES.VEHICLE_REGISTRY_IMPORT_FAILED],
]

const GENERIC_IMPORT_ERROR = 'Не вдалося імпортувати файл. Перевірте, що це коректний Excel-файл реєстру.'

function getErrorCode(error: unknown): string {
  if (!(error instanceof ApiError) || !error.payload || typeof error.payload !== 'object') {
    return ''
  }

  const code = (error.payload as { ErrorCode?: unknown }).ErrorCode

  return typeof code === 'string' ? code : ''
}

export function getVehicleRegistryImportErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message.trim() : ''

  for (const [pattern, text] of SERVER_MESSAGE_PATTERNS) {
    if (pattern.test(message)) {
      return translate(text)
    }
  }

  const code = getErrorCode(error)

  if (code && ERROR_CODE_MESSAGES[code]) {
    return translate(ERROR_CODE_MESSAGES[code])
  }

  // Ukrainian server or network messages are already readable; any other English text is not shown raw.
  if (/[А-Яа-яЄєІіЇїҐґ]/.test(message)) {
    return message
  }

  return translate(GENERIC_IMPORT_ERROR)
}

export function isInvalidEngineVolume(value?: number | null): boolean {
  return typeof value === 'number' && value < 0
}

const engineLitresFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 1 })
const engineCcFormatter = new Intl.NumberFormat('uk-UA')

export function formatEngineVolume(value?: number | null): string {
  if (isInvalidEngineVolume(value)) {
    return translate('Некоректний об’єм: {value}', { value: String(value) })
  }

  if (!value) {
    return '—'
  }

  return value >= 1000
    ? `${engineLitresFormatter.format(value / 1000)} л`
    : `${engineCcFormatter.format(value)} см³`
}

/**
 * A file the server refused (not an Excel book, missing columns, damaged) is still logged as an import with
 * status 'failed' and no rows. It changed nothing, so it is labelled «Файл відхилено», not a failed import.
 */
export function isRejectedVehicleRegistryImport(item: { Status?: string | null; TotalRows?: number | null }): boolean {
  return item.Status === 'failed' && !item.TotalRows
}
