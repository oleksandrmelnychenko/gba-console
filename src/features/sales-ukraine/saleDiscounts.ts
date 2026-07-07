import type { SalesUkraineOrderItem } from './types'

const BASE_DISCOUNT_SUPPRESSED_TOPS = new Set(['x9', 'х9'])

export function getVisibleOrderItemBaseDiscount(orderItem: SalesUkraineOrderItem): number | null {
  const discount = getNumber(orderItem.Discount)

  if (typeof discount !== 'number') {
    return null
  }

  return isOrderItemBaseDiscountSuppressed(orderItem) ? 0 : discount
}

export function getUniformBaseDiscount(orderItems: SalesUkraineOrderItem[]): number | null {
  return getUniformPositiveDiscount(orderItems.map((item) => item.Discount))
}

export function getAverageBaseDiscount(orderItems: SalesUkraineOrderItem[]): number | null {
  return getAveragePositiveDiscount(orderItems.map((item) => item.Discount))
}

export function getPartialUniformBaseDiscount(orderItems: SalesUkraineOrderItem[]): number | null {
  return getUniformPositiveDiscount(orderItems.map((item) => item.Discount).filter(isPositiveDiscount))
}

export function getPartialAverageBaseDiscount(orderItems: SalesUkraineOrderItem[]): number | null {
  return getAveragePositiveDiscount(orderItems.map((item) => item.Discount).filter(isPositiveDiscount))
}

export function getUniformOneTimeDiscount(orderItems: SalesUkraineOrderItem[]): number | null {
  return getUniformPositiveDiscount(orderItems.map((item) => item.OneTimeDiscount))
}

export function getAverageOneTimeDiscount(orderItems: SalesUkraineOrderItem[]): number | null {
  return getAveragePositiveDiscount(orderItems.map((item) => item.OneTimeDiscount))
}

export function isOrderItemBaseDiscountSuppressed(orderItem: SalesUkraineOrderItem): boolean {
  const top = orderItem.Product?.Top?.trim().toLowerCase()

  return (
    Boolean(top && BASE_DISCOUNT_SUPPRESSED_TOPS.has(top))
    || Boolean(orderItem.Product?.IsForZeroSale)
    || Boolean(orderItem.Product?.IsForSale)
  )
}

function getNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(',', '.'))

    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function getUniformPositiveDiscount(values: unknown[]): number | null {
  if (!values.length) {
    return null
  }

  const first = getNumber(values[0])

  if (typeof first !== 'number' || first === 0) {
    return null
  }

  return values.every((value) => getNumber(value) === first) ? first : null
}

function getAveragePositiveDiscount(values: unknown[]): number | null {
  if (!values.length) {
    return null
  }

  const discounts = values.map((value) => getNumber(value))

  if (discounts.some((value) => typeof value !== 'number' || value <= 0)) {
    return null
  }

  const sum = (discounts as number[]).reduce((acc, value) => acc + value, 0)

  return Math.round((sum / discounts.length) * 100) / 100
}

function isPositiveDiscount(value: unknown): boolean {
  const discount = getNumber(value)

  return typeof discount === 'number' && discount > 0
}
