import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import {
  getSalesPendingMutationUserKey,
  loadSalesPendingMutation,
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
  advanceSaleFileMutationSession,
  createSaleFileMutationSubmission,
  getLegacySaleFileMutationContextFromContext,
  getSaleFileMutationJournalContext,
  isPersistedSaleFileMutation,
  persistSaleFileMutationSubmission,
  resumeSaleFileMutationSubmission,
  SALE_FILE_MUTATION_INTENTS,
  restoreSaleFileMutationSubmission,
  SALE_FILE_MUTATION_SURFACES,
  type PersistedSaleFileMutation,
  type SaleFileMutationIntent,
  type SaleFileMutationKind,
  type SaleFileMutationOperationIdentity,
  type SaleFileMutationRequest,
  type SaleFileMutationSubmission,
  type SaleFileMutationSurface,
} from './saleFileMutation'
import type { SalesUkraineSale } from './types'
import { createWizardAsyncGenerationGuard } from './components/new-sale-wizard/wizardAsyncGeneration'

export type { SaleFileMutationIntent } from './saleFileMutation'

type BlockedSaleFileMutation = {
  canResume: boolean
  persisted: PersistedSaleFileMutationRecord
  scope: SalesPendingMutationScope
}

type SaleFileMutationReconciliation = {
  canResume: boolean
  kind: SaleFileMutationKind | null
  requiresFileReselection: boolean
}

export type PersistedSaleFileMutationRecord = PersistedSaleFileMutation &
  Partial<SaleFileMutationOperationIdentity>

export type IdentifiedPersistedSaleFileMutationRecord = PersistedSaleFileMutation &
  SaleFileMutationOperationIdentity

export function usePersistentSaleFileMutation(
  context: string,
  intent: SaleFileMutationIntent = SALE_FILE_MUTATION_INTENTS.save,
) {
  const { session } = useAuth()
  const userKey = getSalesPendingMutationUserKey(session)
  const pendingRef = useRef<SaleFileMutationSubmission | null>(null)
  const pendingScopeRef = useRef<SalesPendingMutationScope | null>(null)
  const blockedRef = useRef<BlockedSaleFileMutation | null>(null)
  const unavailableRef = useRef(false)
  const mountedRef = useRef(false)
  const [guard] = useState(createWizardAsyncGenerationGuard)
  const [pendingError, setPendingError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState(false)
  const [reconciliation, setReconciliation] = useState<SaleFileMutationReconciliation | null>(null)
  const [storageRevision, setStorageRevision] = useState(0)

  const journalContext = getSaleFileMutationJournalContext(context, intent)
  const getScope = useCallback((kind: SaleFileMutationKind): SalesPendingMutationScope | null => (
    userKey && journalContext ? { context: journalContext, kind, userKey } : null
  ), [journalContext, userKey])
  const getPreviousManagementScope = useCallback((kind: SaleFileMutationKind): SalesPendingMutationScope | null => (
    userKey && context && context !== journalContext ? { context, kind, userKey } : null
  ), [context, journalContext, userKey])
  const legacyContext = getLegacySaleFileMutationContextFromContext(context)
  const getLegacyScope = useCallback((kind: SaleFileMutationKind): SalesPendingMutationScope | null => (
    userKey && legacyContext ? { context: legacyContext, kind, userKey } : null
  ), [legacyContext, userKey])
  useEffect(() => subscribeSalesPendingMutations(({ external }) => {
    if (external) {
      setStorageRevision((revision) => revision + 1)
    }
  }), [])
  useLayoutEffect(() => {
    let cancelled = false
    const scheduleRestoredState = (
      error: string | null,
      isBlocked: boolean,
      nextReconciliation: SaleFileMutationReconciliation | null,
    ) => {
      queueMicrotask(() => {
        if (!cancelled && mountedRef.current) {
          setPendingError(error)
          setBlocked(isBlocked)
          setReconciliation(nextReconciliation)
        }
      })
    }

    mountedRef.current = true
    guard.invalidate()
    pendingRef.current = null
    pendingScopeRef.current = null
    blockedRef.current = null
    unavailableRef.current = false
    let restoredError: string | null = null
    let restoredBlocked = false
    let restoredReconciliation: SaleFileMutationReconciliation | null = null

    try {
      synchronizeSalesPendingMutationUser(userKey)

      fileKinds: for (const kind of ['sale-update-file', 'sale-vat-document'] as const) {
        const candidates = [
          { legacy: false, scope: getScope(kind) },
          { legacy: false, scope: getPreviousManagementScope(kind) },
          { legacy: true, scope: getLegacyScope(kind) },
        ]

        for (const candidate of candidates) {
          const { scope } = candidate
          const stored = scope
            ? loadSalesPendingMutation<PersistedSaleFileMutationRecord>(scope)
            : null

          if (!scope || !stored) {
            continue
          }

          if (
            !isPersistedSaleFileMutationRecord(stored.payload) ||
            stored.payload.kind !== kind ||
            stored.payload.operationId !== stored.operationId
          ) {
            markSalesPendingMutationCorrupt(
              scope,
              stored.operationId,
              'Persisted file mutation payload does not match its durable scope',
            )
          }

          const owned = isManagementSaleFileMutationRecord(stored.payload, candidate.legacy, intent)
          const restored = owned ? restoreSaleFileMutationSubmission(stored.payload) : null

          if (restored) {
            pendingRef.current = restored
            pendingScopeRef.current = scope
            restoredError = 'Попередня операція не підтверджена. Повторіть дію для звірки тим самим ключем'
            restoredReconciliation = {
              canResume: true,
              kind,
              requiresFileReselection: false,
            }
          } else {
            const blockedEntry: BlockedSaleFileMutation = {
              canResume: owned,
              persisted: stored.payload,
              scope,
            }
            blockedRef.current = blockedEntry
            restoredBlocked = true
            restoredReconciliation = {
              canResume: owned,
              kind,
              requiresFileReselection: owned && stored.payload.hasFile,
            }
            restoredError = owned
              ? 'Оберіть той самий файл ще раз: SHA-256 буде звірено, а повтор піде з тим самим ключем'
              : 'Незавершена файлова операція належить іншій дії. Спочатку звірте саме її результат'
          }

          break fileKinds
        }
      }
    } catch (error) {
      unavailableRef.current = true
      restoredBlocked = true
      restoredReconciliation = {
        canResume: false,
        kind: null,
        requiresFileReselection: false,
      }
      restoredError = toMessage(error, 'Журнал файлової операції недоступний; нові запити заблоковано')
    }

    scheduleRestoredState(restoredError, restoredBlocked, restoredReconciliation)

    return () => {
      cancelled = true
      mountedRef.current = false
      guard.invalidate()
    }
  }, [getLegacyScope, getPreviousManagementScope, getScope, guard, intent, storageRevision, userKey])

  const execute = useCallback(async <TResult>(
    kind: SaleFileMutationKind,
    payload: SalesUkraineSale,
    file: File | null,
    request: SaleFileMutationRequest<TResult>,
    reconcileOnly: boolean,
  ): Promise<TResult | null> => {
    if (unavailableRef.current) {
      throw new Error('Журнал файлової операції недоступний; нові запити заблоковано')
    }

    const currentScope = getScope(kind)

    if (!currentScope) {
      throw new Error('Неможливо безпечно зберегти продаж без авторизованого користувача')
    }

    const blockedEntry = blockedRef.current
    let pending = pendingRef.current
    let scope = pendingScopeRef.current ?? currentScope
    const hasUnresolvedOperation = Boolean(blockedEntry || pending)

    if (!reconcileOnly && hasUnresolvedOperation) {
      throw new Error('Попередня операція не підтверджена. Використайте окрему дію звірки; поточні зміни не надіслано')
    }

    if (reconcileOnly && !hasUnresolvedOperation) {
      throw new Error('Немає файлової операції, яка очікує звірки')
    }

    if (blockedEntry) {
      if (!blockedEntry.canResume) {
        throw new Error('Ця незавершена файлова операція належить іншій дії і не може бути повторена тут')
      }

      if (blockedEntry.persisted.kind !== kind) {
        throw new Error('Спочатку завершіть перевірку попередньої файлової операції продажу')
      }

      if (!file) {
        throw new Error('Повторно оберіть той самий файл для безпечного повтору з тим самим ключем')
      }

      pending = await resumeSaleFileMutationSubmission(blockedEntry.persisted, file)
      scope = blockedEntry.scope
    }

    if (pending && pending.kind !== kind) {
      throw new Error('Спочатку завершіть перевірку попередньої операції продажу')
    }

    const submission = pending ?? await createSaleFileMutationSubmission(kind, payload, file)
    const identifiedPersisted = persistSaleFileMutationRecord(submission, {
      intent,
      surface: SALE_FILE_MUTATION_SURFACES.management,
    })
    const stored = loadSalesPendingMutation<PersistedSaleFileMutationRecord>(scope)
    const persisted = stored?.operationId === submission.operationId
      ? stored.payload
      : identifiedPersisted

    return withSalesPendingMutationLock(scope, submission.operationId, persisted, async (lease) => {
      if (!isPersistedSaleFileMutationRecord(lease.entry.payload)) {
        markSalesPendingMutationCorrupt(scope, lease.operationId, 'Durable file payload failed schema validation')
      }

      const token = guard.begin(`${scope.context}:${kind}:${submission.operationId}`)
      markSalesPendingMutationSubmitted(lease)
      pendingRef.current = submission
      pendingScopeRef.current = scope

      if (blockedEntry) {
        blockedRef.current = null
        setBlocked(false)
        setPendingError(null)
      }

      const result = await advanceSaleFileMutationSession({ kind, request, submission })

      if (result.status === 'pending-reconciliation') {
        markSalesPendingMutationUnknown(lease)
        pendingRef.current = result.submission

        if (mountedRef.current && guard.isCurrent(token, token.context)) {
          setReconciliation({ canResume: true, kind, requiresFileReselection: false })
          setPendingError(toMessage(result.error, 'Сервер не підтвердив операцію'))
        }

        return null
      }

      if (result.status === 'definitive-failure') {
        resolveRejectedSalesPendingMutation(lease)
        pendingRef.current = null
        pendingScopeRef.current = null
        blockedRef.current = null

        if (mountedRef.current && guard.isCurrent(token, token.context)) {
          setBlocked(false)
          setReconciliation(null)
          setPendingError(toMessage(result.error, 'Сервер відхилив операцію'))
        }

        return null
      }

      markSalesPendingMutationUnknown(lease)
      resolveSalesPendingMutation(lease, 'committed')
      pendingRef.current = null
      pendingScopeRef.current = null

      if (!mountedRef.current || !guard.isCurrent(token, token.context)) {
        return null
      }

      setBlocked(false)
      setReconciliation(null)
      setPendingError(null)
      return result.result
    })
  }, [getScope, guard, intent])

  const run = useCallback(<TResult>(
    kind: SaleFileMutationKind,
    payload: SalesUkraineSale,
    file: File | null,
    request: SaleFileMutationRequest<TResult>,
  ) => execute(kind, payload, file, request, false), [execute])

  const reconcile = useCallback(<TResult>(
    kind: SaleFileMutationKind,
    file: File | null,
    request: SaleFileMutationRequest<TResult>,
  ) => {
    const frozenPayload = pendingRef.current?.payload ?? blockedRef.current?.persisted.payload

    if (!frozenPayload) {
      throw new Error('Немає збережених даних файлової операції для звірки')
    }

    return execute(kind, frozenPayload, file, request, true)
  }, [execute])

  return {
    blocked,
    canReconcile: reconciliation?.canResume ?? false,
    pendingError,
    pendingKind: reconciliation?.kind ?? null,
    reconcile,
    reconciliationRequired: reconciliation !== null,
    requiresFileReselection: reconciliation?.requiresFileReselection ?? false,
    run,
  }
}

export function persistSaleFileMutationRecord(
  submission: SaleFileMutationSubmission,
  identity: SaleFileMutationOperationIdentity,
): IdentifiedPersistedSaleFileMutationRecord {
  return {
    ...persistSaleFileMutationSubmission(submission),
    ...identity,
  }
}

export function isPersistedSaleFileMutationRecord(
  value: unknown,
): value is PersistedSaleFileMutationRecord {
  if (!isPersistedSaleFileMutation(value)) {
    return false
  }

  const candidate = value as Partial<PersistedSaleFileMutationRecord>
  const intent = candidate.intent
  const surface = candidate.surface

  return (
    (intent === undefined || isSaleFileMutationIntent(intent)) &&
    (surface === undefined || isSaleFileMutationSurface(surface))
  )
}

export function getSaleFileMutationOperationIdentity(
  value: PersistedSaleFileMutationRecord,
): SaleFileMutationOperationIdentity | null {
  return (
    isSaleFileMutationIntent(value.intent) &&
    isSaleFileMutationSurface(value.surface)
  )
    ? { intent: value.intent, surface: value.surface }
    : null
}

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}

function isManagementSaleFileMutationRecord(
  record: PersistedSaleFileMutationRecord,
  legacyContext: boolean,
  expectedIntent: SaleFileMutationIntent,
): boolean {
  const identity = getSaleFileMutationOperationIdentity(record)

  if (identity) {
    return (
      identity.surface === SALE_FILE_MUTATION_SURFACES.management &&
      identity.intent === expectedIntent
    )
  }

  return (
    legacyContext &&
    expectedIntent === SALE_FILE_MUTATION_INTENTS.save &&
    record.intent === undefined &&
    record.surface === undefined
  )
}

function isSaleFileMutationSurface(value: unknown): value is SaleFileMutationSurface {
  return Object.values(SALE_FILE_MUTATION_SURFACES).includes(value as SaleFileMutationSurface)
}

function isSaleFileMutationIntent(value: unknown): value is SaleFileMutationIntent {
  return Object.values(SALE_FILE_MUTATION_INTENTS).includes(value as SaleFileMutationIntent)
}
