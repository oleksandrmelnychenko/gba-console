import { ApiError } from '../../shared/api/apiClient'
import { readSession } from '../../shared/auth/session'
import type { DataSyncStatus } from './types'

export type SyncStartDescriptor = {
  forAmg: boolean
  from?: Date
  mode: 'daily' | 'full'
  stockMode?: number
  to?: Date
  types: readonly string[]
}

export type SyncStartOperation = {
  complete: (operationId: string) => void
  getOrCreate: (descriptor: SyncStartDescriptor) => string
  handleFailure: (operationId: string, error: unknown) => void
  reconcile: (status: DataSyncStatus) => void
}

type PendingSyncStartOperation = {
  operationId: string
  signature: string
}

const STORAGE_KEY_PREFIX = 'gba:sync-start-operation:v1'
const OPERATION_ID_PATTERN = /^[0-9a-f]{32}$/i

export function createSyncStartOperation(
  createOperationId: () => string,
): SyncStartOperation {
  const storageKey = createStorageKey()
  let pending = readPersistedOperation(storageKey)

  return {
    complete(operationId) {
      if (pending?.operationId === normalizeOperationId(operationId)) {
        pending = null
        removePersistedOperation(storageKey, operationId)
      }
    },
    getOrCreate(descriptor) {
      const signature = createDescriptorSignature(descriptor)
      pending ??= readPersistedOperation(storageKey)

      if (pending) {
        if (pending.signature !== signature) {
          throw new Error(
            'Результат попереднього запуску ще не підтверджено. Повторіть його без зміни параметрів.',
          )
        }

        return pending.operationId
      }

      const operationId = normalizeOperationId(createOperationId())
      if (!isValidOperationId(operationId)) {
        throw new Error('Не вдалося створити ідентифікатор запуску синхронізації')
      }

      pending = { operationId, signature }
      persistOperation(storageKey, pending)

      return operationId
    },
    handleFailure(operationId, error) {
      if (
        pending?.operationId === normalizeOperationId(operationId) &&
        isDefinitiveFailure(error)
      ) {
        pending = null
        removePersistedOperation(storageKey, operationId)
      }
    },
    reconcile(status) {
      if (!pending) {
        pending = readPersistedOperation(storageKey)
      }

      if (!pending || !statusContainsOperation(status, pending.operationId)) {
        return
      }

      const operationId = pending.operationId
      pending = null
      removePersistedOperation(storageKey, operationId)
    },
  }
}

function createDescriptorSignature(descriptor: SyncStartDescriptor): string {
  return JSON.stringify({
    forAmg: descriptor.forAmg,
    from: descriptor.from?.toISOString() ?? null,
    mode: descriptor.mode,
    stockMode: descriptor.stockMode ?? null,
    to: descriptor.to?.toISOString() ?? null,
    types: [...new Set(descriptor.types)].sort(compareSyncTypes),
  })
}

function compareSyncTypes(left: string, right: string): number {
  const leftNumber = Number(left)
  const rightNumber = Number(right)

  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber
  }

  return left.localeCompare(right)
}

function statusContainsOperation(
  status: DataSyncStatus,
  operationId: string,
): boolean {
  return [
    status.ActiveRun?.PipelineRunId,
    status.LastTerminalRun?.PipelineRunId,
    status.PipelineRunId,
    status.RunId,
  ].some((candidate) => normalizeOperationId(candidate) === operationId)
}

function isDefinitiveFailure(error: unknown): boolean {
  const status = error instanceof ApiError
    ? error.status
    : readNumericStatus(error)

  return status !== null &&
    status >= 400 &&
    status < 500 &&
    status !== 408
}

function readNumericStatus(error: unknown): number | null {
  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    typeof error.status === 'number'
  ) {
    return error.status
  }

  return null
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
): PendingSyncStartOperation | null {
  const storage = getSessionStorage()
  if (!storage) {
    return null
  }

  try {
    const serialized = storage.getItem(storageKey)
    if (!serialized) {
      return null
    }

    const candidate = JSON.parse(serialized) as Partial<PendingSyncStartOperation>
    const operationId = normalizeOperationId(candidate.operationId)

    if (!isValidOperationId(operationId) || typeof candidate.signature !== 'string') {
      storage.removeItem(storageKey)
      return null
    }

    return {
      operationId,
      signature: candidate.signature,
    }
  } catch {
    return null
  }
}

function persistOperation(
  storageKey: string,
  operation: PendingSyncStartOperation,
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
    if (persisted?.operationId === normalizeOperationId(operationId)) {
      storage.removeItem(storageKey)
    }
  } catch {
    // The in-memory operation is already settled.
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

function normalizeOperationId(value: string | null | undefined): string {
  return (value || '').replaceAll('-', '').trim().toLowerCase()
}

function isValidOperationId(operationId: string): boolean {
  return OPERATION_ID_PATTERN.test(operationId) &&
    operationId !== '00000000000000000000000000000000'
}
