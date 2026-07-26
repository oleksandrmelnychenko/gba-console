import { apiRequest } from '../../../shared/api/apiClient'
import { readSession } from '../../../shared/auth/session'
import type {
  ProductTransfer,
  ProductTransferCreateFromFilePayload,
  ProductTransferExportDocument,
  ProductTransfersResponse,
  ProductTransfersSearchParams,
  ProductTransferStorage,
} from '../types'

export async function getProductTransfers(params: ProductTransfersSearchParams): Promise<ProductTransfersResponse> {
  const result = await apiRequest<unknown>('/products/transfers/all/filtered', {
    query: {
      from: params.from,
      limit: params.limit,
      offset: params.offset,
      to: params.to,
    },
  })

  return normalizeProductTransfersResponse(result)
}

export async function getProductTransferByNetId(netId: string): Promise<ProductTransfer | null> {
  const result = await apiRequest<unknown>('/products/transfers/get', {
    query: {
      netId,
    },
  })

  return normalizeProductTransfer(result)
}

export async function getProductTransferStorages(): Promise<ProductTransferStorage[]> {
  const result = await apiRequest<unknown>('/storages/get/all')

  return normalizeStorages(result)
}

export async function exportProductTransferDocument(netId: string): Promise<ProductTransferExportDocument> {
  const result = await apiRequest<unknown>('/products/transfers/document/export', {
    query: {
      netId,
    },
  })

  return normalizeExportDocument(result)
}

export async function addProductTransferFromFile(payload: ProductTransferCreateFromFilePayload): Promise<string[]> {
  const snapshot = createFileImportSnapshot(payload)
  const ownerNetUid = getProductTransferOwnerNetUid()
  const signature = await createFileImportSignature(snapshot, ownerNetUid)
  const inFlight = inFlightFileImports.get(signature)

  if (inFlight) {
    return inFlight
  }

  const request = executeProductTransferFileImport(snapshot, ownerNetUid, signature).finally(() => {
    inFlightFileImports.delete(signature)
  })
  inFlightFileImports.set(signature, request)

  return request
}

type ProductTransferFileImportSnapshot = {
  file: File
  parseConfigurationJson: string
  productTransferJson: string
}

type ProductTransferFileOperation = {
  operationNetUid: string
  storageKey: string
}

const PRODUCT_TRANSFER_FILE_OPERATION_STORAGE_PREFIX = 'gba:product-transfer-file-operation:v1'
const operationNetUidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const inFlightFileImports = new Map<string, Promise<string[]>>()

async function executeProductTransferFileImport(
  snapshot: ProductTransferFileImportSnapshot,
  ownerNetUid: string,
  signature: string,
): Promise<string[]> {
  const operation = getOrCreateFileImportOperation(ownerNetUid, signature)
  const formData = new FormData()
  formData.append('parseConfiguration', snapshot.parseConfigurationJson)
  formData.append('productTransfer', snapshot.productTransferJson)
  formData.append('file', snapshot.file)

  try {
    const result = await apiRequest<unknown>('/products/transfers/add/file', {
      method: 'POST',
      headers: {
        'Idempotency-Key': operation.operationNetUid,
      },
      query: {
        operationNetUid: operation.operationNetUid,
      },
      body: formData,
    })
    removeFileImportOperation(operation)

    return normalizeMessages(result)
  } catch (error) {
    if (!isUnknownFileImportOutcome(error)) {
      removeFileImportOperation(operation)
    }

    throw error
  }
}

function createFileImportSnapshot(
  payload: ProductTransferCreateFromFilePayload,
): ProductTransferFileImportSnapshot {
  if (!(payload.file instanceof File)) {
    throw new Error('Excel file is required for product transfer import')
  }

  return {
    file: payload.file,
    parseConfigurationJson: JSON.stringify(payload.parseConfiguration),
    productTransferJson: JSON.stringify(payload.productTransfer),
  }
}

async function createFileImportSignature(
  snapshot: ProductTransferFileImportSnapshot,
  ownerNetUid: string,
): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Secure product transfer operation identity is unavailable')
  }

  const fileDigest = await sha256Bytes(await snapshot.file.arrayBuffer())
  return sha256Text(
    JSON.stringify({
      fileDigest,
      ownerNetUid,
      parseConfiguration: snapshot.parseConfigurationJson,
      productTransfer: snapshot.productTransferJson,
    }),
  )
}

function getOrCreateFileImportOperation(
  ownerNetUid: string,
  signature: string,
): ProductTransferFileOperation {
  const storageKey = `${PRODUCT_TRANSFER_FILE_OPERATION_STORAGE_PREFIX}:${ownerNetUid}:${signature}`
  const persisted = readPersistedFileImportOperation(storageKey)

  if (persisted) {
    return {
      operationNetUid: persisted,
      storageKey,
    }
  }
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Secure product transfer operation identity is unavailable')
  }

  const operationNetUid = globalThis.crypto.randomUUID()
  writePersistedFileImportOperation(storageKey, operationNetUid)

  return {
    operationNetUid,
    storageKey,
  }
}

function getProductTransferOwnerNetUid(): string {
  const session = readSession()
  const ownerNetUid = session?.userNetUid || session?.user?.NetUid

  if (!ownerNetUid?.trim()) {
    throw new Error('Authenticated product transfer owner identity is unavailable')
  }

  return ownerNetUid.trim().toLowerCase()
}

async function sha256Text(value: string): Promise<string> {
  return sha256Bytes(new TextEncoder().encode(value))
}

async function sha256Bytes(value: BufferSource): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Secure product transfer operation identity is unavailable')
  }

  const digest = await globalThis.crypto.subtle.digest('SHA-256', value)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function readPersistedFileImportOperation(storageKey: string): string | null {
  try {
    const value = globalThis.localStorage?.getItem(storageKey)
    return value && operationNetUidPattern.test(value) ? value : null
  } catch {
    return null
  }
}

function writePersistedFileImportOperation(storageKey: string, operationNetUid: string) {
  try {
    globalThis.localStorage?.setItem(storageKey, operationNetUid)
  } catch {
    // The in-memory map still deduplicates rapid repeated submissions.
  }
}

function removeFileImportOperation(operation: ProductTransferFileOperation) {
  try {
    if (globalThis.localStorage?.getItem(operation.storageKey) === operation.operationNetUid) {
      globalThis.localStorage.removeItem(operation.storageKey)
    }
  } catch {
    // A stale key can only cause a safe server replay for the same file payload.
  }
}

function isUnknownFileImportOutcome(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('status' in error)) {
    return true
  }

  const status = Number(error.status)
  return status === 0 || status === 408 || status === 504 || status >= 500
}

function normalizeProductTransfersResponse(result: unknown): ProductTransfersResponse {
  const items = normalizeProductTransfers(result)
  const payload = result && typeof result === 'object' && !Array.isArray(result) ? (result as Record<string, unknown>) : {}
  const totalQty =
    readNumber(payload.TotalRowsQty) ??
    readNumber(payload.TotalQty) ??
    readNumber(payload.Total) ??
    readNumber(payload.Count) ??
    readNumber(items[0]?.TotalRowsQty) ??
    items.length

  return { items, totalQty }
}

function normalizeProductTransfers(result: unknown): ProductTransfer[] {
  if (Array.isArray(result)) {
    return result.map(ensureProductTransfer)
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>
  const items = Array.isArray(payload.Items)
    ? payload.Items
    : Array.isArray(payload.ProductTransfers)
      ? payload.ProductTransfers
      : Array.isArray(payload.Data)
        ? payload.Data
        : []

  return (items as ProductTransfer[]).map(ensureProductTransfer)
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsedValue = Number(value)

    if (Number.isFinite(parsedValue)) {
      return parsedValue
    }
  }

  return null
}

function normalizeProductTransfer(result: unknown): ProductTransfer | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  return ensureProductTransfer(result as ProductTransfer)
}

function normalizeStorages(result: unknown): ProductTransferStorage[] {
  if (Array.isArray(result)) {
    return result as ProductTransferStorage[]
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>

  if (Array.isArray(payload.Items)) {
    return payload.Items as ProductTransferStorage[]
  }

  if (Array.isArray(payload.Storages)) {
    return payload.Storages as ProductTransferStorage[]
  }

  if (Array.isArray(payload.Collection)) {
    return payload.Collection as ProductTransferStorage[]
  }

  return []
}

function normalizeExportDocument(result: unknown): ProductTransferExportDocument {
  if (!result || typeof result !== 'object') {
    return {}
  }

  const payload = result as Record<string, unknown>

  return {
    DocumentURL: typeof payload.DocumentURL === 'string' ? payload.DocumentURL : '',
    PdfDocumentURL:
      typeof payload.PdfDocumentURL === 'string'
        ? payload.PdfDocumentURL
        : typeof payload.PdfDocument === 'string'
          ? payload.PdfDocument
          : '',
  }
}

function normalizeMessages(result: unknown): string[] {
  if (Array.isArray(result)) {
    return result.reduce<string[]>((items, item) => {
      const value = String(item)

      if (value) {
        items.push(value)
      }

      return items
    }, [])
  }

  if (typeof result === 'string') {
    return result.trim() ? [result] : []
  }

  return []
}

function ensureProductTransfer(productTransfer: ProductTransfer): ProductTransfer {
  return {
    ...productTransfer,
    ProductTransferItems: Array.isArray(productTransfer.ProductTransferItems)
      ? productTransfer.ProductTransferItems.map((item) => ({
          ...item,
          ProductLocations: Array.isArray(item.ProductLocations) ? item.ProductLocations : [],
        }))
      : [],
  }
}
