import type { RetailCartItem, RetailProduct } from './onlineShopTypes'

export function getRetailItemTotal(item: RetailCartItem): number {
  const total = getNumber(item.Total) ?? getNumber(item.Sum) ?? getNumber(item.TotalAmountLocal) ?? getNumber(item.TotalAmount)

  if (typeof total === 'number') {
    return total
  }

  return getRetailItemQuantity(item) * getRetailItemUnitPrice(item)
}

export function getRetailItemQuantity(item: RetailCartItem): number {
  return getNumber(item.Qty) ?? getNumber(item.Quantity) ?? getNumber(item.Count) ?? 0
}

export function getRetailItemUnitPrice(item: RetailCartItem): number {
  return getNumber(item.Product?.CurrentLocalPrice) ?? getNumber(item.UnitPrice) ?? getNumber(item.PricePerItem) ?? getNumber(item.Price) ?? 0
}

export function getRetailItemProductName(item: RetailCartItem, product?: RetailProduct): string {
  return item.ProductName?.trim() || product?.Name?.trim() || ''
}

export function getRetailItemVendorCode(item: RetailCartItem, product?: RetailProduct): string {
  return item.VendorCode?.trim() || product?.VendorCode?.trim() || product?.Articul?.trim() || product?.BarCode?.trim() || ''
}

export function getRetailItemImage(item: RetailCartItem, product?: RetailProduct): string {
  return (
    item.ProductImage?.trim()
    || product?.Image?.trim()
    || product?.ProductImages?.[0]?.ImageUrl?.trim()
    || product?.ImageUrl?.trim()
    || product?.ProductImage?.trim()
    || ''
  )
}

export function getRetailItemKey(item: RetailCartItem, index: number): string {
  return item.Product?.NetUid || item.NetUid || String(item.Id || index)
}

function getNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const parsed = Number(value)

    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}
