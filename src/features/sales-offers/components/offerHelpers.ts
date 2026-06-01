import type { ClientShoppingCart, OfferOrderItem, OfferReasonStatus } from '../types'

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export function formatMoney(amount: number | null | undefined): string {
  return moneyFormatter.format(typeof amount === 'number' && Number.isFinite(amount) ? amount : 0)
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) {
    return ''
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${day}.${month}.${year} ${hours}:${minutes}`
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) {
    return ''
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()

  return `${day}.${month}.${year}`
}

export function getNotProcessedCount(offer: ClientShoppingCart): number {
  return (offer.OrderItems ?? []).reduce((sum, item) => sum + getItemNotProcessed(item), 0)
}

export function getItemNotProcessed(item: OfferOrderItem): number {
  return (item.Qty ?? 0) - (item.OrderedQty ?? 0)
}

export function getDaysToEnd(validUntil: Date | string | null | undefined): number {
  if (!validUntil) {
    return 0
  }

  const date = validUntil instanceof Date ? validUntil : new Date(validUntil)

  if (Number.isNaN(date.getTime())) {
    return 0
  }

  const diff = date.getTime() - Date.now()

  return Math.trunc(diff / (1000 * 60 * 60 * 24))
}

export function getReasonStatus(offer: ClientShoppingCart): OfferReasonStatus {
  const items = offer.OrderItems ?? []

  if (offer.Comment || items.every((item) => !!item.Comment)) {
    return 'all'
  }

  if (items.some((item) => !!item.Comment)) {
    return 'partial'
  }

  return 'none'
}
