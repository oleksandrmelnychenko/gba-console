import { apiRequest } from '../../../shared/api/apiClient'
import type {
  ConsumableProduct,
  ConsumableProductCategory,
  MeasureUnit,
} from '../types'

type ConsumableCategoriesRequestOptions = {
  refreshToken?: number
}

export async function getConsumableProductCategories(
  options: ConsumableCategoriesRequestOptions = {},
): Promise<ConsumableProductCategory[]> {
  const result = await apiRequest<unknown>('/consumables/categories/all', {
    query: {
      refreshToken: options.refreshToken,
    },
  })

  return normalizeConsumableProductCategories(result)
}

export async function searchConsumableProductCategories(
  value: string,
  options: ConsumableCategoriesRequestOptions = {},
): Promise<ConsumableProductCategory[]> {
  const result = await apiRequest<unknown>('/consumables/categories/search', {
    query: {
      refreshToken: options.refreshToken,
      value,
    },
  })

  return normalizeConsumableProductCategories(result)
}

export async function createConsumableProductCategory(
  category: ConsumableProductCategory,
): Promise<ConsumableProductCategory | null> {
  const result = await apiRequest<unknown>('/consumables/categories/new', {
    method: 'POST',
    body: category,
  })

  return normalizeConsumableProductCategory(result)
}

export async function updateConsumableProductCategory(
  category: ConsumableProductCategory,
): Promise<ConsumableProductCategory | null> {
  const result = await apiRequest<unknown>('/consumables/categories/update', {
    method: 'POST',
    body: category,
  })

  return normalizeConsumableProductCategory(result)
}

export async function deleteConsumableProductCategory(netId: string): Promise<void> {
  await apiRequest<unknown>('/consumables/categories/delete', {
    method: 'DELETE',
    query: {
      netId,
    },
  })
}

export async function createConsumableProduct(product: ConsumableProduct): Promise<ConsumableProduct | null> {
  const result = await apiRequest<unknown>('/consumables/products/new', {
    method: 'POST',
    body: product,
  })

  return normalizeConsumableProduct(result)
}

export async function updateConsumableProduct(product: ConsumableProduct): Promise<ConsumableProduct | null> {
  const result = await apiRequest<unknown>('/consumables/products/update', {
    method: 'POST',
    body: product,
  })

  return normalizeConsumableProduct(result)
}

export async function deleteConsumableProduct(netId: string): Promise<void> {
  await apiRequest<unknown>('/consumables/products/delete', {
    method: 'DELETE',
    query: {
      netId,
    },
  })
}

export async function searchMeasureUnits(value: string): Promise<MeasureUnit[]> {
  const result = await apiRequest<unknown>('/measureunits/search', {
    query: {
      value: value.trim(),
    },
  })

  return readArrayPayload(result, ['Items', 'MeasureUnits', 'Data']) as MeasureUnit[]
}

function normalizeConsumableProductCategories(result: unknown): ConsumableProductCategory[] {
  return readArrayPayload(result, ['Items', 'ConsumableProductCategories', 'Categories', 'Data'])
    .map(normalizeConsumableProductCategory)
    .filter((category): category is ConsumableProductCategory => Boolean(category))
}

function normalizeConsumableProductCategory(result: unknown): ConsumableProductCategory | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const category = result as ConsumableProductCategory

  return {
    ...category,
    ConsumableProducts: Array.isArray(category.ConsumableProducts)
      ? category.ConsumableProducts
          .map(normalizeConsumableProduct)
          .filter((product): product is ConsumableProduct => Boolean(product))
      : [],
  }
}

function normalizeConsumableProduct(result: unknown): ConsumableProduct | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  return result as ConsumableProduct
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
