import type { ProductRemainProduct, ProductRemainSupplier } from './types'

const dateFormatter = new Intl.DateTimeFormat('uk-UA')
const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 3,
})
const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}

export function formatDate(value?: Date | string | null): string {
  if (!value) {
    return '-'
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '-' : dateFormatter.format(value)
  }

  const datePartMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)

  if (datePartMatch) {
    return `${datePartMatch[3]}.${datePartMatch[2]}.${datePartMatch[1]}`
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return dateFormatter.format(date)
}

export function formatDateTime(value?: Date | string | null): string {
  if (!value) {
    return '-'
  }

  if (typeof value === 'string') {
    const dateTimePartMatch = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(value)

    if (dateTimePartMatch) {
      return `${dateTimePartMatch[3]}.${dateTimePartMatch[2]}.${dateTimePartMatch[1]} ${dateTimePartMatch[4]}:${dateTimePartMatch[5]}`
    }
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value : '-'
  }

  return `${padTwoDigits(date.getDate())}.${padTwoDigits(date.getMonth() + 1)}.${date.getFullYear()} ${padTwoDigits(date.getHours())}:${padTwoDigits(date.getMinutes())}`
}

export function formatAmount(value?: number): string {
  const numberValue = toFiniteNumber(value)

  if (numberValue === null) {
    return '-'
  }

  return amountFormatter.format(numberValue)
}

export function formatMoney(value?: number): string {
  const numberValue = toFiniteNumber(value)

  if (numberValue === null) {
    return '-'
  }

  return moneyFormatter.format(numberValue)
}

export function getProductName(product?: ProductRemainProduct | null): string {
  return product?.NameUA?.trim() || product?.Name?.trim() || '-'
}

export function getVendorCode(product?: ProductRemainProduct | null): string {
  return product?.VendorCode?.trim() || '-'
}

export function getSupplierDisplayName(supplier: ProductRemainSupplier): string {
  return (
    supplier.FullName?.trim()
    || supplier.Name?.trim()
    || [supplier.FirstName, supplier.LastName, supplier.MiddleName].filter(Boolean).join(' ')
    || supplier.NetUid
    || '-'
  )
}

function padTwoDigits(value: number): string {
  return String(value).padStart(2, '0')
}

function toFiniteNumber(value?: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }

  return value
}
