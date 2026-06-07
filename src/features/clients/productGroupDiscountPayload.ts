import type { ProductGroupDiscount } from './types'

type ProductGroupPayload = {
  FullName?: string
  Id?: number
  Name?: string
  NetUid?: string
}

export function compactChangedProductGroupDiscounts(
  currentDiscounts: ProductGroupDiscount[],
  baselineDiscounts: ProductGroupDiscount[],
): ProductGroupDiscount[] {
  const baselineByKey = buildDiscountByKey(baselineDiscounts)

  return flattenDiscounts(currentDiscounts).reduce<ProductGroupDiscount[]>((acc, discount) => {
    const key = getDiscountKey(discount)
    const baseline = key ? baselineByKey.get(key) : undefined

    if (!baseline || hasDiscountChanged(discount, baseline)) {
      acc.push(toSaveDiscount(discount))
    }

    return acc
  }, [])
}

export function toSaveDiscount(discount: ProductGroupDiscount): ProductGroupDiscount {
  const productGroupId = getDiscountProductGroupId(discount)

  return {
    ...discount,
    IsSelected: undefined,
    ProductGroup: compactProductGroup(discount.ProductGroup, productGroupId),
    ProductGroupId: productGroupId,
    SubProductGroupDiscounts: [],
  }
}

function buildDiscountByKey(discounts: ProductGroupDiscount[]): Map<string, ProductGroupDiscount> {
  const result = new Map<string, ProductGroupDiscount>()

  flattenDiscounts(discounts).forEach((discount) => {
    const key = getDiscountKey(discount)

    if (key) {
      result.set(key, discount)
    }
  })

  return result
}

function flattenDiscounts(discounts: ProductGroupDiscount[] = []): ProductGroupDiscount[] {
  return discounts.reduce<ProductGroupDiscount[]>((items, discount) => {
    items.push(discount)

    if (Array.isArray(discount.SubProductGroupDiscounts)) {
      items.push(...flattenDiscounts(discount.SubProductGroupDiscounts))
    }

    return items
  }, [])
}

function hasDiscountChanged(current: ProductGroupDiscount, baseline: ProductGroupDiscount): boolean {
  return (
    normalizePercent(current.DiscountRate) !== normalizePercent(baseline.DiscountRate)
    || normalizeActive(current.IsActive) !== normalizeActive(baseline.IsActive)
  )
}

function getDiscountKey(discount: ProductGroupDiscount): string | undefined {
  const productGroup = readProductGroup(discount.ProductGroup)

  if (productGroup.NetUid) {
    return `net:${productGroup.NetUid}`
  }

  const productGroupId = getDiscountProductGroupId(discount)

  return typeof productGroupId === 'number' ? `id:${productGroupId}` : undefined
}

function getDiscountProductGroupId(discount: ProductGroupDiscount): number | undefined {
  if (typeof discount.ProductGroupId === 'number') {
    return discount.ProductGroupId
  }

  const productGroup = readProductGroup(discount.ProductGroup)

  return typeof productGroup.Id === 'number' ? productGroup.Id : undefined
}

function compactProductGroup(productGroup: unknown, fallbackId?: number): ProductGroupPayload {
  const value = readProductGroup(productGroup)

  return {
    FullName: value.FullName,
    Id: typeof value.Id === 'number' ? value.Id : fallbackId,
    Name: value.Name,
    NetUid: value.NetUid,
  }
}

function readProductGroup(productGroup: unknown): ProductGroupPayload {
  return productGroup && typeof productGroup === 'object' ? (productGroup as ProductGroupPayload) : {}
}

function normalizePercent(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function normalizeActive(value: unknown): boolean {
  return value !== false
}
