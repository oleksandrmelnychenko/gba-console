import { apiRequest } from '../../../shared/api/apiClient'
import { readSession } from '../../../shared/auth/session'
import type {
  ProductStorageAvailableConsignment,
  ProductStorageAvailabilitiesResponse,
  ProductStorageAvailability,
  ProductStoragePlacement,
  ProductStorageStorage,
  ProductStorageSupplyReturnPayload,
  ProductStorageTransferPayload,
  ProductStorageWriteOffPayload,
  ProductStoragesExportDocument,
  ProductStoragesSearchParams,
} from '../types'

const PRODUCT_TRANSFER_OPERATION_STORAGE_PREFIX =
  'gba_console:product-transfer-operation:v2'
const PRODUCT_TRANSFER_OPERATION_KIND = 'product-transfer:add-manual'
const inFlightProductTransfers = new Map<string, Promise<void>>()
const pendingOperationKeys = new Map<string, Promise<ProductTransferOperation>>()
const SUPPLY_RETURN_OPERATION_STORAGE_PREFIX =
  'gba_console:supply-return-operation:v1'
const SUPPLY_RETURN_OPERATION_KIND = 'supply-return:add'
const MUTATION_LEDGER_STATE_HEADER = 'X-Mutation-Ledger-State'
const inFlightSupplyReturns = new Map<string, Promise<void>>()
const pendingSupplyReturnOperationKeys = new Map<
  string,
  Promise<SupplyReturnOperation>
>()
const LEGACY_DEPRECIATED_ORDER_OPERATION_STORAGE_PREFIX =
  'gba_console:depreciated-order-operation:v1'
const DEPRECIATED_ORDER_OPERATION_STORAGE_PREFIX =
  'gba_console:depreciated-order-operation:v2'
const DEPRECIATED_ORDER_OPERATION_KIND = 'depreciated-order:add-manual'
const DEPRECIATED_ORDER_OWNER_HEADER = 'X-Depreciated-Order-Owner'
const DEPRECIATED_ORDER_LEDGER_STATE_HEADER =
  'X-Depreciated-Order-Ledger-State'
const DEPRECIATED_ORDER_OPERATION_VERSION = 1
const EMPTY_NET_UID = '00000000-0000-0000-0000-000000000000'
const inFlightDepreciatedOrders = new Map<
  string,
  {
    canonicalPayload: string
    request: Promise<unknown>
  }
>()

type ProductTransferOperation = {
  operationNetUid: string
  storageKey: string
}

type SupplyReturnOperation = {
  operationNetUid: string
  storageKey: string
}

type DepreciatedOrderOperation = {
  operationNetUid: string
  ownerNetUid: string
  requestFingerprint: string
  serializedRecord: string
  snapshot: ProductStorageWriteOffPayload
  storageKey: string
}

type PersistedDepreciatedOrderOperation = {
  version: number
  operationKind: string
  operationNetUid: string
  ownerNetUid: string
  requestFingerprint: string
  payloadSnapshot: string
}

type ProductTransferFingerprintItem = {
  ProductId?: number | null
  Product?: { Id?: number | null } | null
  Qty?: number | null
  Reason?: string | null
}

type ProductTransferFingerprintBody = {
  Number?: string | null
  Comment?: string | null
  FromDate?: string | null
  IsManagement?: boolean
  FromStorageId?: number | null
  FromStorage?: { Id?: number | null } | null
  ToStorageId?: number | null
  ToStorage?: { Id?: number | null } | null
  OrganizationId?: number | null
  Organization?: { Id?: number | null } | null
  ResponsibleId?: number | null
  Responsible?: { Id?: number | null } | null
  ProductTransferItems?: Array<ProductTransferFingerprintItem | null> | null
}

type SupplyReturnFingerprintItem = {
  ConsignmentItemId?: number | null
  ConsignmentItem?: { Id?: number | null } | null
  ProductId?: number | null
  Product?: { Id?: number | null } | null
  Qty?: number | null
}

type SupplyReturnFingerprintBody = {
  Number?: string | null
  Comment?: string | null
  FromDate?: string | null
  IsManagement?: boolean
  SupplierId?: number | null
  Supplier?: { Id?: number | null } | null
  ClientAgreementId?: number | null
  ClientAgreement?: { Id?: number | null } | null
  OrganizationId?: number | null
  Organization?: { Id?: number | null } | null
  StorageId?: number | null
  Storage?: { Id?: number | null } | null
  ResponsibleId?: number | null
  Responsible?: { Id?: number | null } | null
  SupplyReturnItems?: Array<SupplyReturnFingerprintItem | null> | null
}

type DepreciatedOrderFingerprintItem = {
  Id?: number | null
  NetUid?: string | null
  Deleted?: boolean
  DepreciatedOrderId?: number | null
  ActReconciliationItemId?: number | null
  ProductId?: number | null
  Product?: { Id?: number | null } | null
  Qty?: number | null
  Reason?: string | null
}

type DepreciatedOrderFingerprintBody = {
  Id?: number | null
  NetUid?: string | null
  Deleted?: boolean
  Number?: string | null
  Comment?: string | null
  FromDate?: string | null
  IsManagement?: boolean
  StorageId?: number | null
  Storage?: { Id?: number | null } | null
  OrganizationId?: number | null
  Organization?: { Id?: number | null } | null
  ResponsibleId?: number | null
  Responsible?: { Id?: number | null } | null
  DepreciatedOrderItems?: Array<DepreciatedOrderFingerprintItem | null> | null
}

export async function getProductStorageStorages(): Promise<ProductStorageStorage[]> {
  const result = await apiRequest<unknown>('/storages/warehouse-accounting/all')

  return normalizeStorages(result)
}

export async function getAvailableProductsByStorage(
  params: ProductStoragesSearchParams,
): Promise<ProductStorageAvailabilitiesResponse> {
  const result = await apiRequest<unknown>('/storages/warehouse-accounting/available/filtered', {
    query: {
      from: params.from || '',
      limit: params.limit,
      netId: params.storageNetId,
      offset: params.offset,
      to: params.to || '',
      value: params.value?.trim() || '',
    },
  })

  return normalizeAvailabilitiesResponse(result)
}

export async function exportProductStorageAvailability(params: {
  from?: string
  storageNetId: string
  to?: string
}): Promise<ProductStoragesExportDocument> {
  const result = await apiRequest<unknown>('/storages/warehouse-accounting/document/export', {
    query: {
      from: params.from || '',
      netId: params.storageNetId,
      to: params.to || '',
    },
  })

  return normalizeExportDocument(result)
}

export function createProductStorageTransfer(payload: ProductStorageTransferPayload): Promise<void> {
  const ownerNetUid = getProductTransferOwnerNetUid()
  const canonicalPayload = canonicalizeProductStorageTransfer(payload, ownerNetUid)
  const inFlight = inFlightProductTransfers.get(canonicalPayload)

  if (inFlight) {
    return inFlight
  }

  const request = createProductStorageTransferCore(payload, canonicalPayload, ownerNetUid).finally(() => {
    inFlightProductTransfers.delete(canonicalPayload)
  })

  inFlightProductTransfers.set(canonicalPayload, request)
  return request
}

async function createProductStorageTransferCore(
  payload: ProductStorageTransferPayload,
  canonicalPayload: string,
  ownerNetUid: string,
): Promise<void> {
  const operation = await getOrCreateProductTransferOperation(canonicalPayload, ownerNetUid)

  try {
    await apiRequest<unknown>('/products/transfers/warehouse-accounting/new', {
      method: 'POST',
      headers: {
        'Idempotency-Key': operation.operationNetUid,
      },
      query: {
        storageNumber: payload.storageNumber || '',
        rowNumber: payload.rowNumber || '',
        cellNumber: payload.cellNumber || '',
      },
      body: payload.productTransfer,
    })
  } catch (error) {
    if (!isUnknownMutationOutcome(error)) {
      removeProductTransferOperation(operation)
    }

    throw error
  }

  removeProductTransferOperation(operation)
}

async function getOrCreateProductTransferOperation(
  canonicalPayload: string,
  ownerNetUid: string,
): Promise<ProductTransferOperation> {
  const pending = pendingOperationKeys.get(canonicalPayload)

  if (pending) {
    return pending
  }

  const operation = createProductTransferOperation(canonicalPayload, ownerNetUid).finally(() => {
    pendingOperationKeys.delete(canonicalPayload)
  })
  pendingOperationKeys.set(canonicalPayload, operation)

  return operation
}

async function createProductTransferOperation(
  canonicalPayload: string,
  ownerNetUid: string,
): Promise<ProductTransferOperation> {
  const fingerprint = await sha256(canonicalPayload)
  const storageKey = `${PRODUCT_TRANSFER_OPERATION_STORAGE_PREFIX}:${ownerNetUid}:${fingerprint}`
  const persistedOperationNetUid = readPersistedOperationKey(storageKey)

  if (persistedOperationNetUid) {
    return {
      operationNetUid: persistedOperationNetUid,
      storageKey,
    }
  }

  const operationNetUid = createOperationNetUid()
  writePersistedOperationKey(storageKey, operationNetUid)

  return {
    operationNetUid,
    storageKey,
  }
}

function canonicalizeProductStorageTransfer(
  payload: ProductStorageTransferPayload,
  ownerNetUid: string,
): string {
  const transfer = payload.productTransfer as ProductTransferFingerprintBody
  const canonical: string[] = []

  appendCanonicalField(canonical, 'operation', PRODUCT_TRANSFER_OPERATION_KIND)
  appendCanonicalField(canonical, 'owner', ownerNetUid)
  appendCanonicalField(canonical, 'number', nullableString(transfer.Number))
  appendCanonicalField(canonical, 'comment', nullableString(transfer.Comment))
  appendCanonicalField(
    canonical,
    'from-date',
    transfer.FromDate == null ? 'default' : String(transfer.FromDate),
  )
  appendCanonicalField(canonical, 'is-management', transfer.IsManagement ? '1' : '0')
  appendCanonicalField(canonical, 'from-storage-id', serverNumber(transfer.FromStorageId))
  appendCanonicalField(canonical, 'from-storage-reference-id', serverNumber(transfer.FromStorage?.Id))
  appendCanonicalField(canonical, 'to-storage-id', serverNumber(transfer.ToStorageId))
  appendCanonicalField(canonical, 'to-storage-reference-id', serverNumber(transfer.ToStorage?.Id))
  appendCanonicalField(canonical, 'organization-id', serverNumber(transfer.OrganizationId))
  appendCanonicalField(canonical, 'organization-reference-id', serverNumber(transfer.Organization?.Id))
  appendCanonicalField(canonical, 'responsible-id', serverNumber(transfer.ResponsibleId))
  appendCanonicalField(canonical, 'responsible-reference-id', serverNumber(transfer.Responsible?.Id))
  appendCanonicalField(canonical, 'storage-number', payload.storageNumber || '')
  appendCanonicalField(canonical, 'row-number', payload.rowNumber || '')
  appendCanonicalField(canonical, 'cell-number', payload.cellNumber || '')

  const items = (transfer.ProductTransferItems || [])
    .map(canonicalizeProductStorageTransferItem)
    .sort(compareOrdinal)

  appendCanonicalField(canonical, 'item-count', String(items.length))
  items.forEach((item) => appendCanonicalField(canonical, 'item', item))

  return canonical.join('')
}

function canonicalizeProductStorageTransferItem(
  item: ProductTransferFingerprintItem | null,
): string {
  if (!item) {
    return '<null>'
  }

  const canonical: string[] = []
  appendCanonicalField(canonical, 'product-id', serverNumber(item.ProductId))
  appendCanonicalField(canonical, 'product-reference-id', serverNumber(item.Product?.Id))
  appendCanonicalField(canonical, 'quantity', serverNumber(item.Qty))
  appendCanonicalField(canonical, 'reason', nullableString(item.Reason))
  return canonical.join('')
}

function appendCanonicalField(target: string[], name: string, value: string | null) {
  target.push(`${name}=${value === null ? '-1:' : `${value.length}:${value}`};`)
}

function nullableString(value: unknown): string | null {
  return value == null ? null : String(value)
}

function serverNumber(value: number | null | undefined): string {
  return String(value ?? 0)
}

function compareOrdinal(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function getProductTransferOwnerNetUid(): string {
  const session = readSession()
  const ownerNetUid = session?.userNetUid || session?.user?.NetUid

  if (!ownerNetUid?.trim()) {
    throw new Error('Authenticated product transfer owner identity is unavailable')
  }

  return ownerNetUid.trim().toLowerCase()
}

async function sha256(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Secure product transfer operation identity is unavailable')
  }

  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  )

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function createOperationNetUid(): string {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Secure product transfer operation identity is unavailable')
  }

  return globalThis.crypto.randomUUID()
}

function readPersistedOperationKey(storageKey: string): string | null {
  try {
    const operationNetUid = globalThis.localStorage?.getItem(storageKey)
    return operationNetUid && isOperationNetUid(operationNetUid) ? operationNetUid : null
  } catch {
    return null
  }
}

function writePersistedOperationKey(storageKey: string, operationNetUid: string) {
  try {
    globalThis.localStorage?.setItem(storageKey, operationNetUid)
  } catch {
    // In-memory in-flight reuse still prevents a rapid duplicate when storage is unavailable.
  }
}

function removeProductTransferOperation(operation: ProductTransferOperation) {
  try {
    if (globalThis.localStorage?.getItem(operation.storageKey) === operation.operationNetUid) {
      globalThis.localStorage.removeItem(operation.storageKey)
    }
  } catch {
    // The request result remains authoritative when browser storage is unavailable.
  }
}

function isOperationNetUid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function isUnknownMutationOutcome(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('status' in error)) {
    return true
  }

  const status = Number(error.status)
  return status === 0 || status === 504 || status >= 500
}

export function createProductStorageWriteOff(
  payload: ProductStorageWriteOffPayload,
): Promise<unknown> {
  const ownerNetUid = getDepreciatedOrderOwnerNetUid()
  const snapshot = createDepreciatedOrderPayloadSnapshot(payload)
  const canonicalPayload = canonicalizeProductStorageWriteOff(
    snapshot,
    ownerNetUid,
  )
  const inFlight = inFlightDepreciatedOrders.get(ownerNetUid)

  if (inFlight) {
    if (inFlight.canonicalPayload !== canonicalPayload) {
      return Promise.reject(
        new Error(
          'A different depreciated order request is pending for the authenticated owner',
        ),
      )
    }

    return inFlight.request
  }

  const request = createProductStorageWriteOffCore(
    snapshot,
    canonicalPayload,
    ownerNetUid,
  ).finally(() => {
    const current = inFlightDepreciatedOrders.get(ownerNetUid)
    if (current?.request === request) {
      inFlightDepreciatedOrders.delete(ownerNetUid)
    }
  })

  inFlightDepreciatedOrders.set(ownerNetUid, {
    canonicalPayload,
    request,
  })
  return request
}

async function createProductStorageWriteOffCore(
  snapshot: ProductStorageWriteOffPayload,
  canonicalPayload: string,
  ownerNetUid: string,
): Promise<unknown> {
  const operation = await getOrCreateDepreciatedOrderOperation(
    snapshot,
    canonicalPayload,
    ownerNetUid,
  )

  if (getDepreciatedOrderOwnerNetUid() !== ownerNetUid) {
    throw new Error(
      'Authenticated depreciated order owner changed before the request was sent',
    )
  }

  try {
    const result = await apiRequest<unknown>('/orders/depreciated/warehouse-accounting/new', {
      method: 'POST',
      dedupe: false,
      headers: {
        'Idempotency-Key': operation.operationNetUid,
        [DEPRECIATED_ORDER_OWNER_HEADER]: operation.ownerNetUid,
      },
      query: {
        operationNetUid: operation.operationNetUid,
      },
      body: operation.snapshot,
    })

    removeDepreciatedOrderOperation(operation)
    return result
  } catch (error) {
    if (isDefinitiveDepreciatedOrderFailure(error)) {
      removeDepreciatedOrderOperation(operation)
    }

    throw error
  }
}

async function getOrCreateDepreciatedOrderOperation(
  snapshot: ProductStorageWriteOffPayload,
  canonicalPayload: string,
  ownerNetUid: string,
): Promise<DepreciatedOrderOperation> {
  const requestFingerprint = await sha256(canonicalPayload)
  const storageKey =
    `${DEPRECIATED_ORDER_OPERATION_STORAGE_PREFIX}:${ownerNetUid}:${requestFingerprint}`
  let persisted = readPersistedDepreciatedOrderOperation(storageKey)

  if (!persisted) {
    persisted = migrateLegacyDepreciatedOrderOperation(
      ownerNetUid,
      requestFingerprint,
      storageKey,
    )
  }

  if (persisted) {
    if (!isValidDepreciatedOrderOperationIdentity(persisted, ownerNetUid)) {
      throw new Error(
        'The persisted depreciated order retry identity is invalid',
      )
    }

    const persistedSnapshot =
      parseDepreciatedOrderPayloadSnapshot(persisted.payloadSnapshot)
    const persistedCanonicalPayload = canonicalizeProductStorageWriteOff(
      persistedSnapshot,
      ownerNetUid,
    )
    const persistedFingerprint = await sha256(persistedCanonicalPayload)

    if (
      persistedFingerprint.toLowerCase() !==
      persisted.requestFingerprint.toLowerCase()
    ) {
      throw new Error(
        'The persisted depreciated order request snapshot is invalid',
      )
    }

    if (
      requestFingerprint.toLowerCase() !==
      persisted.requestFingerprint.toLowerCase()
    ) {
      throw new Error(
        'The persisted depreciated order retry identity is invalid',
      )
    }

    return {
      operationNetUid: persisted.operationNetUid,
      ownerNetUid,
      requestFingerprint: persisted.requestFingerprint,
      serializedRecord: persisted.serializedRecord,
      snapshot: persistedSnapshot,
      storageKey,
    }
  }

  const operationNetUid = createOperationNetUid()
  const payloadSnapshot = JSON.stringify(snapshot)
  const record: PersistedDepreciatedOrderOperation = {
    version: DEPRECIATED_ORDER_OPERATION_VERSION,
    operationKind: DEPRECIATED_ORDER_OPERATION_KIND,
    operationNetUid,
    ownerNetUid,
    requestFingerprint,
    payloadSnapshot,
  }
  const serializedRecord = JSON.stringify(record)
  writePersistedDepreciatedOrderOperation(storageKey, serializedRecord)

  return {
    operationNetUid,
    ownerNetUid,
    requestFingerprint,
    serializedRecord,
    snapshot,
    storageKey,
  }
}

function migrateLegacyDepreciatedOrderOperation(
  ownerNetUid: string,
  requestFingerprint: string,
  storageKey: string,
): (PersistedDepreciatedOrderOperation & { serializedRecord: string }) | null {
  const legacyStorageKey =
    `${LEGACY_DEPRECIATED_ORDER_OPERATION_STORAGE_PREFIX}:${ownerNetUid}`
  const legacyOperation = readPersistedDepreciatedOrderOperation(legacyStorageKey)

  if (
    !legacyOperation ||
    !isValidDepreciatedOrderOperationIdentity(legacyOperation, ownerNetUid) ||
    legacyOperation.requestFingerprint.toLowerCase() !==
      requestFingerprint.toLowerCase()
  ) {
    return null
  }

  writePersistedDepreciatedOrderOperation(
    storageKey,
    legacyOperation.serializedRecord,
  )
  removePersistedDepreciatedOrderOperation(
    legacyStorageKey,
    legacyOperation.serializedRecord,
  )
  return legacyOperation
}

function isValidDepreciatedOrderOperationIdentity(
  operation: PersistedDepreciatedOrderOperation,
  ownerNetUid: string,
): boolean {
  return operation.version === DEPRECIATED_ORDER_OPERATION_VERSION &&
    operation.operationKind === DEPRECIATED_ORDER_OPERATION_KIND &&
    operation.ownerNetUid === ownerNetUid &&
    isOperationNetUid(operation.operationNetUid) &&
    typeof operation.requestFingerprint === 'string' &&
    /^[0-9a-f]{64}$/i.test(operation.requestFingerprint)
}

function readPersistedDepreciatedOrderOperation(
  storageKey: string,
): (PersistedDepreciatedOrderOperation & { serializedRecord: string }) | null {
  let serializedRecord: string | null

  try {
    const storage = globalThis.localStorage
    if (!storage) {
      throw new Error('Browser storage is unavailable')
    }
    serializedRecord = storage.getItem(storageKey)
  } catch {
    throw new Error('Depreciated order retry identity could not be read')
  }

  if (serializedRecord === null) {
    return null
  }

  try {
    const record = JSON.parse(serializedRecord) as PersistedDepreciatedOrderOperation
    if (!record || typeof record !== 'object') {
      throw new Error('Invalid operation record')
    }

    return {
      ...record,
      serializedRecord,
    }
  } catch {
    throw new Error('The persisted depreciated order retry identity is invalid')
  }
}

function writePersistedDepreciatedOrderOperation(
  storageKey: string,
  serializedRecord: string,
) {
  try {
    const storage = globalThis.localStorage
    if (!storage) {
      throw new Error('Browser storage is unavailable')
    }

    storage.setItem(storageKey, serializedRecord)
    if (storage.getItem(storageKey) !== serializedRecord) {
      throw new Error('Browser storage did not retain the operation')
    }
  } catch {
    throw new Error('Depreciated order retry identity could not be persisted')
  }
}

function removeDepreciatedOrderOperation(
  operation: DepreciatedOrderOperation,
) {
  removePersistedDepreciatedOrderOperation(
    operation.storageKey,
    operation.serializedRecord,
  )
}

function removePersistedDepreciatedOrderOperation(
  storageKey: string,
  serializedRecord: string,
) {
  try {
    const storage = globalThis.localStorage
    if (
      storage?.getItem(storageKey) === serializedRecord
    ) {
      storage.removeItem(storageKey)
    }
  } catch {
    // A completed server response is authoritative even if local cleanup fails.
  }
}

function createDepreciatedOrderPayloadSnapshot(
  payload: ProductStorageWriteOffPayload,
): ProductStorageWriteOffPayload {
  try {
    const serialized = JSON.stringify(payload)
    return parseDepreciatedOrderPayloadSnapshot(serialized)
  } catch {
    throw new Error('The depreciated order request payload is not serializable')
  }
}

function parseDepreciatedOrderPayloadSnapshot(
  serialized: string,
): ProductStorageWriteOffPayload {
  const snapshot = JSON.parse(serialized) as ProductStorageWriteOffPayload
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new Error('The depreciated order request snapshot is invalid')
  }

  return snapshot
}

function canonicalizeProductStorageWriteOff(
  payload: ProductStorageWriteOffPayload,
  ownerNetUid: string,
): string {
  const order = payload as DepreciatedOrderFingerprintBody
  const canonical: string[] = []

  appendCanonicalField(
    canonical,
    'operation',
    DEPRECIATED_ORDER_OPERATION_KIND,
  )
  appendCanonicalField(canonical, 'owner', ownerNetUid)
  appendCanonicalField(canonical, 'id', serverNumber(order.Id))
  appendCanonicalField(
    canonical,
    'net-uid',
    String(order.NetUid || EMPTY_NET_UID).toLowerCase(),
  )
  appendCanonicalField(canonical, 'deleted', order.Deleted ? '1' : '0')
  appendCanonicalField(canonical, 'number', nullableString(order.Number))
  appendCanonicalField(canonical, 'comment', nullableString(order.Comment))
  appendCanonicalField(
    canonical,
    'from-date',
    canonicalizeDepreciatedOrderDate(order.FromDate),
  )
  appendCanonicalField(
    canonical,
    'is-management',
    order.IsManagement ? '1' : '0',
  )
  appendDepreciatedOrderIdentity(
    canonical,
    'storage',
    order.StorageId,
    order.Storage?.Id,
  )
  appendDepreciatedOrderIdentity(
    canonical,
    'organization',
    order.OrganizationId,
    order.Organization?.Id,
  )
  appendDepreciatedOrderIdentity(
    canonical,
    'responsible',
    order.ResponsibleId,
    order.Responsible?.Id,
  )

  const items = (order.DepreciatedOrderItems || [])
    .map(canonicalizeProductStorageWriteOffItem)
    .sort(compareOrdinal)
  appendCanonicalField(canonical, 'item-count', String(items.length))
  items.forEach((item) => appendCanonicalField(canonical, 'item', item))

  return canonical.join('')
}

function canonicalizeProductStorageWriteOffItem(
  item: DepreciatedOrderFingerprintItem | null,
): string {
  if (!item) {
    return '<null>'
  }

  const canonical: string[] = []
  appendCanonicalField(canonical, 'id', serverNumber(item.Id))
  appendCanonicalField(
    canonical,
    'net-uid',
    String(item.NetUid || EMPTY_NET_UID).toLowerCase(),
  )
  appendCanonicalField(canonical, 'deleted', item.Deleted ? '1' : '0')
  appendCanonicalField(
    canonical,
    'order-id',
    serverNumber(item.DepreciatedOrderId),
  )
  appendCanonicalField(
    canonical,
    'reconciliation-item-id',
    item.ActReconciliationItemId == null
      ? null
      : serverNumber(item.ActReconciliationItemId),
  )
  appendDepreciatedOrderIdentity(
    canonical,
    'product',
    item.ProductId,
    item.Product?.Id,
  )
  appendCanonicalField(canonical, 'quantity', serverNumber(item.Qty))
  appendCanonicalField(canonical, 'reason', nullableString(item.Reason))
  return canonical.join('')
}

function appendDepreciatedOrderIdentity(
  canonical: string[],
  name: string,
  scalarId: number | null | undefined,
  referenceId: number | null | undefined,
) {
  appendSupplyReturnIdentity(
    canonical,
    name,
    scalarId,
    referenceId,
  )
}

function canonicalizeDepreciatedOrderDate(
  value: string | null | undefined,
): string {
  if (value == null || value === '') {
    return 'default'
  }

  const raw = String(value)
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString()
}

function getDepreciatedOrderOwnerNetUid(): string {
  const session = readSession()
  const ownerNetUid = session?.userNetUid || session?.user?.NetUid
  const normalized = ownerNetUid?.trim().toLowerCase()

  if (!normalized || !isOperationNetUid(normalized)) {
    throw new Error(
      'Authenticated depreciated order owner identity is unavailable',
    )
  }

  return normalized
}

function isDefinitiveDepreciatedOrderFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('status' in error)) {
    return false
  }

  const status = Number(error.status)
  if (!Number.isInteger(status) || status < 400 || status >= 500) {
    return false
  }

  const headers = 'headers' in error ? error.headers : null
  const ledgerState = readHeader(
    headers,
    DEPRECIATED_ORDER_LEDGER_STATE_HEADER,
  )
    ?.trim()
    .toLowerCase()

  return ledgerState === 'not-entered' || ledgerState === 'rolled-back'
}

export async function getProductStorageAvailableConsignments(params: {
  productNetId: string
  storageNetId: string
}): Promise<ProductStorageAvailableConsignment[]> {
  const result = await apiRequest<unknown>('/consignments/remaining/warehouse-accounting/get/available', {
    query: params,
  })

  return readArrayPayload(result, ['Items', 'Consignments', 'Data']).map(normalizeAvailableConsignment)
}

export function createProductStorageSupplyReturn(
  payload: ProductStorageSupplyReturnPayload,
): Promise<void> {
  const ownerNetUid = getSupplyReturnOwnerNetUid()
  const canonicalPayload = canonicalizeProductStorageSupplyReturn(payload, ownerNetUid)
  const inFlight = inFlightSupplyReturns.get(canonicalPayload)

  if (inFlight) {
    return inFlight
  }

  const request = createProductStorageSupplyReturnCore(
    payload,
    canonicalPayload,
    ownerNetUid,
  ).finally(() => {
    inFlightSupplyReturns.delete(canonicalPayload)
  })

  inFlightSupplyReturns.set(canonicalPayload, request)
  return request
}

async function createProductStorageSupplyReturnCore(
  payload: ProductStorageSupplyReturnPayload,
  canonicalPayload: string,
  ownerNetUid: string,
): Promise<void> {
  const operation = await getOrCreateSupplyReturnOperation(
    canonicalPayload,
    ownerNetUid,
  )

  try {
    await apiRequest<unknown>('/supplies/returns/warehouse-accounting/new', {
      method: 'POST',
      dedupe: false,
      headers: {
        'Idempotency-Key': operation.operationNetUid,
      },
      body: payload,
    })
  } catch (error) {
    if (isDefinitiveSupplyReturnFailure(error)) {
      removeSupplyReturnOperation(operation)
    }

    throw error
  }

  removeSupplyReturnOperation(operation)
}

async function getOrCreateSupplyReturnOperation(
  canonicalPayload: string,
  ownerNetUid: string,
): Promise<SupplyReturnOperation> {
  const pending = pendingSupplyReturnOperationKeys.get(canonicalPayload)

  if (pending) {
    return pending
  }

  const operation = createSupplyReturnOperation(
    canonicalPayload,
    ownerNetUid,
  ).finally(() => {
    pendingSupplyReturnOperationKeys.delete(canonicalPayload)
  })
  pendingSupplyReturnOperationKeys.set(canonicalPayload, operation)

  return operation
}

async function createSupplyReturnOperation(
  canonicalPayload: string,
  ownerNetUid: string,
): Promise<SupplyReturnOperation> {
  const fingerprint = await sha256(canonicalPayload)
  const storageKey =
    `${SUPPLY_RETURN_OPERATION_STORAGE_PREFIX}:${ownerNetUid}:${fingerprint}`
  const persistedOperationNetUid = readPersistedOperationKey(storageKey)

  if (persistedOperationNetUid) {
    return {
      operationNetUid: persistedOperationNetUid,
      storageKey,
    }
  }

  const operationNetUid = createOperationNetUid()
  writePersistedSupplyReturnOperationKey(storageKey, operationNetUid)

  return {
    operationNetUid,
    storageKey,
  }
}

function writePersistedSupplyReturnOperationKey(
  storageKey: string,
  operationNetUid: string,
) {
  try {
    const storage = globalThis.localStorage
    if (!storage) {
      throw new Error('Browser storage is unavailable')
    }

    storage.setItem(storageKey, operationNetUid)
    if (storage.getItem(storageKey) !== operationNetUid) {
      throw new Error('Browser storage did not retain the operation identity')
    }
  } catch {
    throw new Error('Supply return retry identity could not be persisted')
  }
}

function canonicalizeProductStorageSupplyReturn(
  payload: ProductStorageSupplyReturnPayload,
  ownerNetUid: string,
): string {
  const supplyReturn = payload as SupplyReturnFingerprintBody
  const canonical: string[] = []

  appendCanonicalField(canonical, 'operation', SUPPLY_RETURN_OPERATION_KIND)
  appendCanonicalField(canonical, 'owner', ownerNetUid)
  appendCanonicalField(canonical, 'comment', String(supplyReturn.Comment ?? ''))
  appendCanonicalField(
    canonical,
    'from-date',
    canonicalizeSupplyReturnDate(supplyReturn.FromDate),
  )
  appendCanonicalField(
    canonical,
    'is-management',
    supplyReturn.IsManagement ? '1' : '0',
  )
  appendSupplyReturnIdentity(canonical, 'supplier', supplyReturn.SupplierId, supplyReturn.Supplier?.Id)
  appendSupplyReturnIdentity(
    canonical,
    'client-agreement',
    supplyReturn.ClientAgreementId,
    supplyReturn.ClientAgreement?.Id,
  )
  appendSupplyReturnIdentity(
    canonical,
    'organization',
    supplyReturn.OrganizationId,
    supplyReturn.Organization?.Id,
  )
  appendSupplyReturnIdentity(canonical, 'storage', supplyReturn.StorageId, supplyReturn.Storage?.Id)
  appendSupplyReturnIdentity(
    canonical,
    'responsible',
    supplyReturn.ResponsibleId,
    supplyReturn.Responsible?.Id,
  )

  const items = (supplyReturn.SupplyReturnItems || [])
    .map(canonicalizeProductStorageSupplyReturnItem)
    .sort(compareOrdinal)

  appendCanonicalField(canonical, 'item-count', String(items.length))
  items.forEach((item) => appendCanonicalField(canonical, 'item', item))

  return canonical.join('')
}

function appendSupplyReturnIdentity(
  canonical: string[],
  name: string,
  scalarId: number | null | undefined,
  referenceId: number | null | undefined,
) {
  const scalar = scalarId ?? 0
  const reference = referenceId ?? 0

  if (
    Number.isFinite(scalar) &&
    Number.isFinite(reference) &&
    scalar >= 0 &&
    reference >= 0 &&
    (scalar === 0 || reference === 0 || scalar === reference)
  ) {
    appendCanonicalField(
      canonical,
      `${name}-id`,
      serverNumber(scalar > 0 ? scalar : reference),
    )
    return
  }

  appendCanonicalField(canonical, `${name}-invalid-scalar-id`, serverNumber(scalar))
  appendCanonicalField(canonical, `${name}-invalid-reference-id`, serverNumber(reference))
}

function canonicalizeSupplyReturnDate(value: string | null | undefined): string {
  if (value == null || value === '') {
    return 'default'
  }

  const raw = String(value)
  if (!/(?:z|[+-]\d{2}:\d{2})$/i.test(raw)) {
    return raw
  }

  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString()
}

function canonicalizeProductStorageSupplyReturnItem(
  item: SupplyReturnFingerprintItem | null,
): string {
  if (!item) {
    return '<null>'
  }

  const canonical: string[] = []
  appendSupplyReturnIdentity(canonical, 'product', item.ProductId, item.Product?.Id)
  appendSupplyReturnIdentity(
    canonical,
    'consignment-item',
    item.ConsignmentItemId,
    item.ConsignmentItem?.Id,
  )
  appendCanonicalField(canonical, 'quantity', serverNumber(item.Qty))
  return canonical.join('')
}

function getSupplyReturnOwnerNetUid(): string {
  const session = readSession()
  const ownerNetUid = session?.userNetUid || session?.user?.NetUid

  if (!ownerNetUid?.trim()) {
    throw new Error('Authenticated supply return owner identity is unavailable')
  }

  return ownerNetUid.trim().toLowerCase()
}

function removeSupplyReturnOperation(operation: SupplyReturnOperation) {
  try {
    if (globalThis.localStorage?.getItem(operation.storageKey) === operation.operationNetUid) {
      globalThis.localStorage.removeItem(operation.storageKey)
    }
  } catch {
    // The request result remains authoritative when browser storage is unavailable.
  }
}

function isDefinitiveSupplyReturnFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('status' in error)) {
    return false
  }

  const status = Number(error.status)

  if (!Number.isInteger(status) || status < 400 || status >= 500) {
    return false
  }

  if (status === 409) {
    return true
  }

  const headers = 'headers' in error ? error.headers : null
  const ledgerState = readHeader(headers, MUTATION_LEDGER_STATE_HEADER)
    ?.trim()
    .toLowerCase()

  return ledgerState === 'not-entered' || ledgerState === 'rolled-back'
}

function readHeader(headers: unknown, name: string): string | null {
  if (headers instanceof Headers) {
    return headers.get(name)
  }

  if (headers && typeof headers === 'object') {
    const get = Reflect.get(headers, 'get')

    if (typeof get === 'function') {
      const value = Reflect.apply(get, headers, [name])
      return typeof value === 'string' ? value : null
    }
  }

  return null
}

function normalizeStorages(result: unknown): ProductStorageStorage[] {
  if (Array.isArray(result)) {
    return result as ProductStorageStorage[]
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>

  if (Array.isArray(payload.Items)) {
    return payload.Items as ProductStorageStorage[]
  }

  if (Array.isArray(payload.Storages)) {
    return payload.Storages as ProductStorageStorage[]
  }

  return []
}

function normalizeAvailabilitiesResponse(result: unknown): ProductStorageAvailabilitiesResponse {
  const items = readArrayPayload(result, ['Items', 'Availabilities', 'ProductAvailabilities', 'Data'])
    .map((item) => normalizeAvailability(item as ProductStorageAvailability))
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

function normalizeAvailability(availability: ProductStorageAvailability): ProductStorageAvailability {
  const productPlacements = normalizePlacements(availability.Product?.ProductPlacements)

  return {
    ...availability,
    Amount: readNumber(availability.Amount) ?? undefined,
    ChangedQty: readNumber(availability.ChangedQty) ?? undefined,
    Placements: normalizePlacements(availability.Placements),
    Product: availability.Product
      ? {
          ...availability.Product,
          ProductPlacements: productPlacements,
        }
      : availability.Product,
    Qty: readNumber(availability.Qty) ?? undefined,
    TotalRowsQty: readNumber(availability.TotalRowsQty) ?? undefined,
  }
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

function normalizePlacements(placements: ProductStoragePlacement[] | undefined): ProductStoragePlacement[] {
  return Array.isArray(placements)
    ? placements.map((placement) => ({
        ...placement,
        Qty: readNumber(placement.Qty) ?? undefined,
      }))
    : []
}

function normalizeAvailableConsignment(result: unknown): ProductStorageAvailableConsignment {
  const consignment = (result && typeof result === 'object' ? result : {}) as ProductStorageAvailableConsignment

  return {
    ...consignment,
    ConsignmentItemId: readNumber(consignment.ConsignmentItemId) ?? undefined,
    RemainingQty: readNumber(consignment.RemainingQty) ?? undefined,
  }
}

function normalizeExportDocument(result: unknown): ProductStoragesExportDocument {
  if (!result || typeof result !== 'object') {
    return {}
  }

  const payload = result as Record<string, unknown>

  return {
    DocumentURL:
      readString(payload.DocumentURL)
      || readString(payload.XlsxDocument)
      || readString(payload.URL)
      || readString(payload.url),
    PdfDocumentURL: readString(payload.PdfDocumentURL) || readString(payload.PdfDocument),
  }
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
