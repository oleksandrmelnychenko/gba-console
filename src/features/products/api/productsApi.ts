import { apiRequest } from '../../../shared/api/apiClient'
import type {
  Product,
  ProductConsignmentRemaining,
  ProductGroup,
  ProductMovement,
  ProductMovementsParams,
  ProductReservation,
  ProductSearchParams,
  ProductStorageLocationHistory,
  ProductStorageLocationHistoryParams,
  ProductWriteOffRule,
  ProductWriteOffRulePayload,
} from '../types'
import { getEmptyGuid } from '../utils'

export async function getProducts(params: ProductSearchParams): Promise<Product[]> {
  const value = params.value?.trim() || ''
  const result = value
    ? await apiRequest<unknown>('/products/search/advanced', {
        query: {
          limit: params.limit,
          mode: params.searchMode,
          netId: getEmptyGuid(),
          offset: params.offset,
          sortMode: params.sortMode,
          value,
        },
      })
    : await apiRequest<unknown>('/products/all/limited', {
        query: {
          limit: params.limit,
          offset: params.offset,
        },
      })

  return normalizeProducts(result).map(ensureProduct)
}

export async function getProductByNetId(netId: string): Promise<Product | null> {
  const result = await apiRequest<unknown>('/products/get', {
    query: {
      netId,
    },
  })

  return normalizeProduct(result)
}

export async function getProductReservationByNetId(netId: string): Promise<ProductReservation> {
  const result = await apiRequest<unknown>('/products/reservations/get/info', {
    query: {
      netId,
    },
    errorMessages: {
      default: 'Не вдалося завантажити резерви товару',
      network: 'Сервер резервів недоступний',
    },
  })

  return normalizeReservation(result)
}

export async function updateProduct(product: Product, descriptionOnly = false): Promise<Product | null> {
  const result = await apiRequest<unknown>('/products/update', {
    method: 'POST',
    query: {
      descriptionOnly,
    },
    body: buildProductUpdatePayload(product),
    errorMessages: {
      default: 'Не вдалося зберегти товар',
      network: 'Сервер товарів недоступний',
    },
  })

  return normalizeProduct(result)
}

export async function updateProductWithImages(product: Product, files: File[]): Promise<Product | null> {
  const formData = new FormData()

  files.forEach((file) => formData.append('images', file))
  formData.append('entity', JSON.stringify(buildProductImageUpdatePayload(product)))

  const result = await apiRequest<unknown>('/products/update/upload', {
    method: 'POST',
    body: formData,
    errorMessages: {
      default: 'Не вдалося зберегти зображення товару',
      network: 'Сервер зображень недоступний',
    },
  })

  return normalizeProduct(result)
}

export async function getProductStorageLocationHistory(
  params: ProductStorageLocationHistoryParams,
): Promise<ProductStorageLocationHistory[]> {
  const result = await apiRequest<unknown>('/products/placements/history/all/filtered', {
    query: {
      ProductNetId: params.productNetId,
      from: params.from,
      limit: params.limit,
      offset: params.offset,
      to: params.to,
    },
    errorMessages: {
      default: 'Не вдалося завантажити історію місця зберігання',
      network: 'Сервер історії недоступний',
    },
  })

  return normalizeArray(result) as ProductStorageLocationHistory[]
}

export async function getProductConsignmentRemainings(netId: string): Promise<ProductConsignmentRemaining[]> {
  const result = await apiRequest<unknown>('/consignments/remaining/all/product', {
    query: {
      netId,
    },
    errorMessages: {
      default: 'Не вдалося завантажити залишки по партіях',
      network: 'Сервер залишків недоступний',
    },
  })

  return normalizeArray(result) as ProductConsignmentRemaining[]
}

export async function getProductMovements(params: ProductMovementsParams): Promise<ProductMovement[]> {
  const result = await apiRequest<unknown>('/consignments/info/movement/filtered', {
    query: {
      from: params.from,
      movementType: params.movementType,
      productNetId: params.productNetId,
      to: params.to,
      types: params.types,
    },
    errorMessages: {
      default: 'Не вдалося завантажити рух товару',
      network: 'Сервер руху товару недоступний',
    },
  })

  return normalizeArray(result) as ProductMovement[]
}

export async function getProductWriteOffRulesByProductNetId(netId: string): Promise<ProductWriteOffRule[]> {
  const result = await apiRequest<unknown>('/products/writeoff/rules/all/product', {
    query: {
      netId,
    },
    errorMessages: {
      default: 'Не вдалося завантажити правила списання товару',
      network: 'Сервер правил списання недоступний',
    },
  })

  return normalizeArray(result) as ProductWriteOffRule[]
}

export async function getProductWriteOffRulesByProductGroupNetId(netId: string): Promise<ProductWriteOffRule[]> {
  const result = await apiRequest<unknown>('/products/writeoff/rules/all/productgroup', {
    query: {
      netId,
    },
    errorMessages: {
      default: 'Не вдалося завантажити правила списання групи товарів',
      network: 'Сервер правил списання недоступний',
    },
  })

  return normalizeArray(result) as ProductWriteOffRule[]
}

export async function getProductGroupsByProductNetId(productNetId: string): Promise<ProductGroup[]> {
  const result = await apiRequest<unknown>('/products/groups/all/product', {
    query: {
      productNetId,
    },
    errorMessages: {
      default: 'Не вдалося завантажити групи товару',
      network: 'Сервер груп товару недоступний',
    },
  })

  return normalizeArray(result) as ProductGroup[]
}

export async function addOrUpdateProductWriteOffRule(payload: ProductWriteOffRulePayload): Promise<ProductWriteOffRule | null> {
  const result = await apiRequest<unknown>('/products/writeoff/rules/process', {
    method: 'POST',
    body: payload,
    errorMessages: {
      default: 'Не вдалося зберегти правило списання',
      network: 'Сервер правил списання недоступний',
    },
  })

  if (result && typeof result === 'object') {
    return result as ProductWriteOffRule
  }

  return null
}

export async function deleteProductWriteOffRule(netUid: string): Promise<void> {
  await apiRequest<void>('/products/writeoff/rules/delete', {
    method: 'DELETE',
    query: {
      netId: netUid,
    },
    errorMessages: {
      default: 'Не вдалося видалити правило списання',
      network: 'Сервер правил списання недоступний',
    },
  })
}

function normalizeProduct(result: unknown): Product | null {
  if (result && typeof result === 'object') {
    return ensureProduct(result as Product)
  }

  return null
}

function normalizeProducts(result: unknown): Product[] {
  if (Array.isArray(result)) {
    return result as Product[]
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>

  if (Array.isArray(payload.Items)) {
    return payload.Items as Product[]
  }

  if (Array.isArray(payload.Products)) {
    return payload.Products as Product[]
  }

  return []
}

function normalizeArray(result: unknown): unknown[] {
  if (Array.isArray(result)) {
    return result
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>

  if (Array.isArray(payload.Items)) {
    return payload.Items
  }

  if (Array.isArray(payload.Collection)) {
    return payload.Collection
  }

  if (Array.isArray(payload.Data)) {
    return payload.Data
  }

  return []
}

function normalizeReservation(result: unknown): ProductReservation {
  if (result && typeof result === 'object') {
    return result as ProductReservation
  }

  return {}
}

function ensureProduct(product: Product): Product {
  return {
    ...product,
    BaseAnalogueProducts: Array.isArray(product.BaseAnalogueProducts) ? product.BaseAnalogueProducts : [],
    BaseSetProducts: Array.isArray(product.BaseSetProducts) ? product.BaseSetProducts : [],
    CalculatedPrices: Array.isArray(product.CalculatedPrices) ? product.CalculatedPrices : [],
    ComponentProducts: Array.isArray(product.ComponentProducts) ? product.ComponentProducts : [],
    ProductAvailabilities: Array.isArray(product.ProductAvailabilities) ? product.ProductAvailabilities : [],
    ProductImages: Array.isArray(product.ProductImages) ? product.ProductImages : [],
    ProductOriginalNumbers: Array.isArray(product.ProductOriginalNumbers) ? product.ProductOriginalNumbers : [],
    ProductPricings: Array.isArray(product.ProductPricings) ? product.ProductPricings : [],
    ProductProductGroups: Array.isArray(product.ProductProductGroups) ? product.ProductProductGroups : [],
    ProductSpecifications: Array.isArray(product.ProductSpecifications) ? product.ProductSpecifications : [],
  }
}

function buildProductUpdatePayload(product: Product): Product {
  return {
    ...product,
    BaseAnalogueProducts: undefined,
    BaseSetProducts: undefined,
    CalculatedPrices: undefined,
    ComponentProducts: undefined,
    ProductAvailabilities: undefined,
    ProductImages: undefined,
    ProductPricings: undefined,
    ProductProductGroups: undefined,
    ProductSpecifications: Array.isArray(product.ProductSpecifications) ? product.ProductSpecifications : undefined,
  }
}

function buildProductImageUpdatePayload(product: Product): Product {
  return {
    ...buildProductUpdatePayload(product),
    ProductImages: (product.ProductImages || []).filter((image) => image.Id || image.NetUid || image.FileName || image.ImageUrl),
  }
}
