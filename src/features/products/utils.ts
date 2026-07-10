import type { Product, ProductImage, ProductOriginalNumber } from './types'
import { translate } from '../../shared/i18n/translate'
import { toProxiedAssetUrl } from '../../shared/url/proxiedAssetUrl'

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'
const PRODUCT_SHOP_IMAGE_BASE_URL = 'https://concord-shop.com/userdata/shop/product/'

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 3,
})

const priceFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export function getEmptyGuid(): string {
  return EMPTY_GUID
}

export function getProductTitle(product?: Product | null): string {
  return product?.NameUA?.trim() || product?.Name?.trim() || translate('Без назви')
}

export function getProductCode(product?: Product | null): string {
  return product?.VendorCode?.trim() || product?.NetUid?.trim() || translate('Без коду')
}

export function getProductMainOriginalNumber(product?: Product | null): string {
  const mainOriginalNumber = product?.MainOriginalNumber?.trim()

  if (mainOriginalNumber) {
    return mainOriginalNumber
  }

  const originalNumbers = getProductOriginalNumbers(product)
  const originalNumber = originalNumbers.find((item) => item.IsMainOriginalNumber)?.OriginalNumber
    || originalNumbers[0]?.OriginalNumber

  return originalNumber?.MainNumber?.trim() || originalNumber?.Number?.trim() || ''
}

export function getProductGroupNames(product?: Product | null): string {
  const directNames = product?.ProductGroupNames?.trim()

  if (directNames) {
    return directNames
  }

  const groupNames = product?.ProductProductGroups?.reduce<string[]>((names, productGroup) => {
    if (productGroup.Deleted || productGroup.ProductGroup?.Deleted) {
      return names
    }

    const name = productGroup.ProductGroup?.Name?.trim() || productGroup.ProductGroup?.FullName?.trim()

    if (name) {
      names.push(name)
    }

    return names
  }, [])

  return groupNames?.join(', ') || ''
}

export function getProductMainImage(product?: Product | null): ProductImage | null {
  const shopImageUrl = getProductShopImageUrl(product)
  const activeImages = product?.ProductImages?.filter((image) => !image.Deleted) || []
  const image =
    activeImages.find((candidate) => candidate.IsMainImage && Boolean(candidate.ImageUrl))
    || activeImages.find((candidate) => Boolean(candidate.ImageUrl))
    || (product?.Image ? { ImageUrl: product.Image } : null)
    || (shopImageUrl ? { ImageUrl: shopImageUrl } : null)

  /* Internal-origin /Images/ URLs are unreachable from the browser — rewrite
     them to the same-origin proxy path. */
  return image ? { ...image, ImageUrl: toProxiedAssetUrl(image.ImageUrl) } : null
}

export function getProductWriteOffRuleLocaleLabel(locale: string | undefined): 'Україна' | 'Польща' | 'Невідомий регіон' {
  switch (locale) {
    case 'uk':
      return 'Україна'
    case 'pl':
      return 'Польща'
    default:
      return 'Невідомий регіон'
  }
}

export function splitProductSearchResults<T>(products: T[]): { bottomProducts: T[]; topProducts: T[] } {
  const splitIndex = Math.floor(products.length / 2)

  return {
    bottomProducts: products.slice(splitIndex),
    topProducts: products.slice(0, splitIndex),
  }
}

export function getProductShopImageUrl(product?: Product | null): string {
  const vendorCode = product?.VendorCode?.trim()

  return vendorCode ? `${PRODUCT_SHOP_IMAGE_BASE_URL}${normalizeProductShopImageCode(vendorCode.toLowerCase())}_water.jpg` : ''
}

export function getProductShopGalleryImageUrl(vendorCode: string, suffix: number): string {
  return `${PRODUCT_SHOP_IMAGE_BASE_URL}${normalizeProductShopImageCode(vendorCode.trim().toLowerCase())}_${suffix}_water.jpg`
}

export function getProductOriginalNumbers(product?: Product | null): ProductOriginalNumber[] {
  return product?.ProductOriginalNumbers?.filter(
    (item) => !item.Deleted && item.OriginalNumber?.Deleted !== true && Boolean(item.OriginalNumber),
  ) || []
}

function normalizeProductShopImageCode(value: string): string {
  return value.replace(/[.*/]/g, (match) => {
    switch (match) {
      case '.':
        return '~'
      case '/':
        return '%23'
      case '*':
        return '_'
      default:
        return match
    }
  })
}

export function getProductAvailableQty(product?: Product | null): number {
  return (product?.ProductAvailabilities ?? []).reduce<number>(
    (total, availability) => total + (typeof availability.Amount === 'number' && Number.isFinite(availability.Amount) ? availability.Amount : 0),
    0,
  )
}

export function displayValue(value?: boolean | number | string | null): string {
  if (typeof value === 'boolean') {
    return value ? 'Так' : 'Ні'
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '-'
  }

  const normalized = value?.trim()
  return normalized || '-'
}

export function formatAmount(value?: number | null): string {
  return typeof value === 'number' && Number.isFinite(value) ? amountFormatter.format(value) : '-'
}

export function formatPrice(value?: number | null): string {
  return typeof value === 'number' && Number.isFinite(value) ? priceFormatter.format(value) : '-'
}

export function getBooleanBadgeColor(value?: boolean): string {
  return value ? 'green' : 'gray'
}

export function isCriticalProductTop(top?: string | null): boolean {
  const value = top?.trim().toLowerCase()

  return value === 'x9' || value === 'х9'
}

export function getRelatedProductRowColor(product?: Partial<Product> | null): string | undefined {
  if (isCriticalProductTop(product?.Top)) {
    return 'red.7'
  }

  if (product?.IsForSale) {
    return 'blue.7'
  }

  if (product?.IsForZeroSale) {
    return 'green.7'
  }

  return undefined
}

export function isProductRealtimePayloadForProduct(
  payload: unknown,
  product?: Pick<Product, 'Id' | 'NetUid'> | null,
): boolean {
  if (!product) {
    return false
  }

  const payloadIdentity = readRealtimeProductIdentity(payload)
  const productNetUid = normalizeIdentity(product.NetUid)

  if (payloadIdentity.netUid && productNetUid) {
    return payloadIdentity.netUid === productNetUid
  }

  if (payloadIdentity.id !== undefined && typeof product.Id === 'number') {
    return payloadIdentity.id === product.Id
  }

  return !payloadIdentity.netUid && payloadIdentity.id === undefined
}

function readRealtimeProductIdentity(payload: unknown): { id?: number; netUid?: string } {
  if (!payload || typeof payload !== 'object') {
    return {}
  }

  const source = payload as Record<string, unknown>
  const nestedProduct = source.Product && typeof source.Product === 'object'
    ? source.Product as Record<string, unknown>
    : null
  const productSource = nestedProduct || source

  return {
    id: readNumber(productSource.Id) ?? readNumber(source.ProductId),
    netUid: normalizeIdentity(
      readString(productSource.NetUid)
      || readString(productSource.NetUID)
      || readString(productSource.NetId)
      || readString(productSource.NetID)
      || readString(source.ProductNetUid)
      || readString(source.ProductNetId),
    ),
  }
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  return undefined
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function normalizeIdentity(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase()

  return normalized || undefined
}
