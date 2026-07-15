import { ApiError } from '../../shared/api/apiClient'

export const SALES_IDEMPOTENCY_HEADER = 'Idempotency-Key'
export const SALES_MUTATION_LEDGER_STATE_HEADER = 'X-Mutation-Ledger-State'
export const SALES_MUTATION_LEDGER_NOT_ENTERED = 'not-entered'

export type SalesMutationFailureStatus = 'definitive-failure' | 'pending-reconciliation'

export type SalesMutationOperationOptions = {
  operationId: string
  signal?: AbortSignal
}

export type SalesMutationOperationPayload = {
  OperationNetUid: string
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

/** A rejection is definitive only when the server explicitly proves that the
 * request never entered its mutation ledger. The accepted response contract is
 * either `X-Mutation-Ledger-State: not-entered` or a top-level JSON
 * `MutationLedgerState: "not-entered"` marker on a 4xx response.
 */
export function classifySalesMutationFailure(error: unknown): SalesMutationFailureStatus {
  if (!(error instanceof ApiError) || error.status < 400 || error.status >= 500) {
    return 'pending-reconciliation'
  }

  const headerState = normalizeLedgerState(error.headers.get(SALES_MUTATION_LEDGER_STATE_HEADER))
  const payloadState = getMutationLedgerState(error.payload)

  return headerState === SALES_MUTATION_LEDGER_NOT_ENTERED ||
    payloadState === SALES_MUTATION_LEDGER_NOT_ENTERED
    ? 'definitive-failure'
    : 'pending-reconciliation'
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
