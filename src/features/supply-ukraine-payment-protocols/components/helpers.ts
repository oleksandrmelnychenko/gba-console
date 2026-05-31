const dateFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short' })
const moneyFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

export function formatDate(value?: Date | string | null): string {
  if (!value) {
    return '-'
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return dateFormatter.format(date)
}

export function formatMoney(value: number | undefined | null, code?: string | null): string {
  const amount = typeof value === 'number' && !Number.isNaN(value) ? value : 0
  const formatted = moneyFormatter.format(amount)

  return code ? `${formatted} ${code}` : formatted
}

export function responsibleName(user?: { FirstName?: string; FullName?: string; LastName?: string } | null): string {
  if (!user) {
    return ''
  }

  const composed = `${user.LastName || ''} ${user.FirstName || ''}`.trim()

  return composed || user.FullName || ''
}

export function toDateInput(value: Date | null): string {
  if (!value) {
    return ''
  }

  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function fromDateInput(value: string): Date | null {
  if (!value) {
    return null
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? null : date
}
