import type { Product, ProductImage, ProductOriginalNumber, ProductSearchMode, ProductSortMode } from './types'
import { translate } from '../../shared/i18n/translate'

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'
const PRODUCT_SHOP_IMAGE_BASE_URL = 'https://concord-shop.com/userdata/shop/product/'

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 3,
})

const priceFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export const PRODUCT_SEARCH_MODE_OPTIONS: Array<{ label: string; value: ProductSearchMode }> = [
  { value: '5', label: 'Усі поля' },
  { value: '0', label: 'Код виробника' },
  { value: '1', label: 'Оригінальний/крос номер' },
  { value: '2', label: 'Розмір' },
  { value: '3', label: 'Назва' },
  { value: '4', label: 'Опис' },
]

export const PRODUCT_SORT_MODE_OPTIONS: Array<{ label: string; value: ProductSortMode }> = [
  { value: '2', label: 'Назва' },
  { value: '0', label: 'Top' },
  { value: '1', label: 'Код виробника' },
]

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

  const originalNumber = product?.ProductOriginalNumbers?.find((item) => item.IsMainOriginalNumber)?.OriginalNumber
    || product?.ProductOriginalNumbers?.[0]?.OriginalNumber

  return originalNumber?.MainNumber?.trim() || originalNumber?.Number?.trim() || ''
}

export function getProductGroupNames(product?: Product | null): string {
  const directNames = product?.ProductGroupNames?.trim()

  if (directNames) {
    return directNames
  }

  const groupNames = product?.ProductProductGroups?.reduce<string[]>((names, productGroup) => {
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

  return (
    product?.ProductImages?.find((image) => image.IsMainImage && Boolean(image.ImageUrl))
    || product?.ProductImages?.find((image) => Boolean(image.ImageUrl))
    || (product?.Image ? { ImageUrl: product.Image } : null)
    || (shopImageUrl ? { ImageUrl: shopImageUrl } : null)
  )
}

export function getProductShopImageUrl(product?: Product | null): string {
  const vendorCode = product?.VendorCode?.trim()

  return vendorCode ? `${PRODUCT_SHOP_IMAGE_BASE_URL}${normalizeProductShopImageCode(vendorCode.toLowerCase())}_water.jpg` : ''
}

export function getProductShopGalleryImageUrl(vendorCode: string, suffix: number): string {
  return `${PRODUCT_SHOP_IMAGE_BASE_URL}${normalizeProductShopImageCode(vendorCode.trim().toLowerCase())}_${suffix}_water.jpg`
}

export function getProductOriginalNumbers(product?: Product | null): ProductOriginalNumber[] {
  return product?.ProductOriginalNumbers?.filter((item) => Boolean(item.OriginalNumber)) || []
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
  const values = product?.ProductAvailabilities?.map((availability) => availability.Amount) || []

  if (values.length === 0) {
    values.push(
      product?.AvailableQtyUk,
      product?.AvailableQtyUkVAT,
      product?.AvailableQtyUkReSale,
      product?.AvailableQtyRoad,
    )
  }

  return values.reduce<number>(
    (total, value) => total + (typeof value === 'number' && Number.isFinite(value) ? value : 0),
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

export function getRelatedProductRowColor(product?: Partial<Product> | null): string | undefined {
  const top = product?.Top?.trim().toLowerCase()

  if (top === 'x9' || top === 'х9') {
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
