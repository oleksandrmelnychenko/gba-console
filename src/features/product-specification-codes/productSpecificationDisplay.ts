import type { ProductSpecification } from './types'

export function getProductSpecificationDisplayName(specification: ProductSpecification): string {
  return firstNonBlank(specification.Name, specification.Product?.Name)
}

function firstNonBlank(...values: Array<string | undefined>): string {
  for (const value of values) {
    if (value?.trim()) {
      return value.trim()
    }
  }

  return ''
}
