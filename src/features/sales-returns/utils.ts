import { SALE_RETURN_ITEM_STATUSES, type SalesReturnItemStatusValue } from './types'

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 3,
})

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export function displayValue(value: unknown, fallback = ''): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : fallback
  }

  if (typeof value === 'string' && value.trim()) {
    return value
  }

  return fallback
}

export function formatAmount(value: unknown): string {
  const numberValue = readNumber(value)

  return typeof numberValue === 'number' ? amountFormatter.format(numberValue) : ''
}

export function formatMoney(value: unknown): string {
  const numberValue = readNumber(value)

  return typeof numberValue === 'number' ? moneyFormatter.format(numberValue) : ''
}

export function formatDateTime(value: unknown): string {
  const date = value ? new Date(value as Date | string) : null

  return date && !Number.isNaN(date.getTime()) ? dateTimeFormatter.format(date) : ''
}

export function getStatusLabel(
  status: SalesReturnItemStatusValue | undefined,
  t: (value: string) => string,
): string {
  const option = SALE_RETURN_ITEM_STATUSES.find((item) => item.value === status)

  if (!option) {
    return ''
  }

  const translated = t(option.code)

  return translated === option.code ? option.label : translated
}

export function getStatusOptions(t: (value: string) => string): Array<{ label: string; value: string }> {
  return SALE_RETURN_ITEM_STATUSES.slice(0, SALE_RETURN_ITEM_STATUSES.length - 1).map((option) => ({
    label: getStatusLabel(option.value, t),
    value: String(option.value),
  }))
}

export function parseStatusValue(value: string | null): SalesReturnItemStatusValue | undefined {
  const parsedValue = Number(value)
  const option = SALE_RETURN_ITEM_STATUSES.find((item) => item.value === parsedValue)

  return option?.value
}

export function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsedValue = Number(value)

    if (Number.isFinite(parsedValue)) {
      return parsedValue
    }
  }

  return undefined
}

export function getEntityName(entity?: { FullName?: string; Name?: string; Value?: string } | null): string {
  return entity?.FullName || entity?.Name || entity?.Value || ''
}
