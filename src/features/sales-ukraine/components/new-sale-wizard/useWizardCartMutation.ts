import { notifications } from '@mantine/notifications'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import {
  loadSalesPendingMutation,
  markSalesPendingMutationCorrupt,
  markSalesPendingMutationSubmitted,
  markSalesPendingMutationUnknown,
  resolveSalesPendingMutation,
  subscribeSalesPendingMutations,
  synchronizeSalesPendingMutationUser,
  withSalesPendingMutationLock,
  type SalesPendingMutationLease,
  type SalesPendingMutationScope,
} from '../../pendingSalesMutationRegistry'
import type { SalesUkraineOrderItem, SalesUkraineSale } from '../../types'
import { attemptPersistentSalesCartMutation } from '../../usePersistentSalesCartMutation'
import {
  assertWizardSplitRecoveryOperationFence,
  commitWizardSplitExtraction,
  hasWizardSplitRecoveryOperation,
  markWizardSplitExtractionSubmitted,
  markWizardSplitExtractionUnknown,
} from './newSaleWizardState'
import {
  createPersistedWizardCartMutation,
  executeWizardCartMutationRequest,
  isPersistedWizardCartMutation,
  type PersistedWizardCartMutation,
  type WizardCartLocalCommit,
  type WizardCartMutationRequest,
} from './wizardCartMutation'
import {
  createWizardOperationId,
  inspectWizardCartMutation,
  retryWizardMutation,
  toWizardCartReconciliationSnapshot,
  type WizardCartMutationExpectation,
  type WizardMutationAttemptResult,
  type WizardMutationOperation,
} from './wizardMutationOperation'
import {
  getWizardMutationContextKey,
  isWizardMutationAgreementContextCurrent,
  isWizardMutationContextCurrent,
  type WizardSplitOrderItem,
} from './wizardSplitSale'

export type PendingCartMutation = WizardMutationOperation<SalesUkraineSale> & PersistedWizardCartMutation & {
  localCommitted: boolean
}

function toPersistedCartMutation(operation: PendingCartMutation): PersistedWizardCartMutation {
  return {
    context: operation.context,
    expectation: operation.expectation,
    fallbackMessage: operation.fallbackMessage,
    localCommit: operation.localCommit,
    operationId: operation.operationId,
    request: operation.request,
  }
}

type WizardCartMutationOptions = {
  agreementNetId: string | null
  sale: SalesUkraineSale | null
  pendingMutationUserKey: string
  activeProductNetUid: string | undefined
  hasSearchResults: boolean
  orderItems: SalesUkraineOrderItem[]
  onBusyChange?: (busy: boolean) => void
  onPendingMutationChange?: (pending: boolean) => void
  onCartChanged: () => SalesUkraineSale | null | void | Promise<SalesUkraineSale | null | void>
  persistSplitItems: (items: WizardSplitOrderItem[], agreementNetId?: string | null) => void
  commitLocalChange: (change: Extract<WizardCartLocalCommit, { kind: 'replace-split-items' }>) => void
  clearProductPricingCache: () => void
  refreshVisibleProductAvailability: (context: string, productNetUid: string) => Promise<void>
}

export function useWizardCartMutation({
  agreementNetId,
  sale,
  pendingMutationUserKey,
  activeProductNetUid,
  hasSearchResults,
  orderItems,
  onBusyChange,
  onPendingMutationChange,
  onCartChanged,
  persistSplitItems,
  commitLocalChange,
  clearProductPricingCache,
  refreshVisibleProductAvailability,
}: WizardCartMutationOptions) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [reconciliationError, setReconciliationError] = useState<string | null>(null)
  const [pendingMutationError, setPendingMutationError] = useState<string | null>(null)
  const [mutationStorageRevision, setMutationStorageRevision] = useState(0)
  const busyRef = useRef(false)
  const mountedRef = useRef(false)
  const mutationContextRef = useRef('')
  const activeMutationContextRef = useRef<string | null>(null)
  const reconciliationErrorRef = useRef<string | null>(null)
  const reconciliationContextRef = useRef<string | null>(null)
  const pendingMutationRef = useRef<PendingCartMutation | null>(null)
  const mutationContextKey = getWizardMutationContextKey(agreementNetId, sale?.NetUid)
  const getPendingCartMutationScope = useCallback((context: string): SalesPendingMutationScope | null => (
    pendingMutationUserKey && context && context !== ':'
      ? { context, kind: 'cart', userKey: pendingMutationUserKey }
      : null
  ), [pendingMutationUserKey])

  const currentReconciliationError = reconciliationContextRef.current === mutationContextKey ? reconciliationError : null

  useLayoutEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      onBusyChange?.(false)
      onPendingMutationChange?.(false)
    }
  }, [onBusyChange, onPendingMutationChange])

  useEffect(() => subscribeSalesPendingMutations(({ external }) => {
    if (external) {
      setMutationStorageRevision((revision) => revision + 1)
    }
  }), [])

  useLayoutEffect(() => {
    let cancelled = false
    mutationContextRef.current = mutationContextKey
    const scope = getPendingCartMutationScope(mutationContextKey)

    try {
      synchronizeSalesPendingMutationUser(pendingMutationUserKey)
      const stored = scope
        ? loadSalesPendingMutation<PersistedWizardCartMutation>(scope)
        : null

      if (stored) {
        if (
          !stored.resumable ||
          !isPersistedWizardCartMutation(stored.payload) ||
          stored.payload.operationId !== stored.operationId ||
          stored.payload.context !== mutationContextKey
        ) {
          markSalesPendingMutationCorrupt(
            scope as SalesPendingMutationScope,
            stored.operationId,
            'Persisted wizard cart payload does not match its durable scope',
          )
        }

        const operation = hydrateCartMutation(stored.payload)
        pendingMutationRef.current = operation
        const localCommit = operation.localCommit

        if (
          localCommit.kind === 'replace-split-items' &&
          localCommit.failureSplitItems &&
          !hasWizardSplitRecoveryOperation(operation.operationId)
        ) {
          persistSplitItems(localCommit.failureSplitItems, localCommit.agreementNetId)
        }

        onBusyChange?.(false)
        onPendingMutationChange?.(true)
        queueMicrotask(() => {
          if (!cancelled && mountedRef.current && mutationContextRef.current === mutationContextKey) {
            if (sale && localCommit.kind === 'none' && operation.inspect(sale) === 'committed') {
              void withSalesPendingMutationLock(
                scope as SalesPendingMutationScope,
                operation.operationId,
                toPersistedCartMutation(operation),
                async (lease) => {
                  resolveSalesPendingMutation(lease, 'committed')

                  if (
                    !cancelled &&
                    mountedRef.current &&
                    mutationContextRef.current === mutationContextKey &&
                    pendingMutationRef.current?.operationId === operation.operationId
                  ) {
                    pendingMutationRef.current = null
                    setPendingMutationError(null)
                    onPendingMutationChange?.(false)
                  }
                },
              ).catch(() => {
                if (!cancelled && mountedRef.current && mutationContextRef.current === mutationContextKey) {
                  setPendingMutationError(t('Операція не була підтверджена. Перевірте результат і повторіть з тим самим ключем'))
                }
              })

              return
            }

            setPendingMutationError(t('Операція не була підтверджена. Перевірте результат і повторіть з тим самим ключем'))
          }
        })

        return () => {
          cancelled = true
        }
      }
    } catch (storageError) {
      pendingMutationRef.current = null
      onBusyChange?.(false)
      onPendingMutationChange?.(true)
      queueMicrotask(() => {
        if (!cancelled && mountedRef.current && mutationContextRef.current === mutationContextKey) {
          setPendingMutationError(getRequestErrorMessage(
            storageError,
            t('Журнал операції недоступний; нові зміни заблоковано'),
          ))
        }
      })

      return () => {
        cancelled = true
      }
    }

    pendingMutationRef.current = null

    onBusyChange?.(false)
    onPendingMutationChange?.(false)
    queueMicrotask(() => {
      if (!cancelled && mountedRef.current && mutationContextRef.current === mutationContextKey) {
        setPendingMutationError(null)
      }
    })

    return () => {
      cancelled = true
    }
  }, [getPendingCartMutationScope, mutationContextKey, mutationStorageRevision, onBusyChange, onPendingMutationChange, pendingMutationUserKey, persistSplitItems, sale, t])

  function beginBusy(options?: { allowPendingMutation?: boolean }): string | null {
    if (busyRef.current) {
      return null
    }

    if (
      !options?.allowPendingMutation &&
      pendingMutationRef.current?.context === mutationContextRef.current
    ) {
      notifications.show({
        color: 'orange',
        message: t('Спочатку перевірте незавершену операцію'),
      })

      return null
    }

    if (
      reconciliationErrorRef.current &&
      reconciliationContextRef.current === mutationContextRef.current
    ) {
      notifications.show({
        color: 'orange',
        message: t('Спочатку повторіть завантаження кошика'),
      })

      return null
    }

    const context = mutationContextRef.current
    busyRef.current = true
    activeMutationContextRef.current = context
    onBusyChange?.(true)
    setBusy(true)

    return context
  }

  function endBusy(context: string) {
    if (activeMutationContextRef.current !== context) {
      return
    }

    activeMutationContextRef.current = null
    busyRef.current = false

    if (mountedRef.current) {
      setBusy(false)
    }

    onBusyChange?.(false)
  }

  function isCurrentMutationContext(context: string): boolean {
    return isWizardMutationContextCurrent(context, mutationContextRef.current, mountedRef.current)
  }

  function isCurrentAvailabilityContext(context: string): boolean {
    return isWizardMutationAgreementContextCurrent(
      context,
      mutationContextRef.current,
      mountedRef.current,
    )
  }

  function hydrateCartMutation(
    persisted: PersistedWizardCartMutation,
    beforeMutate?: () => void,
  ): PendingCartMutation {
    return {
      ...persisted,
      inspect: (snapshot) => inspectWizardCartMutation(
        snapshot,
        persisted.operationId,
        persisted.expectation,
      ),
      localCommitted: false,
      mutate: (operationId) => {
        beforeMutate?.()
        return executeWizardCartMutationRequest(persisted.request, operationId)
      },
    }
  }

  function persistPendingCartMutation(operation: PendingCartMutation) {
    const scope = getPendingCartMutationScope(operation.context)

    if (!scope) {
      throw new Error(t('Неможливо безпечно зберегти операцію без авторизованого користувача'))
    }

    pendingMutationRef.current = operation
  }

  async function reconcileCartAfterMutation(context: string): Promise<boolean> {
    try {
      const freshSale = await onCartChanged()

      if (!isCurrentMutationContext(context)) {
        return false
      }

      if (!freshSale) {
        throw new Error(t('Сервер не повернув оновлений кошик'))
      }

      reconciliationErrorRef.current = null
      reconciliationContextRef.current = null
      setReconciliationError(null)

      return true
    } catch (reconcileError) {
      if (!isCurrentMutationContext(context)) {
        return false
      }

      const message = getRequestErrorMessage(reconcileError, t('Не вдалося оновити кошик після збереження'))
      reconciliationErrorRef.current = message
      reconciliationContextRef.current = context
      setReconciliationError(message)
      notifications.show({
        autoClose: false,
        color: 'orange',
        message: `${t('Зміни збережено, але кошик не оновлено')}: ${message}`,
      })

      return false
    }
  }

  async function getFreshCartForOperation(): Promise<SalesUkraineSale> {
    const freshSale = await onCartChanged()

    return toWizardCartReconciliationSnapshot(freshSale)
  }

  function finishCartMutation(operation: PendingCartMutation) {
    if (operation.localCommitted) {
      return
    }

    if (operation.localCommit.kind === 'replace-split-items') {
      const localCommit = operation.localCommit

      if (isCurrentMutationContext(operation.context)) {
        commitLocalChange(localCommit)
      }
    }

    operation.localCommitted = true
  }

  function clearPendingCartMutation(operation: PendingCartMutation) {
    if (pendingMutationRef.current !== operation) {
      return
    }

    pendingMutationRef.current = null

    if (mountedRef.current) {
      setPendingMutationError(null)
      onPendingMutationChange?.(false)
    }
  }

  function retainPendingCartMutation(
    operation: PendingCartMutation,
    result: Extract<WizardMutationAttemptResult<SalesUkraineSale>, { status: 'pending-retry' }>,
  ) {
    pendingMutationRef.current = operation
    const mutationMessage = getRequestErrorMessage(result.mutationError, operation.fallbackMessage)
    const reconciliationMessage = result.reconciliationError
      ? getRequestErrorMessage(result.reconciliationError, t('Не вдалося перевірити кошик'))
      : null
    setPendingMutationError(
      reconciliationMessage
        ? `${mutationMessage}. ${t('Перевірка кошика')}: ${reconciliationMessage}`
        : mutationMessage,
    )
    onPendingMutationChange?.(true)
  }

  async function handleCartMutationResult(
    operation: PendingCartMutation,
    context: string,
    lease: SalesPendingMutationLease<PersistedWizardCartMutation>,
    result: WizardMutationAttemptResult<SalesUkraineSale>,
  ): Promise<boolean> {
    if (result.status === 'pending-retry' || result.status === 'definitive-failure') {
      markSalesPendingMutationUnknown(lease)
      markWizardSplitExtractionUnknown(lease.operationId)

      if (isCurrentMutationContext(context)) {
        if (result.status === 'pending-retry') {
          retainPendingCartMutation(operation, result)
        } else {
          pendingMutationRef.current = operation
          setPendingMutationError(getRequestErrorMessage(result.mutationError, operation.fallbackMessage))
          onPendingMutationChange?.(true)
        }
      }

      return false
    }

    // Keep both journals conservative until the split extraction is durable.
    // If committing either record fails, recovery must still see an unknown
    // submitted operation instead of a cleared cart journal and hidden items.
    markSalesPendingMutationUnknown(lease)
    markWizardSplitExtractionUnknown(lease.operationId)
    commitWizardSplitExtraction(lease.operationId)
    resolveSalesPendingMutation(lease, 'committed')

    if (!isCurrentMutationContext(context)) {
      return false
    }

    finishCartMutation(operation)
    clearPendingCartMutation(operation)

    if (result.status === 'acknowledged') {
      await reconcileCartAfterMutation(context)
    } else {
      reconciliationErrorRef.current = null
      reconciliationContextRef.current = null
      setReconciliationError(null)
    }

    return true
  }

  async function runCartMutation(
    context: string,
    operation: PendingCartMutation,
    retry = false,
  ): Promise<boolean> {
    const scope = getPendingCartMutationScope(operation.context)

    if (!scope) {
      throw new Error(t('Неможливо безпечно зберегти операцію без авторизованого користувача'))
    }

    const persisted = toPersistedCartMutation(operation)
    const cartMutationProductNetUid = getCartMutationProductNetUid(operation.request, orderItems)
    const normalizedCartProductNetUid = cartMutationProductNetUid?.trim().toLowerCase() || ''
    const visibleProductNetUid = (
      hasSearchResults
      || activeProductNetUid?.trim().toLowerCase() === normalizedCartProductNetUid
    )
      ? cartMutationProductNetUid
      : null

    const completed = await withSalesPendingMutationLock(scope, operation.operationId, persisted, async (lease) => {
      if (!isPersistedWizardCartMutation(lease.entry.payload)) {
        markSalesPendingMutationCorrupt(scope, lease.operationId, 'Durable wizard cart payload failed schema validation')
      }

      assertWizardSplitRecoveryOperationFence(lease.operationId)

      let submitted = lease.entry.phase !== 'prepared'
      const durableOperation = hydrateCartMutation(
        lease.entry.payload,
        () => {
          if (markWizardSplitExtractionSubmitted(lease.operationId)) {
            submitted = true
          }

          markSalesPendingMutationSubmitted(lease)
          submitted = true
        },
      )
      pendingMutationRef.current = durableOperation

      try {
        const result = retry
          ? await retryWizardMutation(durableOperation, getFreshCartForOperation)
          : await attemptPersistentSalesCartMutation(durableOperation, getFreshCartForOperation)

        return await handleCartMutationResult(durableOperation, context, lease, result)
      } catch (error) {
        if (submitted) {
          try {
            markWizardSplitExtractionUnknown(lease.operationId)
          } finally {
            markSalesPendingMutationUnknown(lease)
          }
        }

        throw error
      }
    })

    if (completed && visibleProductNetUid && isCurrentAvailabilityContext(context)) {
      await refreshVisibleProductAvailability(context, visibleProductNetUid)
    }

    return completed
  }

  function createCartMutation(
    context: string,
    options: {
      expectation: WizardCartMutationExpectation
      fallbackMessage: string
      localCommit?: WizardCartLocalCommit
      operationId?: string
      request: WizardCartMutationRequest
    },
  ): PendingCartMutation {
    const operationId = options.operationId ?? createWizardOperationId()

    const persisted = createPersistedWizardCartMutation({
      context,
      expectation: options.expectation,
      fallbackMessage: options.fallbackMessage,
      localCommit: options.localCommit ?? { kind: 'none' },
      operationId,
      request: options.request,
    })

    return hydrateCartMutation(persisted)
  }

  async function retryPendingCartMutation() {
    const operation = pendingMutationRef.current

    if (!operation || operation.context !== mutationContextRef.current) {
      return
    }

    const context = beginBusy({ allowPendingMutation: true })

    if (!context) {
      return
    }

    try {
      const completed = await runCartMutation(context, operation, true)

      if (completed && isCurrentMutationContext(context)) {
        clearProductPricingCache()
        notifications.show({ color: 'green', message: t('Операцію підтверджено, кошик оновлено') })
      }
    } catch (mutationError) {
      if (isCurrentMutationContext(context)) {
        setPendingMutationError(getRequestErrorMessage(mutationError, operation.fallbackMessage))
        notifications.show({ color: 'red', message: getRequestErrorMessage(mutationError, operation.fallbackMessage) })
      }
    } finally {
      endBusy(context)
    }
  }

  async function retryCartReconciliation() {
    if (busyRef.current) {
      return
    }

    const context = mutationContextRef.current
    busyRef.current = true
    activeMutationContextRef.current = context
    onBusyChange?.(true)
    setBusy(true)

    try {
      const freshSale = await onCartChanged()

      if (!isCurrentMutationContext(context)) {
        return
      }

      if (!freshSale) {
        throw new Error(t('Сервер не повернув оновлений кошик'))
      }

      reconciliationErrorRef.current = null
      reconciliationContextRef.current = null
      setReconciliationError(null)
      notifications.show({ color: 'green', message: t('Кошик оновлено') })
    } catch (reconcileError) {
      if (isCurrentMutationContext(context)) {
        const message = getRequestErrorMessage(reconcileError, t('Не вдалося оновити кошик'))
        reconciliationErrorRef.current = message
        reconciliationContextRef.current = context
        setReconciliationError(message)
        notifications.show({ color: 'red', message })
      }
    } finally {
      endBusy(context)
    }
  }

  return {
    beginBusy,
    busy,
    createCartMutation,
    currentReconciliationError,
    endBusy,
    isCurrentAvailabilityContext,
    isCurrentMutationContext,
    pendingMutationError,
    persistPendingCartMutation,
    retryCartReconciliation,
    retryPendingCartMutation,
    runCartMutation,
    setPendingMutationError,
  }
}

function getCartMutationProductNetUid(
  request: WizardCartMutationRequest,
  orderItems: SalesUkraineOrderItem[],
): string | null {
  const requestedOrderItemNetUid = request.kind === 'delete'
    ? request.orderItemNetId.trim().toLowerCase()
    : null
  const product = request.kind === 'delete'
    ? orderItems.find((item) => item.NetUid?.trim().toLowerCase() === requestedOrderItemNetUid)?.Product
    : request.orderItem.Product
  const productNetUid = product?.NetUid?.trim()

  return productNetUid || null
}

function getRequestErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}
