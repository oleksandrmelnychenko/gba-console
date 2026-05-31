import { apiRequest } from '../../../shared/api/apiClient'
import type {
  ChangeProductSpecificationPayload,
  ProductSpecification,
  ProductSpecificationsSearchParams,
} from '../types'

export async function getProductSpecifications(
  params: ProductSpecificationsSearchParams,
): Promise<ProductSpecification[]> {
  const result = await apiRequest<unknown>('/specifications/get/all/filtered', {
    query: {
      vendorCode: params.vendorCode?.trim() || '',
      specificationCode: params.specificationCode?.trim() || '',
      locale: params.locale,
      limit: params.limit,
      offset: params.offset,
    },
  })

  return readArrayPayload(result, ['Items', 'ProductSpecifications', 'Specifications', 'Data']).map(
    (item) => item as ProductSpecification,
  )
}

export async function changeProductSpecification(
  payload: ChangeProductSpecificationPayload,
): Promise<ProductSpecification | null> {
  const result = await apiRequest<unknown>('/specifications/change', {
    method: 'POST',
    query: {
      specificationChangeMode: payload.specificationChangeMode,
    },
    body: payload.body,
  })

  if (!result || typeof result !== 'object') {
    return null
  }

  return result as ProductSpecification
}

function readArrayPayload(result: unknown, keys: string[]): unknown[] {
  if (Array.isArray(result)) {
    return result
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>

  for (const key of keys) {
    if (Array.isArray(payload[key])) {
      return payload[key] as unknown[]
    }
  }

  return []
}
