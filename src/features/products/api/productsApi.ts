import { apiRequest } from '../../../shared/api/apiClient'
import { readSession } from '../../../shared/auth/session'
import { normalizeExportDocument } from '../../../shared/documents/exportDocument'
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
  ProductSpecification,
  ProductSourcePriceComparison,
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
  const result = await apiRequest<unknown>('/products/assortment/search', {
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
  const normalizedConfiguration = normalizeProductFileUploadConfiguration(configuration)

  formData.append('file', file)
  formData.append('configuration', JSON.stringify(normalizedConfiguration))

  await apiRequest<unknown>('/products/assortment/upload/file', {
    method: 'POST',
    body: formData,
    errorMessages: {
      default: 'Не вдалося завантажити файл товарів',
      network: 'Сервер завантаження товарів недоступний',
    },
  })
}

function normalizeProductFileUploadConfiguration(
  configuration: ProductFileUploadConfiguration,
): ProductFileUploadConfiguration {
  const withPrices = configuration.WithPrices || configuration.PriceConfigurations.length > 0

  if (withPrices && typeof configuration.ImportedForAmg !== 'boolean') {
    throw new Error('Оберіть джерело цін: Контех (Fenix) або AMG')
  }

  const normalizedConfiguration: ProductFileUploadConfiguration = {
    ...configuration,
    WithPrices: withPrices,
  }

  if (!withPrices) {
    delete normalizedConfiguration.ImportedForAmg
  }

  return normalizedConfiguration
}

export async function getProductByNetId(netId: string, signal?: AbortSignal): Promise<Product | null> {
  const result = await apiRequest<unknown>('/products/assortment/details', {
    query: {
      netId,
    },
    signal,
  })

  return normalizeProduct(result)
}

export async function getProductForOrderSpecifications(netId: string, signal?: AbortSignal): Promise<Product | null> {
  const result = await apiRequest<unknown>('/products/orders-ukraine/specifications/details', {
    query: { netId },
    signal,
  })

  return normalizeProduct(result)
}

export async function getProductSourcePriceComparison(
  netId: string,
  signal?: AbortSignal,
): Promise<ProductSourcePriceComparison | null> {
  const result = await apiRequest<unknown>('/products/pricings/sources', {
    query: { netId },
    signal,
    errorMessages: {
      default: 'Не вдалося завантажити ціни з джерел',
      network: 'Джерела цін недоступні',
    },
  })

  return result && typeof result === 'object'
    ? result as ProductSourcePriceComparison
    : null
}

export async function getProductAuditEntities(netId: string, fieldName: ProductAuditField): Promise<AuditEntity[]> {
  const result = await apiRequest<unknown>('/auditing/products/assortment/history', {
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

export async function getProductReservationByNetId(netId: string, signal?: AbortSignal): Promise<ProductReservation> {
  const result = await apiRequest<unknown>('/products/reservations/get/info', {
    query: {
      netId,
    },
    signal,
    errorMessages: {
      default: 'Не вдалося завантажити резерви товару',
      network: 'Сервер резервів недоступний',
    },
  })

  return normalizeReservation(result)
}

export async function updateProduct(product: Product, descriptionOnly = false): Promise<Product | null> {
  const result = await apiRequest<unknown>('/products/assortment/update', {
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

export async function addProductSpecificationCode(product: Product, specification: ProductSpecification): Promise<Product | null> {
  const result = await apiRequest<unknown>('/products/assortment/specification/update', {
    method: 'POST',
    body: buildProductSpecificationPayload(product, specification),
    errorMessages: {
      default: 'Не вдалося зберегти специфікацію товару',
      network: 'Сервер специфікацій товару недоступний',
    },
  })

  return normalizeProduct(result)
}

export async function updateProductWithImages(
  product: Product,
  files: File[],
  permissionMode: 'delete' | 'upload' | 'upload-and-delete',
): Promise<Product | null> {
  const formData = new FormData()

  files.forEach((file) => formData.append('images', file))
  formData.append('entity', JSON.stringify(buildProductImageUpdatePayload(product)))

  const result = await apiRequest<unknown>(`/products/assortment/images/${permissionMode}`, {
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
  const result = await apiRequest<unknown>('/consignments/info/assortment/movement/document/export', {
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

  const result = await apiRequest<unknown>('/products/placements/storage/assortment/upload/placement/file', {
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
  const result = await apiRequest<unknown>('/products/placements/storage/assortment/upload/placement/return', {
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
  const result = await apiRequest<unknown>('/products/placements/history/assortment/all/filtered', {
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
  const result = await apiRequest<unknown>('/consignments/remaining/assortment/product', {
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
  const result = await apiRequest<unknown>('/consignments/info/assortment/movement/filtered', {
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
  const result = await apiRequest<unknown>('/consignments/info/assortment/income/filtered', {
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
  const result = await apiRequest<unknown>('/consignments/info/assortment/outcome/filtered', {
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
  const result = await apiRequest<unknown>('/consignments/info/assortment/income/document/export', {
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
  const result = await apiRequest<unknown>('/consignments/info/assortment/outcome/document/export', {
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
  const result = await apiRequest<unknown>('/products/writeoff/rules/assortment/all/product', {
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
  const result = await apiRequest<unknown>('/products/writeoff/rules/assortment/all/productgroup', {
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
  const result = await apiRequest<unknown>('/products/writeoff/rules/assortment/process', {
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
  await apiRequest<void>('/products/writeoff/rules/assortment/delete', {
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

const PRODUCT_PLACEMENT_UPDATE_STORAGE_PREFIX = 'gba.products.placement-update.v1'
const PRODUCT_PLACEMENT_UPDATE_VERSION = 1
const PRODUCT_PLACEMENT_UPDATE_OWNER_HEADER = 'X-Product-Placement-Update-Owner'
const PRODUCT_PLACEMENT_UPDATE_LEDGER_STATE_HEADER =
  'X-Product-Placement-Update-Ledger-State'
const inFlightProductPlacementUpdates = new Map<string, Promise<ProductPlacement[]>>()

type ProductPlacementUpdateSnapshot = {
  fingerprint: string
  operationNetUid: string
  ownerNetUid: string
  placements: ProductPlacement[]
  version: typeof PRODUCT_PLACEMENT_UPDATE_VERSION
}

export function updateProductPlacements(placements: ProductPlacement[]): Promise<ProductPlacement[]> {
  const ownerNetUid = getProductPlacementMutationOwner()
  const snapshotRows = groupProductPlacementsForEditing(placements)
  const canonicalPayload = canonicalizeProductPlacementTargets(snapshotRows)
  const inFlightKey = `${ownerNetUid}:${canonicalPayload}`
  const inFlight = inFlightProductPlacementUpdates.get(inFlightKey)

  if (inFlight) {
    return inFlight
  }

  const request = updateProductPlacementsCore(
    ownerNetUid,
    snapshotRows,
    canonicalPayload,
  ).finally(() => {
    inFlightProductPlacementUpdates.delete(inFlightKey)
  })

  inFlightProductPlacementUpdates.set(inFlightKey, request)
  return request
}

async function updateProductPlacementsCore(
  ownerNetUid: string,
  placements: ProductPlacement[],
  canonicalPayload: string,
): Promise<ProductPlacement[]> {
  const fingerprint = await sha256ProductPlacementPayload(canonicalPayload)
  const storageKey = `${PRODUCT_PLACEMENT_UPDATE_STORAGE_PREFIX}:${ownerNetUid}:${fingerprint}`
  const snapshot = readProductPlacementUpdateSnapshot(
    storageKey,
    ownerNetUid,
    fingerprint,
    canonicalPayload,
  ) ||
    createProductPlacementUpdateSnapshot(storageKey, ownerNetUid, fingerprint, placements)

  if (getProductPlacementMutationOwner() !== snapshot.ownerNetUid) {
    throw new Error('Користувач змінився до відправлення розміщень; запит не надіслано')
  }

  try {
    const result = await apiRequest<unknown>('/products/placements/storage/assortment/update', {
      method: 'POST',
      headers: {
        'Idempotency-Key': snapshot.operationNetUid,
        [PRODUCT_PLACEMENT_UPDATE_OWNER_HEADER]: snapshot.ownerNetUid,
      },
      query: {
        operationNetUid: snapshot.operationNetUid,
      },
      body: snapshot.placements,
      errorMessages: {
        default: 'Не вдалося зберегти місця зберігання',
        network: 'Сервер місць зберігання недоступний',
      },
    })
    removeProductPlacementUpdateSnapshot(storageKey, snapshot.operationNetUid)
    return normalizeArray(result) as ProductPlacement[]
  } catch (error) {
    if (isServerProvenProductPlacementRollback(error)) {
      removeProductPlacementUpdateSnapshot(storageKey, snapshot.operationNetUid)
    }

    throw error
  }
}

export function groupProductPlacementsForEditing(placements: ProductPlacement[]): ProductPlacement[] {
  if (!Array.isArray(placements) || placements.length === 0) {
    return []
  }

  const grouped = new Map<string, ProductPlacement[]>()
  placements.forEach((placement) => {
    const storageNumber = String(placement.StorageNumber || '').trim()
    const rowNumber = String(placement.RowNumber || '').trim()
    const cellNumber = String(placement.CellNumber || '').trim()
    const key = `${storageNumber.toUpperCase()}\u001f${rowNumber.toUpperCase()}\u001f${cellNumber.toUpperCase()}`
    const current = grouped.get(key)

    if (current) {
      current.push(placement)
    } else {
      grouped.set(key, [placement])
    }
  })

  return Array.from(grouped.entries())
    .sort(([left], [right]) => compareProductPlacementOrdinal(left, right))
    .map(([, rows]) => {
      const anchor = rows.toSorted(compareProductPlacementIdentity)[0]
      const productId = Number(anchor.ProductId || anchor.Product?.Id || 0)
      const storageId = Number(anchor.StorageId || anchor.Storage?.Id || 0)

      return {
        Id: Number(anchor.Id || 0),
        NetUid: anchor.NetUid || undefined,
        Qty: rows.reduce((total, row) => total + Number(row.Qty || 0), 0),
        StorageNumber: String(anchor.StorageNumber || '').trim(),
        RowNumber: String(anchor.RowNumber || '').trim(),
        CellNumber: String(anchor.CellNumber || '').trim(),
        ProductId: productId,
        StorageId: storageId,
        PackingListPackageOrderItemId: anchor.PackingListPackageOrderItemId || undefined,
        SupplyOrderUkraineItemId: anchor.SupplyOrderUkraineItemId || undefined,
        ConsignmentItemId: anchor.ConsignmentItemId || undefined,
      }
    })
}

function canonicalizeProductPlacementTargets(placements: ProductPlacement[]): string {
  return JSON.stringify(
    placements.map((placement) => ({
      id: Number(placement.Id || 0),
      productId: Number(placement.ProductId || 0),
      storageId: Number(placement.StorageId || 0),
      storageNumber: placement.StorageNumber || '',
      rowNumber: placement.RowNumber || '',
      cellNumber: placement.CellNumber || '',
      qty: Number(placement.Qty || 0),
      netUid: placement.NetUid || '',
      packingListPackageOrderItemId: Number(placement.PackingListPackageOrderItemId || 0),
      supplyOrderUkraineItemId: Number(placement.SupplyOrderUkraineItemId || 0),
      consignmentItemId: Number(placement.ConsignmentItemId || 0),
    })),
  )
}

function compareProductPlacementIdentity(left: ProductPlacement, right: ProductPlacement): number {
  const leftId = Number(left.Id || Number.MAX_SAFE_INTEGER)
  const rightId = Number(right.Id || Number.MAX_SAFE_INTEGER)

  return leftId - rightId
}

function compareProductPlacementOrdinal(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function getProductPlacementMutationOwner(): string {
  const session = readSession()
  const ownerNetUid = session?.userNetUid || session?.user?.NetUid

  if (!ownerNetUid?.trim()) {
    throw new Error('Немає ідентифікатора користувача для збереження розміщень')
  }

  const normalizedOwnerNetUid = ownerNetUid.trim().toLowerCase()

  if (!isNonEmptyGuid(normalizedOwnerNetUid)) {
    throw new Error('Ідентифікатор користувача для збереження розміщень некоректний')
  }

  return normalizedOwnerNetUid
}

async function sha256ProductPlacementPayload(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Браузер не підтримує безпечний повтор збереження розміщень')
  }

  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  )
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('')
}

function createProductPlacementUpdateSnapshot(
  storageKey: string,
  ownerNetUid: string,
  fingerprint: string,
  placements: ProductPlacement[],
): ProductPlacementUpdateSnapshot {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Браузер не підтримує безпечний ключ збереження розміщень')
  }

  const snapshot: ProductPlacementUpdateSnapshot = {
    fingerprint,
    operationNetUid: globalThis.crypto.randomUUID(),
    ownerNetUid,
    placements: JSON.parse(JSON.stringify(placements)) as ProductPlacement[],
    version: PRODUCT_PLACEMENT_UPDATE_VERSION,
  }
  const serializedSnapshot = JSON.stringify(snapshot)

  try {
    const storage = globalThis.localStorage

    if (!storage) {
      throw new Error('localStorage unavailable')
    }

    storage.setItem(storageKey, serializedSnapshot)
    if (storage.getItem(storageKey) !== serializedSnapshot) {
      throw new Error('persisted snapshot mismatch')
    }
  } catch {
    throw new Error('Не вдалося надійно зберегти операцію розміщення перед відправленням')
  }

  return deepFreezeProductPlacementSnapshot(snapshot)
}

function readProductPlacementUpdateSnapshot(
  storageKey: string,
  expectedOwnerNetUid?: string,
  expectedFingerprint?: string,
  expectedCanonicalPayload?: string,
): ProductPlacementUpdateSnapshot | null {
  let raw: string | null

  try {
    const storage = globalThis.localStorage

    if (!storage) {
      throw new Error('localStorage unavailable')
    }

    raw = storage.getItem(storageKey)
  } catch {
    throw new Error('Не вдалося прочитати збережену операцію розміщення; запит не надіслано')
  }

  if (!raw) {
    return null
  }

  let snapshot: ProductPlacementUpdateSnapshot
  try {
    snapshot = JSON.parse(raw) as ProductPlacementUpdateSnapshot
  } catch {
    throw new Error('Збережена операція розміщення пошкоджена; запит не надіслано')
  }

  if (
    snapshot?.version !== PRODUCT_PLACEMENT_UPDATE_VERSION ||
    !isProductPlacementOperationNetUid(snapshot.operationNetUid) ||
    !snapshot.ownerNetUid ||
    !/^[a-f0-9]{64}$/i.test(snapshot.fingerprint) ||
    !Array.isArray(snapshot.placements) ||
    (expectedOwnerNetUid && snapshot.ownerNetUid !== expectedOwnerNetUid) ||
    (expectedFingerprint && snapshot.fingerprint !== expectedFingerprint) ||
    (
      expectedCanonicalPayload &&
      canonicalizeProductPlacementTargets(snapshot.placements) !== expectedCanonicalPayload
    )
  ) {
    throw new Error('Збережена операція розміщення пошкоджена; запит не надіслано')
  }

  return deepFreezeProductPlacementSnapshot(snapshot)
}

function deepFreezeProductPlacementSnapshot(
  snapshot: ProductPlacementUpdateSnapshot,
): ProductPlacementUpdateSnapshot {
  snapshot.placements.forEach((placement) => Object.freeze(placement))
  Object.freeze(snapshot.placements)
  return Object.freeze(snapshot)
}

function removeProductPlacementUpdateSnapshot(storageKey: string, operationNetUid: string) {
  try {
    const current = readProductPlacementUpdateSnapshot(storageKey)

    if (current?.operationNetUid === operationNetUid) {
      globalThis.localStorage?.removeItem(storageKey)
    }
  } catch {
    // The server response is authoritative when browser storage is unavailable.
  }
}

function isProductPlacementOperationNetUid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function isNonEmptyGuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) &&
    value !== '00000000-0000-0000-0000-000000000000'
}

function isServerProvenProductPlacementRollback(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('headers' in error)) {
    return false
  }

  const headers = error.headers
  const ledgerState =
    headers instanceof Headers
      ? headers.get(PRODUCT_PLACEMENT_UPDATE_LEDGER_STATE_HEADER)
      : null

  return ledgerState?.toLowerCase() === 'not-entered' ||
    ledgerState?.toLowerCase() === 'rolled-back'
}

export function resetProductPlacementMutationStateForTests() {
  inFlightProductPlacementUpdates.clear()
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
      return '/products/assortment/upload/analogues/file'
    case 'components':
      return '/products/assortment/upload/components/file'
    case 'originalNumbers':
      return '/products/assortment/upload/oems/file'
  }
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
  const payload = { ...product }

  delete payload.AnalogueProducts
  delete payload.BaseAnalogueProducts
  delete payload.BaseSetProducts
  delete payload.CalculatedPrices
  delete payload.ComponentProducts
  delete payload.ProductAvailabilities
  delete payload.ProductImages
  delete payload.ProductOriginalNumbers
  delete payload.ProductPricings
  delete payload.ProductProductGroups
  delete payload.ProductSpecifications

  return payload
}

function buildProductSpecificationPayload(product: Product, specification: ProductSpecification): Product {
  return {
    ...buildProductUpdatePayload(product),
    ProductSpecifications: [
      ...(product.ProductSpecifications || []).map(prepareProductSpecificationPayload),
      prepareProductSpecificationPayload({
        ...specification,
        ProductId: specification.ProductId ?? product.Id,
      }),
    ],
  }
}

function prepareProductSpecificationPayload(specification: ProductSpecification): ProductSpecification {
  return {
    AddedBy: specification.AddedBy,
    CustomsValue: specification.CustomsValue,
    Duty: specification.Duty,
    Id: specification.Id,
    Name: specification.Name,
    NetUid: specification.NetUid,
    ProductId: specification.ProductId,
    SpecificationCode: specification.SpecificationCode,
    VATValue: specification.VATValue,
  }
}

function buildProductImageUpdatePayload(product: Product): Product {
  return {
    ...buildProductUpdatePayload(product),
    ProductImages: (product.ProductImages || []).filter((image) => image.Id || image.NetUid || image.FileName || image.ImageUrl),
  }
}
