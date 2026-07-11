import { formatLocalDateTime } from '../../shared/date/dateTime'

const DATE_TIME_LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

export function formatProductStorageDateTimeInput(date: Date): string {
  return formatLocalDateTime(date).slice(0, 16)
}

export function isValidProductStorageDateTimeInput(value: string): boolean {
  return parseProductStorageDateTimeInput(value) !== null
}

export function toProductStorageApiDateTime(value: string): string {
  return parseProductStorageDateTimeInput(value)?.toISOString() || ''
}

function parseProductStorageDateTimeInput(value: string): Date | null {
  const match = DATE_TIME_LOCAL_PATTERN.exec(value)

  if (!match) {
    return null
  }

  const [, yearValue, monthValue, dayValue, hourValue, minuteValue] = match
  const year = Number(yearValue)
  const month = Number(monthValue) - 1
  const day = Number(dayValue)
  const hour = Number(hourValue)
  const minute = Number(minuteValue)
  const date = new Date(year, month, day, hour, minute)

  if (
    date.getFullYear() !== year
    || date.getMonth() !== month
    || date.getDate() !== day
    || date.getHours() !== hour
    || date.getMinutes() !== minute
  ) {
    return null
  }

  return date
}
