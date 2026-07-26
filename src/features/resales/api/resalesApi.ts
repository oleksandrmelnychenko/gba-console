import { apiRequest } from '../../../shared/api/apiClient'
import { readSession } from '../../../shared/auth/session'
import { normalizeExportDocument as normalizeSharedExportDocument } from '../../../shared/documents/exportDocument'
import { getClients } from '../../clients/api/clientsApi'
import type {
  CreatedResaleAvailabilityWithTotals,
  GenerateAutomaticallyResalePayload,
  GroupingResaleAvailability,
  ReSale,
  ResaleActionResult,
  ResaleAvailabilityFilterOptions,
  ResaleAvailabilityFilterPayload,
  ResaleAvailabilityItemModel,
  ResaleAvailabilityWithTotals,
  ResaleBackendWarning,
  ResaleClient,
  ResaleClientAgreement,
  ResaleConsignmentNoteSetting,
  ResaleCreatePayload,
  ResaleDownloadDocumentType,
  ResaleExportDocument,
  ResalesSearchParams,
  UpdatedResaleModel,
} from '../types'

const PENDING_RESALE_ADD_STORAGE_PREFIX =
  'gba_console:resale-add-operation:v2'
const PENDING_RESALE_ADD_VERSION = 2
const RESALE_ADD_OPERATION_KIND = 'resale:add-manual'
const RESALE_ADD_LEDGER_STATE_HEADER =
  'X-ReSale-Add-Ledger-State'
const RESALE_ADD_OWNER_HEADER =
  'X-ReSale-Add-Owner'
const RESALE_ADD_DEFINITIVE_NO_WRITE =
  'definitive-no-write'
const inFlightResaleAdds =
  new Map<string, Promise<ResaleActionResult<ReSale>>>()

type PendingResaleAdd = {
  operationNetUid: string
  ownerNetUid: string
  payload: ResaleCreatePayload
  payloadFingerprint: string
  storageKey: string
  version: typeof PENDING_RESALE_ADD_VERSION
}

export async function getResales(params: ResalesSearchParams): Promise<ReSale[]> {
  const result = await apiRequest<unknown>('/resales/all', {
    query: params,
  })

  return normalizeResales(result)
}

export async function removeResale(netId: string): Promise<ReSale | null> {
  const result = await apiRequest<unknown>('/resales/remove', {
    body: {},
    method: 'POST',
    query: {
      netId,
    },
  })

  return normalizeResale(result)
}

export async function getResaleByNetId(
  netId: string,
  updatedReSaleModel?: UpdatedResaleModel,
): Promise<ResaleActionResult<UpdatedResaleModel>> {
  const result = await apiRequest<unknown>('/resales/updated/get', {
    ...(updatedReSaleModel ? { body: updatedReSaleModel } : {}),
    method: 'POST',
    query: {
      netId,
    },
  })

  return normalizeActionResult(result, normalizeUpdatedResaleModel)
}

export async function updateResale(payload: UpdatedResaleModel): Promise<ResaleActionResult<UpdatedResaleModel>> {
  try {
    const result = await apiRequest<unknown>('/resales/update', {
      body: payload,
      method: 'POST',
    })

    return normalizeActionResult(result, normalizeUpdatedResaleModel)
  } catch (requestError) {
    const warning = readMutationWarning(requestError)

    if (warning) {
      return { warning }
    }

    throw requestError
  }
}

export async function completeResale(netId: string): Promise<UpdatedResaleModel | null> {
  const result = await apiRequest<unknown>('/resales/complete', {
    body: {},
    method: 'POST',
    query: {
      netId,
    },
  })

  const actionResult = normalizeActionResult(result, normalizeUpdatedResaleModel)

  if (actionResult.warning) {
    throw new Error(actionResult.warning.Message || 'Resale completion failed')
  }

  return actionResult.data ?? null
}

export async function changeResaleToInvoice(netId: string): Promise<UpdatedResaleModel | null> {
  const result = await apiRequest<unknown>('/resales/change/to/invoice', {
    body: {},
    method: 'POST',
    query: {
      netId,
    },
  })

  const actionResult = normalizeActionResult(result, normalizeUpdatedResaleModel)

  if (actionResult.warning) {
    throw new Error(actionResult.warning.Message || 'Resale invoice conversion failed')
  }

  return actionResult.data ?? null
}

export async function exportResaleDocument(params: {
  netId: string
  type: ResaleDownloadDocumentType
}): Promise<ResaleExportDocument> {
  const result = await apiRequest<unknown>('/resales/document/export', {
    query: params,
  })

  return normalizeExportDocument(result)
}

export async function getResaleConsignmentNoteSettings(): Promise<ResaleConsignmentNoteSetting[]> {
  const result = await apiRequest<unknown>('/consignment/note/settings/all/get', {
    query: {
      forReSale: true,
    },
  })

  return normalizeConsignmentNoteSettings(result)
}

export async function addResaleConsignmentNoteSetting(
  setting: ResaleConsignmentNoteSetting,
): Promise<ResaleConsignmentNoteSetting[]> {
  const result = await apiRequest<unknown>('/consignment/note/settings/add', {
    body: setting,
    method: 'POST',
    query: {
      forReSale: true,
    },
  })

  return normalizeConsignmentNoteSettings(result)
}

export async function updateResaleConsignmentNoteSetting(
  setting: ResaleConsignmentNoteSetting,
): Promise<ResaleConsignmentNoteSetting[]> {
  const result = await apiRequest<unknown>('/consignment/note/settings/update', {
    body: setting,
    method: 'POST',
    query: {
      forReSale: true,
    },
  })

  return normalizeConsignmentNoteSettings(result)
}

export async function removeResaleConsignmentNoteSetting(netId: string): Promise<ResaleConsignmentNoteSetting[]> {
  const result = await apiRequest<unknown>('/consignment/note/settings/remove', {
    body: {},
    method: 'POST',
    query: {
      forReSale: true,
      netId,
    },
  })

  return normalizeConsignmentNoteSettings(result)
}

export async function printResaleConsignmentNoteDocument(
  saleNetId: string,
  setting: ResaleConsignmentNoteSetting,
): Promise<ResaleExportDocument> {
  const result = await apiRequest<unknown>('/consignment/note/settings/print/document', {
    body: setting,
    method: 'POST',
    query: {
      forReSale: true,
      netId: saleNetId,
    },
  })

  return normalizeExportDocument(result)
}

export async function getResaleAvailabilityFilterOptions(): Promise<ResaleAvailabilityFilterOptions> {
  const result = await apiRequest<unknown>('/resales/availabilities/filter/options')
  const options = normalizeFilterOptions(result)

  if (options.SpecificationCodes.length > 0) {
    return options
  }

  return {
    ...options,
    SpecificationCodes: await getResaleAvailabilitySpecificationCodes(),
  }
}

export async function getResaleAvailabilitySpecificationCodes(): Promise<string[]> {
  const result = await apiRequest<unknown>('/resales/availabilities/specification/codes')

  return readArrayPayload(result, ['Items', 'SpecificationCodes', 'Data'])
    .filter((code): code is string => typeof code === 'string')
}

export async function getResaleAvailabilities(
  payload: ResaleAvailabilityFilterPayload,
): Promise<ResaleAvailabilityWithTotals> {
  const result = await apiRequest<unknown>('/resales/availabilities/all/filtered', {
    body: payload,
    method: 'POST',
  })

  return normalizeAvailabilityWithTotals(result)
}

export async function exportResaleAvailabilities(
  payload: ResaleAvailabilityFilterPayload,
): Promise<ResaleExportDocument> {
  const result = await apiRequest<unknown>('/resales/document/resale', {
    body: payload,
    method: 'POST',
  })

  return normalizeExportDocument(result)
}

export async function updateResaleAvailabilityList(
  payload: ResaleAvailabilityItemModel[],
): Promise<ResaleActionResult<CreatedResaleAvailabilityWithTotals>> {
  const result = await apiRequest<unknown>('/resales/availability/list/update', {
    body: payload,
    method: 'POST',
  })

  return normalizeActionResult(result, normalizeCreatedResaleAvailability)
}

export async function generateAutomaticallyResale(
  payload: GenerateAutomaticallyResalePayload,
): Promise<ResaleActionResult<CreatedResaleAvailabilityWithTotals>> {
  const result = await apiRequest<unknown>('/resales/generate/automatically', {
    body: payload,
    method: 'POST',
  })

  return normalizeActionResult(result, normalizeCreatedResaleAvailability)
}

export function addResale(
  payload: ResaleCreatePayload,
): Promise<ResaleActionResult<ReSale>> {
  const ownerNetUid = getResaleAddOwnerNetUid()
  const immutablePayload = cloneCreatePayload(payload)
  const canonicalPayload =
    canonicalizeResaleAdd(
      immutablePayload,
      ownerNetUid,
    )
  const inFlight =
    inFlightResaleAdds.get(canonicalPayload)

  if (inFlight) {
    return inFlight
  }

  const request = addResaleCore(
    immutablePayload,
    canonicalPayload,
    ownerNetUid,
  ).finally(() => {
    if (
      inFlightResaleAdds.get(canonicalPayload) ===
      request
    ) {
      inFlightResaleAdds.delete(canonicalPayload)
    }
  })

  inFlightResaleAdds.set(canonicalPayload, request)
  return request
}

async function addResaleCore(
  immutablePayload: ResaleCreatePayload,
  canonicalPayload: string,
  ownerNetUid: string,
): Promise<ResaleActionResult<ReSale>> {
  const pending =
    await getOrCreatePendingResaleAdd(
      immutablePayload,
      canonicalPayload,
      ownerNetUid,
    )

  try {
    ensureResaleAddOwnerUnchanged(
      pending.ownerNetUid,
    )
  } catch (ownerError) {
    clearPendingResaleAdd(pending)
    throw ownerError
  }

  try {
    const result = await apiRequest<unknown>('/resales/add', {
      body: pending.payload,
      headers: {
        'Idempotency-Key': pending.operationNetUid,
        [RESALE_ADD_OWNER_HEADER]:
          pending.ownerNetUid,
      },
      method: 'POST',
      query: {
        operationNetUid: pending.operationNetUid,
      },
    })
    const actionResult = normalizeActionResult(result, normalizeResale)

    clearPendingResaleAdd(pending)
    return actionResult
  } catch (requestError) {
    if (isDefinitiveNoWriteAddFailure(requestError)) {
      clearPendingResaleAdd(pending)
    }

    const warning = readMutationWarning(requestError)

    if (warning) {
      return { warning }
    }

    throw requestError
  }
}

async function getOrCreatePendingResaleAdd(
  immutablePayload: ResaleCreatePayload,
  canonicalPayload: string,
  ownerNetUid: string,
): Promise<PendingResaleAdd> {
  const payloadFingerprint =
    await sha256(canonicalPayload)
  const storageKey =
    `${PENDING_RESALE_ADD_STORAGE_PREFIX}:` +
    `${ownerNetUid}:${payloadFingerprint}`
  const existing = readPendingResaleAdd(
    storageKey,
    ownerNetUid,
    payloadFingerprint,
    canonicalPayload,
  )

  if (existing) {
    return existing
  }

  const pending: PendingResaleAdd = {
    operationNetUid: createOperationNetUid(),
    ownerNetUid,
    payload: immutablePayload,
    payloadFingerprint,
    storageKey,
    version: PENDING_RESALE_ADD_VERSION,
  }
  const storage = requireResaleAddStorage()

  try {
    storage.setItem(
      storageKey,
      JSON.stringify(pending),
    )
  } catch {
    throw new Error(
      'Resale Add retry state could not be persisted. The request was not sent.',
    )
  }

  return pending
}

function readPendingResaleAdd(
  storageKey: string,
  ownerNetUid: string,
  payloadFingerprint: string,
  canonicalPayload: string,
): PendingResaleAdd | null {
  const storage = requireResaleAddStorage()
  let serialized: string | null

  try {
    serialized = storage.getItem(storageKey)
  } catch {
    throw new Error(
      'Resale Add retry state could not be read. The request was not sent.',
    )
  }

  if (!serialized) {
    return null
  }

  try {
    const candidate = JSON.parse(serialized) as Partial<PendingResaleAdd>

    if (
      candidate.version !== PENDING_RESALE_ADD_VERSION
      || !isNonEmptyGuid(candidate.operationNetUid)
      || candidate.ownerNetUid !== ownerNetUid
      || candidate.payloadFingerprint !== payloadFingerprint
      || candidate.storageKey !== storageKey
      || !candidate.payload
      || typeof candidate.payload !== 'object'
      || !Array.isArray(candidate.payload.ReSaleAvailabilityModels)
      || canonicalizeResaleAdd(
        candidate.payload,
        ownerNetUid,
      ) !== canonicalPayload
    ) {
      throw new Error('invalid pending ReSale Add state')
    }

    return candidate as PendingResaleAdd
  } catch {
    throw new Error(
      'Persisted Resale Add retry state is invalid. The request was not sent.',
    )
  }
}

function clearPendingResaleAdd(
  pending: PendingResaleAdd,
) {
  const storage = requireResaleAddStorage()

  try {
    const serialized = storage.getItem(pending.storageKey)

    if (!serialized) {
      return
    }

    const candidate = JSON.parse(serialized) as Partial<PendingResaleAdd>

    if (
      candidate.operationNetUid === pending.operationNetUid
      && candidate.ownerNetUid === pending.ownerNetUid
      && candidate.payloadFingerprint === pending.payloadFingerprint
    ) {
      storage.removeItem(pending.storageKey)
    }
  } catch {
    // A successful durable replay is already safe; stale local recovery data
    // must not turn the completed request into an apparent mutation failure.
  }
}

function cloneCreatePayload(
  payload: ResaleCreatePayload,
): ResaleCreatePayload {
  const serialized = JSON.stringify(payload)

  if (!serialized) {
    throw new Error('Resale Add payload could not be persisted.')
  }

  return JSON.parse(serialized) as ResaleCreatePayload
}

function canonicalizeResaleAdd(
  payload: ResaleCreatePayload,
  ownerNetUid: string,
): string {
  const canonical: string[] = []

  appendCanonicalField(
    canonical,
    'operation',
    RESALE_ADD_OPERATION_KIND,
  )
  appendCanonicalField(
    canonical,
    'owner',
    ownerNetUid,
  )
  appendCanonicalField(
    canonical,
    'client-agreement-id',
    serverNumber(payload.ClientAgreement?.Id),
  )
  appendCanonicalField(
    canonical,
    'organization-id',
    serverNumber(payload.Organization?.Id),
  )
  appendCanonicalField(
    canonical,
    'from-storage-id',
    serverNumber(payload.FromStorageId),
  )
  appendCanonicalField(
    canonical,
    'comment',
    nullableString(payload.Comment),
  )

  const items =
    (payload.ReSaleAvailabilityModels || [])
      .map(canonicalizeResaleAddItem)
      .sort(compareOrdinal)

  appendCanonicalField(
    canonical,
    'item-count',
    String(items.length),
  )
  items.forEach(item =>
    appendCanonicalField(
      canonical,
      'item',
      item,
    ))

  return canonical.join('')
}

function canonicalizeResaleAddItem(
  item: ResaleAvailabilityItemModel | null,
): string {
  if (!item) {
    return '<null>'
  }

  const canonical: string[] = []
  appendCanonicalField(
    canonical,
    'product-id',
    serverNumber(item.ProductId),
  )
  appendCanonicalField(
    canonical,
    'quantity',
    serverNumber(item.QtyToReSale),
  )
  appendCanonicalField(
    canonical,
    'source-price',
    serverNumber(item.Price),
  )
  appendCanonicalField(
    canonical,
    'sale-price',
    serverNumber(item.SalePrice),
  )
  appendCanonicalField(
    canonical,
    'exchange-rate',
    serverNumber(item.ExchangeRate),
  )
  return canonical.join('')
}

function appendCanonicalField(
  target: string[],
  name: string,
  value: string | null,
) {
  target.push(
    `${name}=${
      value === null
        ? '-1:'
        : `${value.length}:${value}`
    };`,
  )
}

function nullableString(
  value: unknown,
): string | null {
  return value == null ? null : String(value)
}

function serverNumber(
  value: number | null | undefined,
): string {
  return String(value ?? 0)
}

function compareOrdinal(
  left: string,
  right: string,
): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function getResaleAddOwnerNetUid(): string {
  let ownerNetUid: string | undefined

  try {
    const session = readSession()
    ownerNetUid =
      session?.userNetUid ||
      session?.user?.NetUid
  } catch {
    ownerNetUid = undefined
  }

  const normalized =
    ownerNetUid?.trim().toLowerCase()
  if (!normalized || !isNonEmptyGuid(normalized)) {
    throw new Error(
      'Authenticated resale owner identity is unavailable.',
    )
  }

  return normalized
}

function ensureResaleAddOwnerUnchanged(
  expectedOwnerNetUid: string,
) {
  if (
    getResaleAddOwnerNetUid() !==
    expectedOwnerNetUid
  ) {
    throw new Error(
      'Authenticated resale owner changed before the request was sent.',
    )
  }
}

async function sha256(
  value: string,
): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      'Secure ReSale Add operation identity is unavailable.',
    )
  }

  const digest =
    await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(value),
    )

  return Array.from(
    new Uint8Array(digest),
    byte => byte.toString(16).padStart(2, '0'),
  ).join('')
}

function createOperationNetUid(): string {
  const cryptoApi = globalThis.crypto

  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID()
  }

  if (typeof cryptoApi?.getRandomValues !== 'function') {
    throw new Error(
      'A secure Resale Add operation key could not be generated.',
    )
  }

  const bytes = cryptoApi.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(
    bytes,
    (value) => value.toString(16).padStart(2, '0'),
  ).join('')

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-')
}

function isNonEmptyGuid(value: unknown): value is string {
  return (
    typeof value === 'string'
    && value !== '00000000-0000-0000-0000-000000000000'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  )
}

function requireResaleAddStorage(): Storage {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage
    }
  } catch {
    // Fall through to the durable-storage error below.
  }

  throw new Error(
    'Durable browser storage is required to create a resale.',
  )
}

function isDefinitiveNoWriteAddFailure(
  error: unknown,
): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const status =
    Number((error as { status?: unknown }).status)
  if (status === 409) {
    return true
  }

  const ledgerState =
    readErrorHeader(
      error,
      RESALE_ADD_LEDGER_STATE_HEADER,
    )
  if (ledgerState) {
    return (
      ledgerState.toLowerCase() ===
      RESALE_ADD_DEFINITIVE_NO_WRITE
    )
  }

  return (
    status === 400
    || status === 401
    || status === 403
    || status === 404
    || status === 422
  )
}

function readErrorHeader(
  error: object,
  name: string,
): string | null {
  const headers =
    (error as { headers?: unknown }).headers

  if (!headers) {
    return null
  }

  try {
    return new Headers(
      headers as HeadersInit,
    ).get(name)
  } catch {
    return null
  }
}

export async function searchResaleClients(value: string, signal?: AbortSignal): Promise<ResaleClient[]> {
  const clients = await getClients({
    active: true,
    forReSale: true,
    limit: 20,
    offset: 0,
    value,
  }, signal)

  return clients as unknown as ResaleClient[]
}

export async function getResaleClientAgreements(
  netId: string,
  signal?: AbortSignal,
): Promise<ResaleClientAgreement[]> {
  const result = await apiRequest<unknown>('/agreements/client/all', {
    query: {
      includeDebts: false,
      netId,
    },
    ...(signal ? { signal } : {}),
  })

  return readArrayPayload(result, ['Items', 'ClientAgreements', 'Agreements', 'Data', 'Collection']) as ResaleClientAgreement[]
}

function normalizeResales(result: unknown): ReSale[] {
  return readArrayPayload(result, ['Items', 'Resales', 'Data']) as ReSale[]
}

function normalizeResale(result: unknown): ReSale | null {
  if (result && typeof result === 'object') {
    return result as ReSale
  }

  return null
}

function normalizeConsignmentNoteSettings(result: unknown): ResaleConsignmentNoteSetting[] {
  return readArrayPayload(result, ['Items', 'Settings', 'Data']) as ResaleConsignmentNoteSetting[]
}

function normalizeUpdatedResaleModel(result: unknown): UpdatedResaleModel | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const payload = result as Partial<UpdatedResaleModel>

  if (!payload.ReSale || typeof payload.ReSale !== 'object') {
    return null
  }

  return {
    ...(payload as UpdatedResaleModel),
    ReSaleItemModels: Array.isArray(payload.ReSaleItemModels) ? payload.ReSaleItemModels : [],
  }
}

function normalizeFilterOptions(result: unknown): ResaleAvailabilityFilterOptions {
  const payload = result && typeof result === 'object' ? (result as Partial<ResaleAvailabilityFilterOptions>) : {}

  return {
    ProductGroups: Array.isArray(payload.ProductGroups) ? payload.ProductGroups : [],
    SpecificationCodes: Array.isArray(payload.SpecificationCodes) ? payload.SpecificationCodes : [],
    Storages: Array.isArray(payload.Storages) ? payload.Storages : [],
  }
}

function normalizeAvailabilityWithTotals(result: unknown): ResaleAvailabilityWithTotals {
  if (!result || typeof result !== 'object') {
    return {
      GroupReSaleAvailabilities: [],
      TotalQty: 0,
      TotalValueWithVat: 0,
      TotalWithExtraValue: 0,
    }
  }

  const payload = result as Partial<ResaleAvailabilityWithTotals>

  return {
    GroupReSaleAvailabilities: normalizeGroupingAvailabilities(payload.GroupReSaleAvailabilities),
    TotalQty: readNumber(payload.TotalQty),
    TotalValueWithVat: readNumber(payload.TotalValueWithVat),
    TotalWithExtraValue: readNumber(payload.TotalWithExtraValue),
  }
}

function normalizeGroupingAvailabilities(items: unknown): GroupingResaleAvailability[] {
  return Array.isArray(items) ? (items as GroupingResaleAvailability[]) : []
}

function normalizeCreatedResaleAvailability(result: unknown): CreatedResaleAvailabilityWithTotals | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const payload = result as Partial<CreatedResaleAvailabilityWithTotals>

  return {
    Organization: payload.Organization,
    Qty: readNumber(payload.Qty),
    ReSaleAvailabilityItemModels: Array.isArray(payload.ReSaleAvailabilityItemModels)
      ? payload.ReSaleAvailabilityItemModels
      : [],
    Value: readNumber(payload.Value),
    Vat: readNumber(payload.Vat),
    Weight: readNumber(payload.Weight),
  }
}

function normalizeActionResult<T>(result: unknown, normalize: (value: unknown) => T | null): ResaleActionResult<T> {
  const warning = readBackendWarning(result)

  if (warning) {
    return { warning }
  }

  const data = normalize(result)

  return data ? { data } : {}
}

function readBackendWarning(result: unknown): ResaleBackendWarning | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const payload = result as Partial<ResaleBackendWarning>

  if (typeof payload.Message !== 'string' || !payload.Message) {
    return null
  }

  return {
    Message: payload.Message,
    Products: Array.isArray(payload.Products) ? payload.Products : [],
  }
}

function readMutationWarning(error: unknown): ResaleBackendWarning | null {
  if (!error || typeof error !== 'object') {
    return null
  }

  const apiError = error as { payload?: unknown; status?: number }

  if (apiError.status !== 400) {
    return null
  }

  const payload =
    apiError.payload &&
    typeof apiError.payload === 'object' &&
    'Body' in apiError.payload
      ? (apiError.payload as { Body?: unknown }).Body
      : apiError.payload

  return readBackendWarning(payload)
}

function normalizeExportDocument(result: unknown): ResaleExportDocument {
  return normalizeSharedExportDocument(result)
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

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)

    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return undefined
}
