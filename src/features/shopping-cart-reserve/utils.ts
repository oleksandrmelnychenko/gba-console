import type {
  CartReserveOrderItem,
  ShoppingCartReserveItem,
} from './types'

const CART_CURRENCY_CODE = 'EUR'
const UAH_CURRENCY_CODE = 'UAH'

const dateFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  hour: '2-digit',
  minute: '2-digit',
})

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export function getCartCurrencyCode(): string {
  return CART_CURRENCY_CODE
}

export function getCartLocalCurrencyCode(cart: ShoppingCartReserveItem): string {
  return cart.ClientAgreement?.Agreement?.Currency?.Code || UAH_CURRENCY_CODE
}

export function getCartClientName(cart: ShoppingCartReserveItem): string {
  return cart.ClientAgreement?.Client?.FullName || ''
}

export function getCartClientNetUid(cart: ShoppingCartReserveItem): string {
  return cart.ClientAgreement?.Client?.NetUid || ''
}

export function getCartKey(cart: ShoppingCartReserveItem, index: number): string {
  return cart.NetUid || `cart-${index}`
}

export function getOrderItemKey(item: CartReserveOrderItem, index: number): string {
  return item.NetUid || `order-item-${index}`
}

export function getDaysRemaining(value?: string | Date): number | null {
  if (!value) {
    return null
  }

  const validUntil = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(validUntil.getTime())) {
    return null
  }

  const diffMs = validUntil.getTime() - Date.now()

  return Math.trunc(diffMs / (1000 * 60 * 60 * 24))
}

export function formatCartDate(value?: string | Date): string {
  if (!value) {
    return ''
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return dateFormatter.format(date)
}

export function formatCartTime(value?: string | Date): string {
  if (!value) {
    return ''
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return dateTimeFormatter.format(date)
}

export function formatMoney(value?: number): string {
  if (value == null || Number.isNaN(value)) {
    return moneyFormatter.format(0)
  }

  return moneyFormatter.format(value)
}

export function formatQty(item: CartReserveOrderItem): string {
  const qty = item.Qty ?? 0

  return item.OverLordQty ? `${qty} / ${item.OverLordQty}` : String(qty)
}

export function getOrderItemAmount(item: CartReserveOrderItem, localCurrencyCode: string): number {
  if (localCurrencyCode === CART_CURRENCY_CODE) {
    return item.TotalAmountEurToUah ?? 0
  }

  return item.TotalAmount ?? 0
}

export function getOrderItemAmountCurrency(localCurrencyCode: string): string {
  return localCurrencyCode === CART_CURRENCY_CODE ? UAH_CURRENCY_CODE : CART_CURRENCY_CODE
}
