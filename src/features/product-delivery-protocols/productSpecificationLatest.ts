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

  const date = value instanceof Date ? value : parseProductSpecificationDate(value)

  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

function parseProductSpecificationDate(value: string): Date {
  const trimmedValue = value.trim()
  const localizedMatch = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(trimmedValue)

  if (localizedMatch) {
    const [, dayValue, monthValue, yearValue, hourValue = '0', minuteValue = '0', secondValue = '0'] = localizedMatch
    const day = Number(dayValue)
    const month = Number(monthValue)
    const yearPart = Number(yearValue)
    const year = yearValue.length === 2 ? 2000 + yearPart : yearPart
    const hour = Number(hourValue)
    const minute = Number(minuteValue)
    const second = Number(secondValue)
    const date = new Date(year, month - 1, day, hour, minute, second)

    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day &&
      date.getHours() === hour &&
      date.getMinutes() === minute &&
      date.getSeconds() === second
    ) {
      return date
    }
  }

  return new Date(trimmedValue)
}
