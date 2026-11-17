import { formatDateInputForQuery, formatLocalDate, toDateTimeQuery } from '../../../shared/date/dateTime'

export { toDateTimeQuery }

export function getDateShiftedByDays(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)

  return formatLocalDate(date)
}

export function toDateString(value: string): string {
  return formatDateInputForQuery(value)
}

export function toIsoString(value: string): string {
  return formatDateInputForQuery(value)
}

const dateFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short' })
const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short', timeStyle: 'short' })

export function formatDate(value?: Date | string): string {
  return formatWith(dateFormatter, value)
}

export function formatDateTime(value?: Date | string): string {
  return formatWith(dateTimeFormatter, value)
}

function formatWith(formatter: Intl.DateTimeFormat, value?: Date | string): string {
  if (!value) {
    return '-'
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return formatter.format(date)
}

/**
 * Text typed into a дд.мм.рррр field that can never become a date: letters, or
 * a complete value such as 31.02.2026 / 99.99.9999. Partial input while the
 * user is still typing (e.g. «17.1») is not reported.
 */
export function isImpossibleTypedDate(text: string): boolean {
  const value = text.trim()

  if (!value) {
    return false
  }

  if (/[^\d.]/.test(value)) {
    return true
  }

  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value)

  if (!match) {
    return value.split('.').length > 3 || /\d{5,}/.test(value)
  }

  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(year, month - 1, day)

  return year < 1900 || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day
}

// Empty values render blank (docs/ui-patterns.md §5).
export function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  return String(value)
}
