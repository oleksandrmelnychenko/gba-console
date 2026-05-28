import { formatLocalDate, formatLocalDateTime } from '../../shared/date/dateTime'

export function toDateInputValue(date: Date): string {
  return formatLocalDate(date)
}

export function toDateTimeInputValue(date: Date): string {
  return formatLocalDateTime(date).slice(0, 16)
}

export function parseDateInputValue(value: string, fallback: Date, endOfDay = false): Date {
  if (!value) {
    return fallback
  }

  const date = new Date(`${value}T${endOfDay ? '23:59:59' : '00:00:00'}`)
  return Number.isNaN(date.getTime()) ? fallback : date
}

export function parseDateTimeInputValue(value: string, fallback: Date): Date {
  if (!value) {
    return fallback
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? fallback : date
}

export function getLastWeekRange(): { from: Date; to: Date } {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - 7)

  return { from, to }
}

export function getDefaultDailyRange(): { from: Date; to: Date } {
  const now = new Date()

  return {
    from: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 1),
    to: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59),
  }
}
