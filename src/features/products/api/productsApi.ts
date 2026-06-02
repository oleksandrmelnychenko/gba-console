import { apiRequest } from '../../../shared/api/apiClient'
import type {
  AuditEntity,
  Product,
  ProductAuditField,
  ProductConsignmentRemaining,
  ProductFileUploadConfiguration,
  ProductGroup,
  ProductIncomeMovement,
  ProductIncomeOutcomeMovementParams,
  ProductMovement,
  ProductMovementExportDocument,
  ProductMovementExportParams,
  ProductMovementsParams,
  ProductOutcomeMovement,
  ProductOriginalNumber,
  ProductPlacement,
  ProductPlacementStorage,
  ProductPlacementUploadConfiguration,
  ProductRelatedUploadType,
  ProductReservation,
  ProductSearchParams,
  ProductStorageLocationHistory,
  ProductStorageLocationHistoryParams,
  ProductUploadDocumentPayload,
  ProductWriteOffRule,
  ProductWriteOffRulePayload,
  Pricing,
  Storage,
} from '../types'
import { getEmptyGuid } from '../utils'

export async function getProducts(params: ProductSearchParams): Promise<Product[]> {
  const value = params.value?.trim() || ''
  const result = await apiRequest<unknown>('/products/search/advanced', {
    query: {
      limit: params.limit,
      mode: params.searchMode,
      netId: getEmptyGuid(),
      offset: params.offset,
      sortMode: params.sortMode,
      value,
    },
  })

  return normalizeProducts(result).map(ensureProduct)
}

export async function getProductUploadPricings(): Promise<Pricing[]> {
  const result = await apiRequest<unknown>('/pricings/all', {
    errorMessages: {
      default: 'Не вдалося завантажити типи цін',
      network: 'Сервер типів цін недоступний',
    },
  })

  return (normalizeArray(result) as Pricing[]).filter((pricing) => !pricing.BasePricingId)
}

export async function uploadProductsFromFile(configuration: ProductFileUploadConfiguration, file: File): Promise<void> {
  const formData = new FormData()

  formData.append('file', file)
  formData.append('configuration', JSON.stringify(configuration))

  await apiRequest<unknown>('/products/upload/file', {
    method: 'POST',
    body: formData,
    errorMessages: {
      default: 'Не вдалося завантажити файл товарів',
      network: 'Сервер завантаження товарів недоступний',
    },
  })
}

export async function getProductByNetId(netId: string): Promise<Product | null> {
  const result = await apiRequest<unknown>('/products/get', {
    query: {
      netId,
    },
  })

  return normalizeProduct(result)
}

export async function getProductAuditEntities(netId: string, fieldName: ProductAuditField): Promise<AuditEntity[]> {
  const result = await apiRequest<unknown>('/auditing/get/limited', {
    query: {
      fieldName,
      netId,
    },
    errorMessages: {
      default: 'Не вдалося завантажити історію змін',
      network: 'Сервер історії змін недоступний',
    },
  })

  return normalizeArray(result) as AuditEntity[]
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

export async function createProductWithImages(product: Product, files: File[]): Promise<Product | null> {
  const formData = new FormData()

  files.forEach((file) => formData.append('images', file))
  formData.append('entity', JSON.stringify(buildProductImageUpdatePayload(product)))

  const result = await apiRequest<unknown>('/products/new/upload', {
    method: 'POST',
    body: formData,
    errorMessages: {
      default: 'Не вдалося створити товар із зображеннями',
      network: 'Сервер зображень недоступний',
    },
  })

  return normalizeProduct(result)
}

export async function exportProductMovementsDocument(
  params: ProductMovementExportParams,
): Promise<ProductMovementExportDocument> {
  const result = await apiRequest<unknown>('/consignments/info/movement/document/export', {
    query: {
      from: params.from,
      movementType: params.movementType,
      productNetId: params.productNetId,
      to: params.to,
      types: params.types,
    },
    errorMessages: {
      default: 'Не вдалося сформувати документ руху товару',
      network: 'Сервер експорту руху товару недоступний',
    },
  })

  return normalizeExportDocument(result)
}

export async function getProductRecommendationForecast(params: {
  asOfDate: string
  forecastWeeks: number
  productNetId: string
  useCache?: boolean
}): Promise<unknown> {
  return apiRequest<unknown>('/recommendations/forecast', {
    query: {
      asOfDate: params.asOfDate,
      forecastWeeks: params.forecastWeeks,
      productNetId: params.productNetId,
      useCache: params.useCache ?? true,
    },
    errorMessages: {
      default: 'Не вдалося завантажити прогноз',
      network: 'Сервер прогнозів недоступний',
    },
  })
}

export async function getNonDefectiveStorages(): Promise<Storage[]> {
  const result = await apiRequest<unknown>('/storages/all/nondefective', {
    errorMessages: {
      default: 'Не вдалося завантажити склади',
      network: 'Сервер складів недоступний',
    },
  })

  return normalizeArray(result) as Storage[]
}

export async function uploadProductPlacementStorageFile(
  storageId: number,
  configuration: ProductPlacementUploadConfiguration,
  file: File,
): Promise<ProductPlacementStorage[]> {
  const formData = new FormData()

  formData.append('file', file)
  formData.append('storageId', JSON.stringify(storageId))
  formData.append('parseConfiguration', JSON.stringify(configuration))

  const result = await apiRequest<unknown>('/products/placements/storage/upload/placement/file', {
    method: 'POST',
    body: formData,
    errorMessages: {
      default: 'Не вдалося завантажити файл розміщення',
      network: 'Сервер розміщення недоступний',
    },
  })

  return normalizeArray(result) as ProductPlacementStorage[]
}

export async function uploadProductPlacementStorageReturn(
  storageId: number,
  productPlacementStorages: ProductPlacementStorage[],
): Promise<ProductPlacementStorage[]> {
  const result = await apiRequest<unknown>('/products/placements/storage/upload/placement/return', {
    method: 'POST',
    body: {
      productPlacementStorages,
      storageId,
    },
    errorMessages: {
      default: 'Не вдалося зберегти виправлені розміщення',
      network: 'Сервер розміщення недоступний',
    },
  })

  return normalizeArray(result) as ProductPlacementStorage[]
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

export async function getProductIncomeMovements(
  params: ProductIncomeOutcomeMovementParams,
): Promise<ProductIncomeMovement[]> {
  const result = await apiRequest<unknown>('/consignments/info/income/filtered', {
    query: {
      from: params.from,
      productNetId: params.productNetId,
      to: params.to,
    },
    errorMessages: {
      default: 'Не вдалося завантажити прихід товару',
      network: 'Сервер приходу недоступний',
    },
  })

  return normalizeArray(result) as ProductIncomeMovement[]
}

export async function getProductOutcomeMovements(
  params: ProductIncomeOutcomeMovementParams,
): Promise<ProductOutcomeMovement[]> {
  const result = await apiRequest<unknown>('/consignments/info/outcome/filtered', {
    query: {
      from: params.from,
      productNetId: params.productNetId,
      to: params.to,
    },
    errorMessages: {
      default: 'Не вдалося завантажити вихід товару',
      network: 'Сервер виходу недоступний',
    },
  })

  return normalizeArray(result) as ProductOutcomeMovement[]
}

export async function exportProductIncomeMovementsDocument(
  params: ProductIncomeOutcomeMovementParams,
): Promise<ProductMovementExportDocument> {
  const result = await apiRequest<unknown>('/consignments/info/income/document/export', {
    query: {
      from: params.from,
      productNetId: params.productNetId,
      to: params.to,
    },
    errorMessages: {
      default: 'Не вдалося сформувати документ приходу',
      network: 'Сервер експорту приходу недоступний',
    },
  })

  return normalizeExportDocument(result)
}

export async function exportProductOutcomeMovementsDocument(
  params: ProductIncomeOutcomeMovementParams,
): Promise<ProductMovementExportDocument> {
  const result = await apiRequest<unknown>('/consignments/info/outcome/document/export', {
    query: {
      from: params.from,
      productNetId: params.productNetId,
      to: params.to,
    },
    errorMessages: {
      default: 'Не вдалося сформувати документ виходу',
      network: 'Сервер експорту виходу недоступний',
    },
  })

  return normalizeExportDocument(result)
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

export async function updateProductPlacements(placements: ProductPlacement[]): Promise<void> {
  await apiRequest<unknown>('/products/placements/storage/update', {
    method: 'POST',
    body: placements,
    errorMessages: {
      default: 'Не вдалося зберегти місця зберігання',
      network: 'Сервер місць зберігання недоступний',
    },
  })
}

export async function createProductOriginalNumber(
  productNetId: string,
  code: string,
  isMain: boolean,
): Promise<ProductOriginalNumber[]> {
  const result = await apiRequest<unknown>('/originalnumbers/new', {
    method: 'POST',
    query: {
      isMain,
      productNetId,
    },
    body: {
      MainNumber: code,
      Number: code,
    },
    errorMessages: {
      default: 'Не вдалося додати оригінальний номер',
      network: 'Сервер оригінальних номерів недоступний',
    },
  })

  return normalizeArray(result) as ProductOriginalNumber[]
}

export async function updateProductOriginalNumber(
  productNetId: string,
  originalNumber: ProductOriginalNumber['OriginalNumber'],
  isMain: boolean,
): Promise<ProductOriginalNumber[]> {
  const result = await apiRequest<unknown>('/originalnumbers/update', {
    method: 'POST',
    query: {
      isMain,
      productNetId,
    },
    body: originalNumber,
    errorMessages: {
      default: 'Не вдалося оновити оригінальний номер',
      network: 'Сервер оригінальних номерів недоступний',
    },
  })

  return normalizeArray(result) as ProductOriginalNumber[]
}

export async function deleteProductOriginalNumber(
  productNetId: string,
  originalNumberNetId: string,
): Promise<ProductOriginalNumber[]> {
  const result = await apiRequest<unknown>('/originalnumbers/delete', {
    method: 'DELETE',
    query: {
      netId: originalNumberNetId,
      productNetId,
    },
    errorMessages: {
      default: 'Не вдалося видалити оригінальний номер',
      network: 'Сервер оригінальних номерів недоступний',
    },
  })

  return normalizeArray(result) as ProductOriginalNumber[]
}

export async function removeProductAnalogue({
  analogueNetId,
  baseProductNetId,
  removeIndirectAnalogues,
}: {
  analogueNetId: string
  baseProductNetId: string
  removeIndirectAnalogues: boolean
}): Promise<void> {
  await apiRequest<unknown>('/products/remove/analogues', {
    method: 'POST',
    query: {
      analogueNetId,
      baseProductNetId,
      removeIndirectAnalogues,
    },
    body: '',
    errorMessages: {
      default: 'Не вдалося видалити аналог',
      network: 'Сервер аналогів недоступний',
    },
  })
}

export async function removeProductComponent({
  baseProductNetId,
  componentNetId,
  isProductSet,
}: {
  baseProductNetId: string
  componentNetId: string
  isProductSet: boolean
}): Promise<void> {
  await apiRequest<unknown>('/products/remove/component', {
    method: 'POST',
    query: {
      baseProductNetId,
      componentNetId,
      isProductSet,
    },
    body: '',
    errorMessages: {
      default: 'Не вдалося видалити комплектуючу',
      network: 'Сервер комплектуючих недоступний',
    },
  })
}

export async function uploadProductRelatedDocument(
  type: ProductRelatedUploadType,
  payload: ProductUploadDocumentPayload,
  file: File,
): Promise<void> {
  const formData = new FormData()

  formData.append('productUploadDocument', JSON.stringify(payload))
  formData.append('file', file)

  await apiRequest<unknown>(getProductRelatedUploadEndpoint(type), {
    method: 'POST',
    body: formData,
    errorMessages: {
      default: 'Не вдалося завантажити файл товару',
      network: 'Сервер завантаження товару недоступний',
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

function getProductRelatedUploadEndpoint(type: ProductRelatedUploadType): string {
  switch (type) {
    case 'analogues':
      return '/products/upload/analogues/file'
    case 'components':
      return '/products/upload/components/file'
    case 'originalNumbers':
      return '/products/upload/oems/file'
  }
}

function normalizeReservation(result: unknown): ProductReservation {
  if (result && typeof result === 'object') {
    return result as ProductReservation
  }

  return {}
}

function normalizeExportDocument(result: unknown): ProductMovementExportDocument {
  if (!result || typeof result !== 'object') {
    return {}
  }

  const payload = result as Record<string, unknown>

  return {
    DocumentURL: typeof payload.DocumentURL === 'string' ? payload.DocumentURL : '',
    PdfDocumentURL: typeof payload.PdfDocumentURL === 'string' ? payload.PdfDocumentURL : '',
  }
}

function ensureProduct(product: Product): Product {
  return {
    ...product,
    AnalogueProducts: Array.isArray(product.AnalogueProducts) ? product.AnalogueProducts : [],
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
