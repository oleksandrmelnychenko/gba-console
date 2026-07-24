import { useCallback } from 'react'
import { useAuth } from '../auth/useAuth'
import { createWizardOperationId } from './components/new-sale-wizard/wizardMutationOperation'
import {
  getSalesPendingMutationUserKey,
  loadSalesPendingMutation,
  markSalesPendingMutationCorrupt,
  markSalesPendingMutationSubmitted,
  markSalesPendingMutationUnknown,
  resolveRejectedSalesPendingMutation,
  resolveSalesPendingMutation,
  synchronizeSalesPendingMutationUser,
  withSalesPendingMutationLock,
  type SalesPendingMutationKind,
  type SalesPendingMutationScope,
} from './pendingSalesMutationRegistry'
import {
  classifySalesMutationFailure,
  normalizeSalesOperationNetUid,
  snapshotImmutableSalesJson,
  type SalesMutationOperationOptions,
} from './salesMutationOperation'

const PERSISTED_CREATE_MUTATION_VERSION = 1
const PERSISTED_CREATE_CONTEXT_PREFIX = 'persistent-create'
const PERSISTED_CREATE_KIND: Record<PersistentCreateMutationFlow, SalesPendingMutationKind> = {
  'future-reservation': 'future-reservation-create',
  offer: 'offer-create',
  preorder: 'preorder-create',
}

export type PersistentCreateMutationFlow = 'future-reservation' | 'offer' | 'preorder'

type PersistedCreateMutation<TPayload extends object> = {
  context: string
  flow: PersistentCreateMutationFlow
  operationId: string
  payload: TPayload
  version: typeof PERSISTED_CREATE_MUTATION_VERSION
}

export type PersistentCreateMutationRequest<TPayload extends object, TResult> = (
  payload: TPayload,
  operation: SalesMutationOperationOptions,
) => Promise<TResult>

export function usePersistentCreateMutation(
  flow: PersistentCreateMutationFlow,
  context: string,
) {
  const { session } = useAuth()
  const userKey = getSalesPendingMutationUserKey(session)

  return useCallback(async <TPayload extends object, TResult>(
    payload: TPayload,
    request: PersistentCreateMutationRequest<TPayload, TResult>,
  ): Promise<TResult> => runPersistentCreateMutation({
    context,
    flow,
    payload,
    request,
    userKey,
  }), [context, flow, userKey])
}

export async function runPersistentCreateMutation<TPayload extends object, TResult>({
  context,
  flow,
  payload,
  request,
  userKey,
}: {
  context: string
  flow: PersistentCreateMutationFlow
  payload: TPayload
  request: PersistentCreateMutationRequest<TPayload, TResult>
  userKey: string
}): Promise<TResult> {
  const scope = createPersistentCreateMutationScope(flow, context, userKey)

  synchronizeSalesPendingMutationUser(scope.userKey)
  const stored = loadSalesPendingMutation<PersistedCreateMutation<TPayload>>(scope)

  if (
    stored &&
    (
      !stored.resumable ||
      !isPersistedCreateMutation(stored.payload, flow, scope.context, stored.operationId)
    )
  ) {
    markSalesPendingMutationCorrupt(
      scope,
      stored.operationId,
      'Persisted create mutation payload does not match its durable scope',
    )
  }

  const submission = stored?.payload ?? createPersistedCreateMutation(flow, scope.context, payload)

  return withSalesPendingMutationLock(
    scope,
    submission.operationId,
    submission,
    async (lease) => {
      const persisted = lease.entry.payload

      if (!isPersistedCreateMutation(persisted, flow, scope.context, lease.operationId)) {
        markSalesPendingMutationCorrupt(
          scope,
          lease.operationId,
          'Durable create mutation payload failed schema validation',
        )
      }

      markSalesPendingMutationSubmitted(lease)

      let result: TResult

      try {
        result = await request(persisted.payload, { operationId: persisted.operationId })
      } catch (error) {
        if (classifySalesMutationFailure(error) === 'definitive-failure') {
          resolveRejectedSalesPendingMutation(lease)
        } else {
          markSalesPendingMutationUnknown(lease)
        }

        throw error
      }

      // Keep post-commit storage failures retryable with the same key and payload.
      markSalesPendingMutationUnknown(lease)
      resolveSalesPendingMutation(lease, 'committed')

      return result
    },
  )
}

export function createPersistentCreateMutationScope(
  flow: PersistentCreateMutationFlow,
  context: string,
  userKey: string,
): SalesPendingMutationScope {
  const normalizedContext = normalizeIdentity(context)
  const normalizedUserKey = normalizeIdentity(userKey)

  if (!normalizedContext || !normalizedUserKey) {
    throw new Error('Неможливо безпечно виконати операцію без авторизованого користувача та контексту')
  }

  return {
    context: `${PERSISTED_CREATE_CONTEXT_PREFIX}:${flow}:${normalizedContext}`,
    kind: PERSISTED_CREATE_KIND[flow],
    userKey: normalizedUserKey,
  }
}

function createPersistedCreateMutation<TPayload extends object>(
  flow: PersistentCreateMutationFlow,
  context: string,
  payload: TPayload,
): PersistedCreateMutation<TPayload> {
  const operationId = createWizardOperationId()

  return snapshotImmutableSalesJson({
    context,
    flow,
    operationId,
    payload,
    version: PERSISTED_CREATE_MUTATION_VERSION,
  })
}

function isPersistedCreateMutation<TPayload extends object>(
  value: unknown,
  flow: PersistentCreateMutationFlow,
  context: string,
  operationId: string,
): value is PersistedCreateMutation<TPayload> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const candidate = value as Partial<PersistedCreateMutation<TPayload>>

  return (
    candidate.version === PERSISTED_CREATE_MUTATION_VERSION &&
    candidate.flow === flow &&
    candidate.context === context &&
    normalizeOperationId(candidate.operationId) === normalizeOperationId(operationId) &&
    Boolean(candidate.payload) &&
    typeof candidate.payload === 'object' &&
    !Array.isArray(candidate.payload)
  )
}

function normalizeOperationId(value: unknown): string {
  if (typeof value !== 'string') {
    return ''
  }

  try {
    return normalizeSalesOperationNetUid(value)
  } catch {
    return ''
  }
}

function normalizeIdentity(value: string): string {
  return value.trim().toLowerCase()
}
