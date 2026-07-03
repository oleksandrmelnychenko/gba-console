import { formatDateInputForQuery, formatLocalDate } from '../../../shared/date/dateTime'

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

// Empty values render blank (docs/ui-patterns.md §5).
export function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  return String(value)
}
