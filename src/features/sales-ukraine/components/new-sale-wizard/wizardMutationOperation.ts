import { classifySalesMutationFailure } from '../../salesMutationOperation'
import type { SalesUkraineOrderItem, SalesUkraineSale } from '../../types'

export type WizardMutationCommitState = 'committed' | 'not-committed' | 'unknown'

export type WizardCartMutationExpectation =
  | {
      afterQty: number
      beforeQty: number
      kind: 'row-quantity'
      rowNetUid: string
    }
  | {
      beforeQty: number
      kind: 'row-deleted'
      rowNetUid: string
    }
  | { kind: 'operation-marker' }

export type WizardMutationOperation<TSnapshot> = {
  context: string
  inspect: (snapshot: TSnapshot) => WizardMutationCommitState
  mutate: (operationId: string) => Promise<void>
  operationId: string
}

export type WizardMutationAttemptResult<TSnapshot> =
  | { status: 'acknowledged' }
  | { snapshot: TSnapshot; status: 'committed-after-reconcile' }
  | { mutationError: unknown; status: 'definitive-failure' }
  | {
      mutationError: unknown
      reconciliationError: unknown | null
      snapshot: TSnapshot | null
      status: 'pending-retry'
    }

export function createWizardOperationId(randomUuid?: () => string): string {
  const createUuid = randomUuid ?? globalThis.crypto?.randomUUID?.bind(globalThis.crypto)

  if (!createUuid) {
    throw new Error('Secure UUID generation is unavailable')
  }

  return createUuid().trim().toLowerCase()
}

export async function attemptWizardMutation<TSnapshot>(
  operation: WizardMutationOperation<TSnapshot>,
  reconcile: () => Promise<TSnapshot>,
): Promise<WizardMutationAttemptResult<TSnapshot>> {
  try {
    await operation.mutate(operation.operationId)

    return { status: 'acknowledged' }
  } catch (mutationError) {
    // Once mutate() was entered, transport/application status alone cannot
    // prove that the idempotent operation was not committed server-side.
    return reconcileUnknownWizardMutation(operation, reconcile, mutationError)
  }
}

export async function retryWizardMutation<TSnapshot>(
  operation: WizardMutationOperation<TSnapshot>,
  reconcile: () => Promise<TSnapshot>,
): Promise<WizardMutationAttemptResult<TSnapshot>> {
  try {
    const snapshot = await reconcile()
    const commitState = operation.inspect(snapshot)

    if (commitState === 'committed') {
      return { snapshot, status: 'committed-after-reconcile' }
    }

    if (commitState === 'unknown') {
      return {
        mutationError: new Error('Operation outcome is still unknown'),
        reconciliationError: null,
        snapshot,
        status: 'pending-retry',
      }
    }
  } catch (reconciliationError) {
    return {
      mutationError: new Error('Operation outcome is still unknown'),
      reconciliationError,
      snapshot: null,
      status: 'pending-retry',
    }
  }

  try {
    return await attemptWizardMutation(operation, reconcile)
  } catch (mutationError) {
    return { mutationError, status: 'definitive-failure' }
  }
}

export function inspectWizardCartMutation(
  sale: SalesUkraineSale,
  operationId: string,
  expectation: WizardCartMutationExpectation,
): WizardMutationCommitState {
  const items = sale.Order?.OrderItems ?? []
  const normalizedOperationId = normalizeIdentity(operationId)

  if (expectation.kind === 'operation-marker') {
    const markerProjectionIsAuthoritative = Object.hasOwn(sale, 'OperationNetUid') ||
      items.some((item) => Object.hasOwn(item, 'OperationNetUid'))

    if (
      normalizedOperationId &&
      (
        normalizeIdentity(sale.OperationNetUid) === normalizedOperationId ||
        items.some((item) => (
          !item.Deleted && normalizeIdentity(item.OperationNetUid) === normalizedOperationId
        ))
      )
    ) {
      return 'committed'
    }

    return markerProjectionIsAuthoritative ? 'not-committed' : 'unknown'
  }

  const rowNetUid = normalizeIdentity(expectation.rowNetUid)
  const matchingRows = items.filter((item) => normalizeIdentity(item.NetUid) === rowNetUid)

  if (matchingRows.length > 1) {
    return 'unknown'
  }

  const row = matchingRows[0]

  const hasExactRowOperationMarker = Boolean(
    row &&
    normalizedOperationId &&
    normalizeIdentity(row.OperationNetUid) === normalizedOperationId,
  )
  const hasExactSaleOperationMarker = Boolean(
    normalizedOperationId &&
    normalizeIdentity(sale.OperationNetUid) === normalizedOperationId,
  )
  const hasExactOperationMarker = hasExactRowOperationMarker || hasExactSaleOperationMarker

  if (hasExactOperationMarker) {
    if (expectation.kind === 'row-deleted') {
      return !row || row.Deleted ? 'committed' : 'unknown'
    }

    if (!row || row.Deleted) {
      return expectation.afterQty === 0 ? 'committed' : 'unknown'
    }

    return sameQty(row, expectation.afterQty) ? 'committed' : 'unknown'
  }

  if (expectation.kind === 'row-deleted') {
    if (!row || row.Deleted) {
      return 'unknown'
    }

    return sameQty(row, expectation.beforeQty) ? 'not-committed' : 'unknown'
  }

  if (!row || row.Deleted) {
    return 'unknown'
  }

  if (sameQty(row, expectation.afterQty)) {
    return 'unknown'
  }

  return sameQty(row, expectation.beforeQty) ? 'not-committed' : 'unknown'
}

export function isUnknownWizardMutationOutcome(error: unknown): boolean {
  return classifySalesMutationFailure(error) === 'pending-reconciliation'
}

async function reconcileUnknownWizardMutation<TSnapshot>(
  operation: WizardMutationOperation<TSnapshot>,
  reconcile: () => Promise<TSnapshot>,
  mutationError: unknown,
): Promise<WizardMutationAttemptResult<TSnapshot>> {
  try {
    const snapshot = await reconcile()

    if (operation.inspect(snapshot) === 'committed') {
      return { snapshot, status: 'committed-after-reconcile' }
    }

    return {
      mutationError,
      reconciliationError: null,
      snapshot,
      status: 'pending-retry',
    }
  } catch (reconciliationError) {
    return {
      mutationError,
      reconciliationError,
      snapshot: null,
      status: 'pending-retry',
    }
  }
}

function sameQty(item: SalesUkraineOrderItem, expected: number): boolean {
  const actual = typeof item.Qty === 'number' && Number.isFinite(item.Qty) ? item.Qty : 0

  return Math.abs(actual - expected) <= 0.0000001
}

function normalizeIdentity(value: string | null | undefined): string {
  const normalized = value?.trim().toLowerCase() ?? ''

  return normalized === '00000000-0000-0000-0000-000000000000' ? '' : normalized
}
