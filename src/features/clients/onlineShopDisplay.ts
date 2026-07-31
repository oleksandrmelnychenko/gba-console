import type { RetailCartItem, RetailProduct } from './onlineShopTypes'
import { getProductShopImageUrlByCode } from '../products/utils'
import { toProxiedAssetUrl } from '../../shared/url/proxiedAssetUrl'

export const RETAIL_LOCAL_CURRENCY_CODE = 'UAH'

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
  const total = getNumber(item.Total) ?? getNumber(item.Sum) ?? getNumber(item.TotalAmountLocal) ?? getNumber(item.TotalAmount)
  const quantity = getRetailItemQuantity(item)

  if (typeof total === 'number' && quantity > 0) {
    return total / quantity
  }

  return getNumber(item.Product?.CurrentLocalPrice) ?? getNumber(item.UnitPrice) ?? getNumber(item.PricePerItem) ?? getNumber(item.Price) ?? 0
}

export function getRetailItemProductName(item: RetailCartItem, product?: RetailProduct): string {
  return item.ProductName?.trim() || product?.NameUA?.trim() || product?.Name?.trim() || ''
}

export function getRetailItemVendorCode(item: RetailCartItem, product?: RetailProduct): string {
  return item.VendorCode?.trim() || product?.VendorCode?.trim() || product?.Articul?.trim() || product?.BarCode?.trim() || ''
}

export function getRetailItemImage(item: RetailCartItem, product?: RetailProduct): string {
  const productImage =
    product?.ProductImages?.find((image) => !image.Deleted && image.IsMainImage && image.ImageUrl?.trim())?.ImageUrl
    || product?.ProductImages?.find((image) => !image.Deleted && image.ImageUrl?.trim())?.ImageUrl
  const directImage =
    item.ProductImage?.trim()
    || productImage?.trim()
    || product?.Image?.trim()
    || product?.ImageUrl?.trim()
    || product?.ProductImage?.trim()
    || ''

  return toProxiedAssetUrl(directImage) || getProductShopImageUrlByCode(getRetailItemVendorCode(item, product))
}

export function getRetailItemLocalCurrencyCode(
  item: RetailCartItem,
  fallback = RETAIL_LOCAL_CURRENCY_CODE,
): string {
  return (
    item.LocalCurrencyCode?.trim()
    || item.LocalCurrency?.Code?.trim()
    || fallback.trim()
    || RETAIL_LOCAL_CURRENCY_CODE
  ).toUpperCase()
}

export function getRetailItemSourceCurrencyCode(item: RetailCartItem, product?: RetailProduct): string {
  return (
    item.CurrencyCode?.trim()
    || item.Currency?.Code?.trim()
    || product?.CurrencyCode?.trim()
    || ''
  ).toUpperCase()
}

export function getRetailItemSourceUnitPrice(item: RetailCartItem, product?: RetailProduct): number | null {
  return getNumber(item.PricePerItem) ?? getNumber(product?.CurrentPrice)
}

export function getRetailItemMainOriginalNumber(product?: RetailProduct): string {
  return product?.MainOriginalNumber?.trim() || ''
}

export function getRetailItemBrand(product?: RetailProduct): string {
  return product?.Brand?.trim() || product?.DescriptionUA?.trim() || product?.Description?.trim() || ''
}

export function getRetailItemAvailableQty(product?: RetailProduct): number | null {
  return getNumber(product?.AvailableQtyUk)
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
