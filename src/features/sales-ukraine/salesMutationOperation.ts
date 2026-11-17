import { ApiError } from '../../shared/api/apiClient'

export const SALES_IDEMPOTENCY_HEADER = 'Idempotency-Key'
export const SALES_MUTATION_LEDGER_STATE_HEADER = 'X-Mutation-Ledger-State'
export const SALES_MUTATION_LEDGER_NOT_ENTERED = 'not-entered'
export const SALES_MUTATION_LEDGER_ROLLED_BACK = 'rolled-back'

export type SalesMutationFailureStatus = 'definitive-failure' | 'pending-reconciliation'

export type SalesMutationOperationOptions = {
  operationId: string
  signal?: AbortSignal
}

export type SalesMutationOperationPayload = {
  OperationNetUid: string
}

export class SalesMutationPreflightValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SalesMutationPreflightValidationError'
  }
}

export function getSalesMutationOperationHeaders(operationId: string): HeadersInit {
  const normalized = normalizeSalesOperationNetUid(operationId)

  return { [SALES_IDEMPOTENCY_HEADER]: normalized }
}

export function withSalesMutationOperationNetUid<T extends object>(
  payload: T,
  operationId: string,
): T & SalesMutationOperationPayload {
  return {
    ...payload,
    OperationNetUid: normalizeSalesOperationNetUid(operationId),
  }
}

export function snapshotSalesMutationPayload<T extends object>(
  payload: T,
  operationId: string,
): T & SalesMutationOperationPayload {
  const wirePayload = snapshotImmutableSalesJson(payload)

  return deepFreeze(withSalesMutationOperationNetUid(wirePayload, operationId))
}

export function snapshotImmutableSalesJson<T>(value: T): T {
  return deepFreeze(JSON.parse(JSON.stringify(value)) as T)
}

export function normalizeSalesOperationNetUid(operationId: string): string {
  const normalized = operationId.trim().toLowerCase()

  if (!normalized) {
    throw new Error('OperationNetUid is required for a sales mutation')
  }

  return normalized
}

/** Only an unknown outcome may keep the operation locked for reconciliation: network failures,
 * aborts, 5xx and the 4xx statuses that do not prove a decision (408 timeout, 409 operation still in
 * flight, 425, 429). Any other 4xx (validation 400, 401/403/404, 413, 422...) is the final answer of
 * the server: the data must be corrected, so it never leaves an unknown-outcome lock behind.
 * An explicit `X-Mutation-Ledger-State` / `MutationLedgerState` marker settles any 4xx.
 */
export function classifySalesMutationFailure(error: unknown): SalesMutationFailureStatus {
  if (error instanceof SalesMutationPreflightValidationError) {
    return 'definitive-failure'
  }

  if (!(error instanceof ApiError) || error.status < 400 || error.status >= 500) {
    return 'pending-reconciliation'
  }

  const headerState = normalizeLedgerState(error.headers.get(SALES_MUTATION_LEDGER_STATE_HEADER))
  const payloadState = getMutationLedgerState(error.payload)

  return isDefinitiveLedgerState(headerState) ||
    isDefinitiveLedgerState(payloadState) ||
    !AMBIGUOUS_CLIENT_ERROR_STATUSES.has(error.status)
    ? 'definitive-failure'
    : 'pending-reconciliation'
}

const AMBIGUOUS_CLIENT_ERROR_STATUSES = new Set([408, 409, 425, 429])

function isDefinitiveLedgerState(value: string): boolean {
  return value === SALES_MUTATION_LEDGER_NOT_ENTERED ||
    value === SALES_MUTATION_LEDGER_ROLLED_BACK || value === 'rejected'
}

function getMutationLedgerState(payload: unknown): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return ''
  }

  return normalizeLedgerState((payload as { MutationLedgerState?: unknown }).MutationLedgerState)
}

function normalizeLedgerState(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value
  }

  Object.freeze(value)

  for (const nested of Object.values(value)) {
    deepFreeze(nested)
  }

  return value
}
