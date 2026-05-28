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

function toFiniteNumber(value?: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }

  return value
}
