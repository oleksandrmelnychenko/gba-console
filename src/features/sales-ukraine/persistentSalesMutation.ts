import { useCallback } from 'react'
import { useAuth } from '../auth/useAuth'
import { createWizardOperationId } from './components/new-sale-wizard/wizardMutationOperation'
import {
  getSalesPendingMutationUserKey,
  loadSalesPendingMutation,
  markSalesPendingMutationCorrupt,
  markSalesPendingMutationSubmitted,
  markSalesPendingMutationUnknown,
  releasePreparedSalesPendingMutation,
  resolveRejectedSalesPendingMutation,
  resolveSalesPendingMutation,
  synchronizeSalesPendingMutationUser,
  withSalesPendingMutationLock,
  type SalesPendingMutationKind,
  type SalesPendingMutationScope,
} from './pendingSalesMutationRegistry'
import {
  classifySalesMutationFailure,
  snapshotImmutableSalesJson,
  type SalesMutationFailureStatus,
  type SalesMutationOperationOptions,
} from './salesMutationOperation'

const PERSISTED_MUTATION_VERSION = 1
const PERSISTED_MUTATION_CONTEXT_PREFIX = 'persistent-mutation'
const PREPARED_MUTATION_RELEASED = Symbol('prepared-mutation-released')

type PersistedSalesMutation<TPayload extends object> = {
  context: string
  kind: SalesPendingMutationKind
  operationId: string
  payload: TPayload
  version: typeof PERSISTED_MUTATION_VERSION
}

export type PersistentSalesMutationRequest<TPayload extends object, TResult> = (
  payload: TPayload,
  operation: SalesMutationOperationOptions,
) => Promise<TResult>

export type SalesMutationFailureClassifier = (
  error: unknown,
) => SalesMutationFailureStatus

export class SalesPendingMutationRecoveredError extends Error {
  constructor() {
    super(
      'Попередню операцію підтверджено. Дані оновлено; перевірте результат і повторіть нову дію.',
    )
    this.name = 'SalesPendingMutationRecoveredError'
  }
}

export function usePersistentSalesMutation(
  kind: SalesPendingMutationKind,
  context: string,
  classifyFailure: SalesMutationFailureClassifier = classifySalesMutationFailure,
) {
  const { session } = useAuth()
  const userKey = getSalesPendingMutationUserKey(session)

  return useCallback(async <TPayload extends object, TResult>(
    payload: TPayload,
    request: PersistentSalesMutationRequest<TPayload, TResult>,
  ): Promise<TResult> => runPersistentSalesMutation({
    classifyFailure,
    context,
    kind,
    payload,
    request,
    userKey,
  }), [classifyFailure, context, kind, userKey])
}

export async function runPersistentSalesMutation<
  TPayload extends object,
  TResult,
>({
  classifyFailure = classifySalesMutationFailure,
  context,
  kind,
  payload,
  request,
  userKey,
}: {
  classifyFailure?: SalesMutationFailureClassifier
  context: string
  kind: SalesPendingMutationKind
  payload: TPayload
  request: PersistentSalesMutationRequest<TPayload, TResult>
  userKey: string
}): Promise<TResult> {
  const scope = createPersistentSalesMutationScope(kind, context, userKey)
  const currentPayload = snapshotImmutableSalesJson(payload)

  synchronizeSalesPendingMutationUser(scope.userKey)
  const stored = loadSalesPendingMutation<PersistedSalesMutation<TPayload>>(scope)

  if (
    stored &&
    !isPersistedSalesMutation(
      stored.payload,
      kind,
      scope.context,
      stored.operationId,
    )
  ) {
    markSalesPendingMutationCorrupt(
      scope,
      stored.operationId,
      'Persisted sales mutation payload does not match its durable scope',
    )
  }

  const recoversDifferentPayload =
    Boolean(stored) &&
    canonicalJson(stored?.payload.payload) !==
      canonicalJson(currentPayload)

  const submission =
    stored?.payload ??
    createPersistedSalesMutation(kind, scope.context, currentPayload)

  const result = await withSalesPendingMutationLock(
    scope,
    submission.operationId,
    submission,
    async (lease) => {
      const persisted = lease.entry.payload

      if (
        !isPersistedSalesMutation(
          persisted,
          kind,
          scope.context,
          lease.operationId,
        )
      ) {
        markSalesPendingMutationCorrupt(
          scope,
          lease.operationId,
          'Durable sales mutation payload failed schema validation',
        )
      }

      if (
        recoversDifferentPayload &&
        lease.entry.phase === 'prepared'
      ) {
        releasePreparedSalesPendingMutation(lease)
        return PREPARED_MUTATION_RELEASED
      }

      markSalesPendingMutationSubmitted(lease)

      try {
        const result = await request(
          persisted.payload,
          { operationId: persisted.operationId },
        )

        markSalesPendingMutationUnknown(lease)
        resolveSalesPendingMutation(lease, 'committed')

        return result
      } catch (error) {
        if (classifyFailure(error) === 'definitive-failure') {
          resolveRejectedSalesPendingMutation(lease)
        } else {
          markSalesPendingMutationUnknown(lease)
        }

        throw error
      }
    },
  )

  if (result === PREPARED_MUTATION_RELEASED) {
    return runPersistentSalesMutation({
      classifyFailure,
      context,
      kind,
      payload,
      request,
      userKey,
    })
  }

  if (recoversDifferentPayload) {
    throw new SalesPendingMutationRecoveredError()
  }

  return result
}

export function createPersistentSalesMutationScope(
  kind: SalesPendingMutationKind,
  context: string,
  userKey: string,
): SalesPendingMutationScope {
  const normalizedContext = normalizeIdentity(context)
  const normalizedUserKey = normalizeIdentity(userKey)

  if (!normalizedContext || !normalizedUserKey) {
    throw new Error(
      'Неможливо безпечно виконати операцію без авторизованого користувача та контексту',
    )
  }

  return {
    context: `${PERSISTED_MUTATION_CONTEXT_PREFIX}:${kind}:${normalizedContext}`,
    kind,
    userKey: normalizedUserKey,
  }
}

function createPersistedSalesMutation<TPayload extends object>(
  kind: SalesPendingMutationKind,
  context: string,
  payload: TPayload,
): PersistedSalesMutation<TPayload> {
  return snapshotImmutableSalesJson({
    context,
    kind,
    operationId: createWizardOperationId(),
    payload,
    version: PERSISTED_MUTATION_VERSION,
  })
}

function isPersistedSalesMutation<TPayload extends object>(
  value: unknown,
  kind: SalesPendingMutationKind,
  context: string,
  operationId: string,
): value is PersistedSalesMutation<TPayload> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const candidate = value as Partial<PersistedSalesMutation<TPayload>>

  return (
    candidate.version === PERSISTED_MUTATION_VERSION &&
    candidate.kind === kind &&
    candidate.context === context &&
    candidate.operationId === operationId &&
    Boolean(candidate.payload) &&
    typeof candidate.payload === 'object' &&
    !Array.isArray(candidate.payload)
  )
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>

    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(',')}}`
  }

  return JSON.stringify(value)
}

function normalizeIdentity(value: string): string {
  return value.trim().toLowerCase()
}
