export type QueryValue = string | number | boolean | Date | null | undefined
export type QueryParams = Record<string, QueryValue | QueryValue[]>

function getClientTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined
  } catch {
    return undefined
  }
}

export function getTimeZoneHeader(): Record<string, string> {
  const timeZone = getClientTimeZone()
  return timeZone ? { 'X-Time-Zone': timeZone } : {}
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function formatLocalDateTime(date: Date): string {
  const datePart = formatLocalDate(date)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  const milliseconds = date.getMilliseconds()
  const millisecondsPart = milliseconds > 0 ? `.${String(milliseconds).padStart(3, '0')}` : ''

  return `${datePart}T${hours}:${minutes}:${seconds}${millisecondsPart}`
}

export function formatLocalInputDateTime(dateValue?: string, timeValue = '00:00'): string {
  const fallback = new Date()
  const datePart = dateValue || formatLocalDate(fallback)
  const timePart = timeValue || '00:00'
  const rawValue = datePart.includes('T') ? datePart : `${datePart}T${timePart}`
  const date = new Date(rawValue)

  return Number.isNaN(date.getTime()) ? formatLocalDateTime(fallback) : formatLocalDateTime(date)
}

export function formatDateForQuery(date: Date): string {
  if (
    date.getHours() === 0 &&
    date.getMinutes() === 0 &&
    date.getSeconds() === 0 &&
    date.getMilliseconds() === 0
  ) {
    return formatLocalDate(date)
  }

  return formatLocalDateTime(date)
}

export function toQueryString(query?: QueryParams): string {
  if (!query) {
    return ''
  }

  const params = new URLSearchParams()

  Object.entries(query).forEach(([key, value]) => {
    const values = Array.isArray(value) ? value : [value]

    values.forEach((item) => {
      const serialized = serializeQueryValue(item)

      if (typeof serialized !== 'undefined') {
        params.append(key, serialized)
      }
    })
  })

  const queryString = params.toString()
  return queryString ? `?${queryString}` : ''
}

function serializeQueryValue(value: QueryValue): string | undefined {
  if (typeof value === 'undefined' || value === null) {
    return undefined
  }

  if (value instanceof Date) {
    return formatDateForQuery(value)
  }

  return String(value)
}
