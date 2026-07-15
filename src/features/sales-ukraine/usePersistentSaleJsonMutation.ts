import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { createWizardAsyncGenerationGuard } from './components/new-sale-wizard/wizardAsyncGeneration'
import {
  getSalesPendingMutationUserKey,
  loadSalesPendingMutation,
  SalesPendingMutationConflictError,
  markSalesPendingMutationCorrupt,
  markSalesPendingMutationSubmitted,
  markSalesPendingMutationUnknown,
  resolveRejectedSalesPendingMutation,
  resolveSalesPendingMutation,
  subscribeSalesPendingMutations,
  synchronizeSalesPendingMutationUser,
  withSalesPendingMutationLock,
  type SalesPendingMutationScope,
} from './pendingSalesMutationRegistry'
import {
  advanceSaleJsonMutationSession,
  createSaleJsonMutationSubmission,
  hasSameSaleJsonMutationPayload,
  isSaleJsonMutationSubmission,
  type SaleJsonMutationKind,
  type SaleJsonMutationRequest,
  type SaleJsonMutationSubmission,
} from './saleJsonMutation'
import type { SalesUkraineSale } from './types'

export type PersistentSaleJsonMutationResult<TResult> =
  | { completed: true; result: TResult }
  | { completed: false }

export type PersistentSaleJsonMutationRunnerResult<TResult> =
  | { completed: true; result: TResult }
  | { completed: false; error: unknown }

export function usePersistentSaleJsonMutationRunner(kind: SaleJsonMutationKind) {
  const { session } = useAuth()
  const userKey = getSalesPendingMutationUserKey(session)

  return useCallback(async <TPayload extends object, TResult>(
    context: string,
    payload: TPayload,
    request: SaleJsonMutationRequest<TPayload, TResult>,
  ): Promise<PersistentSaleJsonMutationRunnerResult<TResult>> => runPersistentSaleJsonMutation({
    context,
    kind,
    payload,
    request,
    userKey,
  }), [kind, userKey])
}

export async function runPersistentSaleJsonMutation<TPayload extends object, TResult>({
  context,
  kind,
  payload,
  request,
  userKey,
}: {
  context: string
  kind: SaleJsonMutationKind
  payload: TPayload
  request: SaleJsonMutationRequest<TPayload, TResult>
  userKey: string
}): Promise<PersistentSaleJsonMutationRunnerResult<TResult>> {
  const normalizedContext = context.trim()

  if (!userKey || !normalizedContext) {
    throw new Error('Неможливо безпечно виконати операцію без авторизованого користувача')
  }

  synchronizeSalesPendingMutationUser(userKey)
  const scope: SalesPendingMutationScope = { context: normalizedContext, kind, userKey }
  const stored = loadSalesPendingMutation<SaleJsonMutationSubmission<TPayload>>(scope)

  if (
    stored &&
    (
      !stored.resumable ||
      !isSaleJsonMutationSubmission(stored.payload) ||
      stored.payload.kind !== kind ||
      stored.payload.operationId !== stored.operationId
    )
  ) {
    markSalesPendingMutationCorrupt(
      scope,
      stored.operationId,
      'Persisted JSON mutation payload does not match its durable scope',
    )
  }

  const submission = stored?.payload ?? createSaleJsonMutationSubmission(kind, payload)
  const currentPayloadChanged = Boolean(
    stored && !hasSameSaleJsonMutationPayload(stored.payload, payload),
  )

  return withSalesPendingMutationLock(scope, submission.operationId, submission, async (lease) => {
    if (!isSaleJsonMutationSubmission(lease.entry.payload)) {
      markSalesPendingMutationCorrupt(scope, lease.operationId, 'Durable JSON payload failed schema validation')
    }

    markSalesPendingMutationSubmitted(lease)
    const attempt = await advanceSaleJsonMutationSession({
      request,
      submission: lease.entry.payload,
      wasPending: Boolean(stored),
    })

    if (attempt.status === 'pending-reconciliation') {
      markSalesPendingMutationUnknown(lease)

      return { completed: false, error: attempt.error }
    }

    if (attempt.status === 'definitive-failure') {
      resolveRejectedSalesPendingMutation(lease)

      return { completed: false, error: attempt.error }
    }

    // Resolution can itself fail (for example, storage becomes unavailable).
    // Persist unknown first so every post-submission error remains recoverable.
    markSalesPendingMutationUnknown(lease)
    resolveSalesPendingMutation(lease, 'committed')

    if (currentPayloadChanged) {
      return {
        completed: false,
        error: createReconciledPayloadChangedError(),
      }
    }

    return { completed: true, result: attempt.result }
  })
}

export function usePersistentSaleJsonMutation<TPayload extends object = SalesUkraineSale>(
  context: string,
  kind: SaleJsonMutationKind,
) {
  const { session } = useAuth()
  const userKey = getSalesPendingMutationUserKey(session)
  const pendingRef = useRef<SaleJsonMutationSubmission<TPayload> | null>(null)
  const mountedRef = useRef(false)
  const contextRef = useRef(context)
  const [guard] = useState(createWizardAsyncGenerationGuard)
  const [pendingError, setPendingError] = useState<string | null>(null)
  const [hasPending, setHasPending] = useState(false)
  const [storageRevision, setStorageRevision] = useState(0)
  const scope = useMemo<SalesPendingMutationScope | null>(() => (
    userKey && context ? { context, kind, userKey } : null
  ), [context, kind, userKey])

  useEffect(() => subscribeSalesPendingMutations(({ external }) => {
    if (external) {
      setStorageRevision((revision) => revision + 1)
    }
  }), [])

  useLayoutEffect(() => {
    let cancelled = false
    mountedRef.current = true
    contextRef.current = context
    guard.invalidate()
    let restored = false
    let restoredError: string | null = null

    try {
      synchronizeSalesPendingMutationUser(userKey)
      const stored = scope
        ? loadSalesPendingMutation<SaleJsonMutationSubmission<TPayload>>(scope)
        : null
      restored = Boolean(stored)

      if (stored) {
        if (
          !stored.resumable ||
          !isSaleJsonMutationSubmission(stored.payload) ||
          stored.payload.kind !== kind ||
          stored.payload.operationId !== stored.operationId
        ) {
          markSalesPendingMutationCorrupt(
            scope as SalesPendingMutationScope,
            stored.operationId,
            'Persisted JSON mutation payload does not match its durable scope',
          )
        }

        pendingRef.current = stored.payload
        restoredError = 'Попередня операція не підтверджена. Повторіть дію з тим самим ключем і незмінними даними'
      } else {
        pendingRef.current = null
      }
    } catch (error) {
      pendingRef.current = null
      restored = true
      restoredError = toMessage(error, 'Журнал операції недоступний; нові запити заблоковано')
    }

    queueMicrotask(() => {
      if (!cancelled && mountedRef.current && contextRef.current === context) {
        setHasPending(restored)
        setPendingError(restoredError)
      }
    })

    return () => {
      cancelled = true
      mountedRef.current = false
      guard.invalidate()
    }
  }, [context, guard, kind, scope, storageRevision, userKey])

  const run = useCallback(async <TResult>(
    payload: TPayload,
    request: SaleJsonMutationRequest<TPayload, TResult>,
  ): Promise<PersistentSaleJsonMutationResult<TResult>> => {
    if (!scope) {
      throw new Error('Неможливо безпечно виконати операцію без авторизованого користувача')
    }

    const pending = pendingRef.current

    if (pending && pending.kind !== kind) {
      throw new Error('Спочатку завершіть перевірку попередньої операції продажу')
    }

    const submission = pending ?? createSaleJsonMutationSubmission(kind, payload)
    const currentPayloadChanged = Boolean(
      pending && !hasSameSaleJsonMutationPayload(pending, payload),
    )
    return withSalesPendingMutationLock(scope, submission.operationId, submission, async (lease) => {
      if (!isSaleJsonMutationSubmission(lease.entry.payload)) {
        markSalesPendingMutationCorrupt(scope, lease.operationId, 'Durable JSON payload failed schema validation')
      }

      const token = guard.begin(`${scope.context}:${kind}:${submission.operationId}`)
      markSalesPendingMutationSubmitted(lease)
      pendingRef.current = submission
      const attempt = await advanceSaleJsonMutationSession({
        request,
        submission,
        wasPending: Boolean(pending),
      })

      if (attempt.status === 'pending-reconciliation') {
        markSalesPendingMutationUnknown(lease)
        pendingRef.current = attempt.submission

        if (mountedRef.current && contextRef.current === context && guard.isCurrent(token, token.context)) {
          setHasPending(true)
          setPendingError(toMessage(attempt.error, 'Сервер не підтвердив операцію'))
        }

        return { completed: false }
      }

      if (attempt.status === 'definitive-failure') {
        resolveRejectedSalesPendingMutation(lease)
        pendingRef.current = null

        if (mountedRef.current && contextRef.current === context && guard.isCurrent(token, token.context)) {
          setHasPending(false)
          setPendingError(toMessage(attempt.error, 'Сервер відхилив операцію'))
        }

        return { completed: false }
      }

      markSalesPendingMutationUnknown(lease)
      resolveSalesPendingMutation(lease, 'committed')
      pendingRef.current = null

      if (!mountedRef.current || contextRef.current !== context || !guard.isCurrent(token, token.context)) {
        return { completed: false }
      }

      setHasPending(false)
      setPendingError(
        currentPayloadChanged ? createReconciledPayloadChangedError().message : null,
      )

      if (currentPayloadChanged) {
        return { completed: false }
      }

      return { completed: true, result: attempt.result }
    })
  }, [context, guard, kind, scope])

  const hasPendingOperation = useCallback(() => pendingRef.current !== null, [])

  return { hasPending, hasPendingOperation, pendingError, run }
}

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}

function createReconciledPayloadChangedError(): SalesPendingMutationConflictError {
  return new SalesPendingMutationConflictError(
    'Попередню операцію підтверджено за її збереженими даними. ' +
    'Поточні змінені дані не відправлено; повторіть дію.',
  )
}
