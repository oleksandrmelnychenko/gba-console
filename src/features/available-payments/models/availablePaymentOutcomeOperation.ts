import {
  classifyAccountingMutationFailure,
  createAccountingMutationOperationId,
  getAccountingMutationStatus,
  type AccountingMutationStatus,
} from '../../../shared/api/accountingMutationOperation'
import { readSession } from '../../../shared/auth/session'
import type { AvailablePaymentOutcomeRequest } from '../types'

export type AvailablePaymentOutcomeOperation = {
  complete: (operationId: string) => void
  getOrCreate: (request: AvailablePaymentOutcomeRequest) => Promise<string>
  handleFailure: (operationId: string, error: unknown) => void
  hasPending: () => boolean
  reconcile: () => Promise<
    'completed' | 'missing' | 'none' | 'pending'
  >
}

type PendingAvailablePaymentOutcomeOperation = {
  operationId: string
  signature: string
}

const STORAGE_KEY_PREFIX = 'gba:available-payment-outcome-operation:v1'
const OPERATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SHA256_PATTERN = /^[0-9a-f]{64}$/i

export function createAvailablePaymentOutcomeOperation(
  createOperationId: () => string = createAccountingMutationOperationId,
  getStatus: (
    operationId: string,
  ) => Promise<AccountingMutationStatus | null> =
    getAccountingMutationStatus,
): AvailablePaymentOutcomeOperation {
  const storageKey = createStorageKey()
  let pending = readPersistedOperation(storageKey)

  return {
    complete(operationId) {
      if (pending?.operationId === operationId) {
        pending = null
        removePersistedOperation(storageKey, operationId)
      }
    },
    async getOrCreate(request) {
      const signature = await createRequestSignature(request)
      pending ??= readPersistedOperation(storageKey)

      if (pending) {
        if (pending.signature !== signature) {
          throw new Error(
            'A pending outcome-payment submission can only be retried without changes',
          )
        }

        return pending.operationId
      }

      const operationId = createOperationId()
      pending = {
        operationId,
        signature,
      }
      persistOperation(storageKey, pending)

      return operationId
    },
    handleFailure(operationId, error) {
      if (
        pending?.operationId === operationId &&
        classifyAccountingMutationFailure(error) === 'definitive-failure'
      ) {
        pending = null
        removePersistedOperation(storageKey, operationId)
      }
    },
    hasPending() {
      pending ??= readPersistedOperation(storageKey)

      return pending !== null
    },
    async reconcile() {
      pending ??= readPersistedOperation(storageKey)
      if (!pending) {
        return 'none'
      }

      const candidate = pending
      const status = await getStatus(candidate.operationId)
      if (status?.State === 'completed') {
        if (pending?.operationId === candidate.operationId) {
          pending = null
          removePersistedOperation(
            storageKey,
            candidate.operationId,
          )
        }

        return 'completed'
      }

      return status ? 'pending' : 'missing'
    },
  }
}

async function createRequestSignature(
  request: AvailablePaymentOutcomeRequest,
): Promise<string> {
  const {
    documents,
    models,
    ...outcome
  } = request
  const documentMetadata = await Promise.all(
    documents.map(readDocumentMetadata),
  )

  return sha256(stableStringify({
    documents: documentMetadata,
    models: models.map((model) => ({
      task: model.task,
    })),
    outcome,
  }))
}

async function readDocumentMetadata(document: File) {
  return {
    lastModified: document.lastModified,
    name: document.name,
    sha256: await sha256(await document.arrayBuffer()),
    size: document.size,
    type: document.type,
  }
}

async function sha256(value: string | ArrayBuffer): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      'Браузер не підтримує SHA-256 перевірку файла; запит не надіслано',
    )
  }

  const bytes = typeof value === 'string'
    ? new TextEncoder().encode(value)
    : value
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)

  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('')
}

function createStorageKey(): string {
  return `${STORAGE_KEY_PREFIX}:${getUserScope()}`
}

function getUserScope(): string {
  try {
    const session = readSession()
    const userNetUid =
      session?.userNetUid?.trim().toLowerCase() ||
      session?.user?.NetUid?.trim().toLowerCase()

    if (userNetUid) {
      return `user-${userNetUid}`
    }

    if (session?.user?.Id) {
      return `user-id-${session.user.Id}`
    }
  } catch {
    // An unavailable browser store gets an isolated anonymous scope.
  }

  return 'anonymous'
}

function readPersistedOperation(
  storageKey: string,
): PendingAvailablePaymentOutcomeOperation | null {
  const storage = getSessionStorage()

  if (!storage) {
    return null
  }

  try {
    const serialized = storage.getItem(storageKey)

    if (!serialized) {
      return null
    }

    const candidate = JSON.parse(serialized) as Partial<
      PendingAvailablePaymentOutcomeOperation
    >

    if (
      !OPERATION_ID_PATTERN.test(candidate.operationId || '') ||
      candidate.operationId === '00000000-0000-0000-0000-000000000000' ||
      !SHA256_PATTERN.test(candidate.signature || '')
    ) {
      storage.removeItem(storageKey)

      return null
    }

    return {
      operationId: candidate.operationId?.toLowerCase() || '',
      signature: candidate.signature?.toLowerCase() || '',
    }
  } catch {
    return null
  }
}

function persistOperation(
  storageKey: string,
  operation: PendingAvailablePaymentOutcomeOperation,
) {
  const storage = getSessionStorage()

  if (!storage) {
    return
  }

  try {
    storage.setItem(storageKey, JSON.stringify(operation))
  } catch {
    // The in-memory operation remains fail-closed when storage is unavailable.
  }
}

function removePersistedOperation(
  storageKey: string,
  operationId: string,
) {
  const storage = getSessionStorage()

  if (!storage) {
    return
  }

  try {
    const persisted = readPersistedOperation(storageKey)

    if (persisted?.operationId === operationId.toLowerCase()) {
      storage.removeItem(storageKey)
    }
  } catch {
    // The current in-memory operation is already settled.
  }
}

function getSessionStorage(): Storage | null {
  try {
    return typeof globalThis.sessionStorage === 'undefined'
      ? null
      : globalThis.sessionStorage
  } catch {
    return null
  }
}

function stableStringify(value: unknown): string {
  if (value === null) {
    return 'null'
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const properties = Object.keys(record)
      .filter((key) => typeof record[key] !== 'undefined')
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)

    return `{${properties.join(',')}}`
  }

  const serialized = JSON.stringify(value)

  if (typeof serialized !== 'string') {
    throw new Error('Outcome-payment submission contains an unsupported value')
  }

  return serialized
}
