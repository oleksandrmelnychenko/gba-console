import { apiRequest } from '../../../shared/api/apiClient'
import type {
  ChangeProductSpecificationPayload,
  ProductSpecification,
  ProductSpecificationsSearchParams,
  SpecificationCodeUploadResult,
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

export async function uploadSpecificationCodesFile(file: File): Promise<SpecificationCodeUploadResult> {
  const formData = new FormData()
  formData.append('file', file)

  const result = await apiRequest<unknown>('/products/specification/new/all/file', {
    body: formData,
    method: 'POST',
  })

  const payload = (result && typeof result === 'object' ? result : {}) as Record<string, unknown>
  const invalid = payload.InvalidVendorCodes

  return {
    InvalidVendorCodes: Array.isArray(invalid) ? invalid.map((code) => String(code)) : [],
    ParsedCount: toCount(payload.ParsedCount),
    SuccessfullyUpdatedCount: toCount(payload.SuccessfullyUpdatedCount),
    UpdateWasNotRequiredCount: toCount(payload.UpdateWasNotRequiredCount),
  }
}

function toCount(value: unknown): number {
  const numberValue = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(numberValue) ? numberValue : 0
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
