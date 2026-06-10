import { formatLocalDateTime } from '../../shared/date/dateTime'

export function toMergedServiceDateTimeInput(value?: Date | string): string {
  const fallback = new Date()

  if (!value) {
    return formatDateTimeInputValue(fallback)
  }

  const date = value instanceof Date ? value : new Date(value)

  return Number.isNaN(date.getTime()) ? formatDateTimeInputValue(fallback) : formatDateTimeInputValue(date)
}

function formatDateTimeInputValue(date: Date): string {
  return formatLocalDateTime(date).slice(0, 16)
}
