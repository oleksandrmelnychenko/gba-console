import { readSession } from '../../../shared/auth/session'
import { ApiError } from '../../../shared/api/apiClient'

export const TAX_FREE_UPLOAD_IDEMPOTENCY_HEADER =
  'Idempotency-Key'
export const TAX_FREE_UPLOAD_LEDGER_STATE_HEADER =
  'X-TaxFree-Mutation-Ledger-State'

type TaxFreeDocumentUploadRequestContext = {
  headers: HeadersInit
}

type ExecuteTaxFreeDocumentUploadOptions<TResult> = {
  files: File[]
  request: (
    files: File[],
    context: TaxFreeDocumentUploadRequestContext,
  ) => Promise<TResult>
  taxFreeNetUid: string
}

type PendingTaxFreeDocumentUpload = {
  fingerprint: string
  operationNetUid: string
  ownerNetUid: string
  taxFreeNetUid: string
  version: 1
}

type CanonicalFile = {
  digest: string
  extension: string
  name: string
  ordinal: number
  size: number
}

const STORAGE_PREFIX =
  'gba:tax-free-document-upload:v1'
const OPERATION_KIND =
  'tax-free:upload-documents:v1'
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SHA256_PATTERN = /^[0-9a-f]{64}$/i
const inFlightByOperation =
  new Map<string, Promise<unknown>>()

export async function executeTaxFreeDocumentUpload<
  TResult,
>({
  files,
  request,
  taxFreeNetUid,
}: ExecuteTaxFreeDocumentUploadOptions<TResult>):
Promise<TResult> {
  const canonicalTaxFreeNetUid =
    requireGuid(
      taxFreeNetUid,
      'TaxFree identity',
    )
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error(
      'At least one TaxFree document is required.',
    )
  }

  const ownerNetUid =
    getAuthenticatedOwnerNetUid()
  const fingerprint =
    await computeFingerprint(
      ownerNetUid,
      canonicalTaxFreeNetUid,
      files,
    )
  const pending =
    getOrCreatePendingOperation(
      ownerNetUid,
      canonicalTaxFreeNetUid,
      fingerprint,
    )
  if (
    getAuthenticatedOwnerNetUid()
      !== pending.ownerNetUid
  ) {
    throw new Error(
      'Authenticated TaxFree owner changed before the upload was sent.',
    )
  }

  const inFlight = inFlightByOperation.get(
    pending.operationNetUid,
  )
  if (inFlight) {
    return inFlight as Promise<TResult>
  }

  const execution = request(
    files,
    {
      headers: {
        [TAX_FREE_UPLOAD_IDEMPOTENCY_HEADER]:
          pending.operationNetUid,
      },
    },
  )
    .then((result) => {
      clearPendingOperation(pending)
      return result
    })
    .catch((error: unknown) => {
      if (
        isDefinitiveTaxFreeUploadFailure(error)
      ) {
        clearPendingOperation(pending)
      }
      throw error
    })
    .finally(() => {
      if (
        inFlightByOperation.get(
          pending.operationNetUid,
        ) === execution
      ) {
        inFlightByOperation.delete(
          pending.operationNetUid,
        )
      }
    })

  inFlightByOperation.set(
    pending.operationNetUid,
    execution,
  )
  return execution
}

export function
isDefinitiveTaxFreeUploadFailure(
  error: unknown,
): boolean {
  if (!(error instanceof ApiError)) {
    return false
  }

  const ledgerState = error.headers
    .get(TAX_FREE_UPLOAD_LEDGER_STATE_HEADER)
    ?.trim()
    .toLowerCase()
  return ledgerState === 'not-entered'
    || ledgerState === 'rolled-back'
}

async function computeFingerprint(
  ownerNetUid: string,
  taxFreeNetUid: string,
  files: File[],
): Promise<string> {
  const canonicalFiles: CanonicalFile[] = []
  for (
    let ordinal = 0;
    ordinal < files.length;
    ordinal += 1
  ) {
    const file = files[ordinal]
    if (!(file instanceof File)) {
      throw new Error(
        'A TaxFree document payload is invalid.',
      )
    }
    const name = file.name.normalize('NFC')
    canonicalFiles.push({
      digest:
        await sha256Bytes(
          await file.arrayBuffer(),
        ),
      extension:
        readExtension(name),
      name,
      ordinal,
      size: file.size,
    })
  }

  return sha256Text(
    stableJson({
      files: canonicalFiles,
      kind: OPERATION_KIND,
      ownerNetUid,
      taxFreeNetUid,
    }),
  )
}

function getOrCreatePendingOperation(
  ownerNetUid: string,
  taxFreeNetUid: string,
  fingerprint: string,
): PendingTaxFreeDocumentUpload {
  const storage = requireDurableStorage()
  const storageKey = getStorageKey(
    ownerNetUid,
    taxFreeNetUid,
  )
  const persisted =
    readPendingOperation(
      storage,
      storageKey,
    )
  if (persisted) {
    if (
      persisted.ownerNetUid !== ownerNetUid
      || persisted.taxFreeNetUid
        !== taxFreeNetUid
      || persisted.fingerprint !== fingerprint
    ) {
      throw new Error(
        'A TaxFree document upload with an unknown outcome is pending. Retry it with the same immutable files.',
      )
    }

    return persisted
  }

  const pending: PendingTaxFreeDocumentUpload = {
    fingerprint,
    operationNetUid:
      createOperationNetUid(),
    ownerNetUid,
    taxFreeNetUid,
    version: 1,
  }
  const serialized = JSON.stringify(pending)
  try {
    storage.setItem(storageKey, serialized)
    if (
      storage.getItem(storageKey)
        !== serialized
    ) {
      throw new Error(
        'TaxFree upload retry state verification failed.',
      )
    }
  } catch {
    throw new Error(
      'TaxFree upload retry state could not be persisted. The request was not sent.',
    )
  }

  return pending
}

function readPendingOperation(
  storage: Storage,
  storageKey: string,
): PendingTaxFreeDocumentUpload | null {
  let serialized: string | null
  try {
    serialized = storage.getItem(storageKey)
  } catch {
    throw new Error(
      'TaxFree upload retry state could not be read. The request was not sent.',
    )
  }
  if (!serialized) {
    return null
  }

  try {
    const pending = JSON.parse(
      serialized,
    ) as Partial<PendingTaxFreeDocumentUpload>
    if (
      pending.version !== 1
      || !isNonEmptyGuid(
        pending.operationNetUid,
      )
      || !isNonEmptyGuid(pending.ownerNetUid)
      || !isNonEmptyGuid(
        pending.taxFreeNetUid,
      )
      || typeof pending.fingerprint
        !== 'string'
      || !SHA256_PATTERN.test(
        pending.fingerprint,
      )
    ) {
      throw new Error(
        'invalid TaxFree upload retry state',
      )
    }

    return pending as PendingTaxFreeDocumentUpload
  } catch {
    throw new Error(
      'Persisted TaxFree upload retry state is invalid. The request was not sent.',
    )
  }
}

function clearPendingOperation(
  pending: PendingTaxFreeDocumentUpload,
) {
  try {
    const storage = requireDurableStorage()
    const storageKey = getStorageKey(
      pending.ownerNetUid,
      pending.taxFreeNetUid,
    )
    const current = readPendingOperation(
      storage,
      storageKey,
    )
    if (
      current?.operationNetUid
        === pending.operationNetUid
    ) {
      storage.removeItem(storageKey)
    }
  } catch {
    // A definitive server response remains authoritative.
  }
}

function getAuthenticatedOwnerNetUid(): string {
  let session
  try {
    session = readSession()
  } catch {
    session = null
  }

  const ownerNetUid =
    session?.userNetUid
    || session?.user?.NetUid
  return requireGuid(
    ownerNetUid,
    'Authenticated TaxFree owner identity',
  )
}

function getStorageKey(
  ownerNetUid: string,
  taxFreeNetUid: string,
): string {
  return `${STORAGE_PREFIX}:` +
    `${ownerNetUid}:${taxFreeNetUid}`
}

function requireDurableStorage(): Storage {
  try {
    if (
      typeof window !== 'undefined'
      && window.localStorage
    ) {
      return window.localStorage
    }
  } catch {
    // Fall through to a fail-closed error.
  }

  throw new Error(
    'Durable browser storage is required to upload TaxFree documents.',
  )
}

function createOperationNetUid(): string {
  const operationNetUid =
    globalThis.crypto?.randomUUID?.()
  if (!isNonEmptyGuid(operationNetUid)) {
    throw new Error(
      'Secure TaxFree operation identity generation is unavailable.',
    )
  }

  return operationNetUid.toLowerCase()
}

function requireGuid(
  value: unknown,
  name: string,
): string {
  const normalized =
    typeof value === 'string'
      ? value.trim().toLowerCase()
      : ''
  if (!isNonEmptyGuid(normalized)) {
    throw new Error(`${name} is unavailable.`)
  }

  return normalized
}

function isNonEmptyGuid(
  value: unknown,
): value is string {
  return typeof value === 'string'
    && UUID_PATTERN.test(value)
    && value.toLowerCase()
      !== '00000000-0000-0000-0000-000000000000'
}

function readExtension(fileName: string): string {
  const separator = fileName.lastIndexOf('.')
  return separator < 0
    ? ''
    : fileName
      .slice(separator + 1)
      .toLowerCase()
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value))
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJson)
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, child]) =>
          typeof child !== 'undefined')
        .sort(([left], [right]) =>
          left.localeCompare(right))
        .map(([key, child]) => [
          key,
          sortJson(child),
        ]),
    )
  }

  return value
}

async function sha256Text(
  value: string,
): Promise<string> {
  return sha256Bytes(
    new TextEncoder().encode(value),
  )
}

async function sha256Bytes(
  value: BufferSource,
): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) {
    throw new Error(
      'Secure TaxFree upload fingerprinting is unavailable.',
    )
  }

  const digest = await subtle.digest(
    'SHA-256',
    value,
  )
  return Array.from(new Uint8Array(digest))
    .map((byte) =>
      byte.toString(16).padStart(2, '0'))
    .join('')
}
