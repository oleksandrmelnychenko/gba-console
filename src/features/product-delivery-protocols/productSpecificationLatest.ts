import type { ProductSpecificationEntity, SpecificationProduct } from './specificationTypes'

export type ProductSpecificationLike = {
  Created?: Date | string
  Id?: number
}

export function getLatestProductSpecification(product: SpecificationProduct | null | undefined): ProductSpecificationEntity | null {
  return getLatestProductSpecificationFromList(product?.ProductSpecifications)
}

export function getLatestProductSpecificationFromList<T extends ProductSpecificationLike>(
  specifications: T[] | null | undefined,
): T | null {
  return (specifications || []).reduce<T | null>((latest, current) => {
    if (!latest) {
      return current
    }

    const currentTime = getProductSpecificationDateTime(current.Created)
    const latestTime = getProductSpecificationDateTime(latest.Created)

    if (currentTime > latestTime) {
      return current
    }

    if (currentTime === latestTime && (current.Id || 0) > (latest.Id || 0)) {
      return current
    }

    return latest
  }, null)
}

export function getProductSpecificationDateTime(value?: Date | string): number {
  if (!value) {
    return 0
  }

  const date = value instanceof Date ? value : new Date(value)

  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}
