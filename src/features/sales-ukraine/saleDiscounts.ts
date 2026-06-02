import type { SalesUkraineOrderItem } from './types'

const BASE_DISCOUNT_SUPPRESSED_TOPS = new Set(['x9', 'х9'])

export function getVisibleOrderItemBaseDiscount(orderItem: SalesUkraineOrderItem): number | null {
  const discount = getNumber(orderItem.Discount)

  if (typeof discount !== 'number') {
    return null
  }

  return isOrderItemBaseDiscountSuppressed(orderItem) ? 0 : discount
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
