import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import {
  getSalesPendingMutationUserKey,
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
} from './pendingSalesMutationRegistry'
import type { SalesUkraineOrderItem, SalesUkraineSale } from './types'
import {
  createPersistedWizardCartMutation,
  executeWizardCartMutationRequest,
  isPersistedWizardCartMutation,
  type PersistedWizardCartMutation,
  type WizardCartMutationRequest,
} from './components/new-sale-wizard/wizardCartMutation'
import {
  attemptWizardMutation,
  createWizardOperationId,
  inspectWizardCartMutation,
  retryWizardMutation,
  type WizardCartMutationExpectation,
  type WizardMutationAttemptResult,
  type WizardMutationOperation,
} from './components/new-sale-wizard/wizardMutationOperation'

type RuntimeCartMutation = PersistedWizardCartMutation & WizardMutationOperation<SalesUkraineSale>

type SuccessfulWizardMutationStatus = Extract<
  WizardMutationAttemptResult<unknown>['status'],
  'acknowledged' | 'committed-after-reconcile'
>

export function createAddOrUpdateSalesCartMutation({
  clientAgreementNetId,
  orderItem,
  orderItems,
  saleNetId,
}: {
  clientAgreementNetId: string
  orderItem: SalesUkraineOrderItem
  orderItems: SalesUkraineOrderItem[]
  saleNetId: string
}): {
  expectation: WizardCartMutationExpectation
  request: WizardCartMutationRequest
} {
  const productNetUid = normalizeNetUid(orderItem.Product?.NetUid)
  const matchingRows = productNetUid
    ? orderItems.filter((candidate) => (
        !candidate.Deleted && hasSameSalesCartRowIdentity(candidate, orderItem)
      ))
    : []
  const existing = matchingRows.length === 1 ? matchingRows[0] : undefined
  const request: WizardCartMutationRequest = {
    clientAgreementNetId,
    kind: 'add',
    orderItem,
    saleNetId,
  }

  if (!existing) {
    return {
      expectation: { kind: 'operation-marker' },
      request,
    }
  }

  const rowNetUid = normalizeNetUid(existing.NetUid)

  if (!rowNetUid) {
    return {
      expectation: { kind: 'operation-marker' },
      request,
    }
  }

  const beforeQty = getFiniteQty(existing.Qty)
  const afterQty = beforeQty + getFiniteQty(orderItem.Qty)

  return {
    expectation: {
      afterQty,
      beforeQty,
      kind: 'row-quantity',
      rowNetUid: existing.NetUid as string,
    },
    request,
  }
}

export async function attemptPersistentSalesCartMutation<TSnapshot>(
  operation: WizardMutationOperation<TSnapshot>,
  reconcile: () => Promise<TSnapshot>,
): Promise<WizardMutationAttemptResult<TSnapshot>> {
  try {
    return await attemptWizardMutation(operation, reconcile)
  } catch (mutationError) {
    return { mutationError, status: 'definitive-failure' }
  }
}

export async function finalizeSuccessfulPersistentCartMutation(
  status: SuccessfulWizardMutationStatus,
  {
    clear,
    finish,
    reconcileAcknowledged,
  }: {
    clear: () => void
    finish: () => void
    reconcileAcknowledged: () => Promise<boolean>
  },
): Promise<boolean> {
  finish()

  if (status === 'acknowledged' && !(await reconcileAcknowledged())) {
    return false
  }

  clear()

  return true
}

export function usePersistentSalesCartMutation({
  context,
  onCommitted,
  reconcile,
}: {
  context: string
  onCommitted?: (sale: SalesUkraineSale) => void
  reconcile: () => Promise<SalesUkraineSale | null>
}) {
  const { session } = useAuth()
  const userKey = getSalesPendingMutationUserKey(session)
  const pendingRef = useRef<RuntimeCartMutation | null>(null)
  const mountedRef = useRef(false)
  const contextRef = useRef(context)
  const reconcileRef = useRef(reconcile)
  const onCommittedRef = useRef(onCommitted)
  const [pendingError, setPendingError] = useState<string | null>(null)
  const [storageRevision, setStorageRevision] = useState(0)
  const scope = useMemo<SalesPendingMutationScope | null>(() => (
    userKey && context ? { context, kind: 'cart', userKey } : null
  ), [context, userKey])

  useEffect(() => subscribeSalesPendingMutations(({ external }) => {
    if (external) {
      setStorageRevision((revision) => revision + 1)
    }
  }), [])

  useLayoutEffect(() => {
    reconcileRef.current = reconcile
    onCommittedRef.current = onCommitted
  })

  useLayoutEffect(() => {
    let cancelled = false
    mountedRef.current = true
    contextRef.current = context
    try {
      synchronizeSalesPendingMutationUser(userKey)
      const stored = scope
        ? loadSalesPendingMutation<PersistedWizardCartMutation>(scope)
        : null

      if (stored) {
        if (
          !stored.resumable ||
          !isPersistedWizardCartMutation(stored.payload) ||
          stored.payload.operationId !== stored.operationId ||
          stored.payload.context !== context
        ) {
          markSalesPendingMutationCorrupt(
            scope as SalesPendingMutationScope,
            stored.operationId,
            'Persisted cart mutation payload does not match its durable scope',
          )
        }

        pendingRef.current = hydrate(stored.payload)
        queueMicrotask(() => {
          if (!cancelled && mountedRef.current && contextRef.current === context) {
            setPendingError('Попередня операція не підтверджена. Повторіть дію для звірки тим самим ключем')
          }
        })

        return () => {
          cancelled = true
          mountedRef.current = false
        }
      }

      pendingRef.current = null
      queueMicrotask(() => {
        if (!cancelled && mountedRef.current && contextRef.current === context) {
          setPendingError(null)
        }
      })

    } catch (error) {
      pendingRef.current = null
      queueMicrotask(() => {
        if (!cancelled && mountedRef.current && contextRef.current === context) {
          setPendingError(toMessage(error, 'Журнал операції недоступний; нові зміни заблоковано'))
        }
      })
    }

    return () => {
      cancelled = true
      mountedRef.current = false
    }
  }, [context, scope, storageRevision, userKey])

  const release = useCallback((operation: RuntimeCartMutation) => {
    if (pendingRef.current === operation) {
      pendingRef.current = null

      if (mountedRef.current) {
        setPendingError(null)
      }
    }
  }, [])

  const handleResult = useCallback(async (
    operation: RuntimeCartMutation,
    lease: SalesPendingMutationLease<PersistedWizardCartMutation>,
    result: WizardMutationAttemptResult<SalesUkraineSale>,
  ): Promise<boolean> => {
    if (result.status === 'pending-retry' || result.status === 'definitive-failure') {
      markSalesPendingMutationUnknown(lease)

      if (mountedRef.current && contextRef.current === operation.context) {
        setPendingError(toMessage(result.mutationError, operation.fallbackMessage))
      }

      return false
    }

    let snapshot = result.status === 'committed-after-reconcile' ? result.snapshot : null

    if (!snapshot) {
      snapshot = await reconcileRef.current()
    }

    resolveSalesPendingMutation(lease, 'committed')
    release(operation)

    if (snapshot && mountedRef.current && contextRef.current === operation.context) {
      onCommittedRef.current?.(snapshot)
    }

    return mountedRef.current && contextRef.current === operation.context
  }, [release])

  const execute = useCallback(async (
    persisted: PersistedWizardCartMutation,
    retry: boolean,
  ): Promise<boolean> => {
    if (!scope) {
      throw new Error('Неможливо безпечно змінити кошик без авторизованого користувача')
    }

    return withSalesPendingMutationLock(
      scope,
      persisted.operationId,
      persisted,
      async (lease) => {
        if (!isPersistedWizardCartMutation(lease.entry.payload)) {
          markSalesPendingMutationCorrupt(scope, lease.operationId, 'Durable cart payload failed schema validation')
        }

        const operation = hydrate(lease.entry.payload, () => markSalesPendingMutationSubmitted(lease))
        pendingRef.current = operation
        const reconcileSale = async () => {
          const fresh = await reconcileRef.current()

          if (!fresh) {
            throw new Error('Сервер не повернув продаж для звірки')
          }

          return fresh
        }
        const result = retry
          ? await retryWizardMutation(operation, reconcileSale)
          : await attemptPersistentSalesCartMutation(operation, reconcileSale)

        return handleResult(operation, lease, result)
      },
    )
  }, [handleResult, scope])

  const retryPending = useCallback(async (): Promise<boolean> => {
    const pending = pendingRef.current

    if (!pending) {
      return true
    }

    return execute(toPersisted(pending), true)
  }, [execute])

  const run = useCallback(async (
    request: WizardCartMutationRequest,
    expectation: WizardCartMutationExpectation,
    fallbackMessage: string,
  ): Promise<boolean> => {
    if (!scope) {
      throw new Error('Неможливо безпечно змінити кошик без авторизованого користувача')
    }

    const pending = pendingRef.current

    if (pending) {
      if (!isSamePendingCartIntent(pending, request, expectation)) {
        throw new Error(
          'Є інша непідтверджена зміна кошика. Повторіть саме попередню дію для звірки її результату',
        )
      }

      return retryPending()
    }

    const operationId = createWizardOperationId()
    const persisted = createPersistedWizardCartMutation({
      context,
      expectation,
      fallbackMessage,
      localCommit: { kind: 'none' },
      operationId,
      request,
    })
    return execute(persisted, false)
  }, [context, execute, retryPending, scope])

  return { pendingError, retryPending, run }
}

function hydrate(
  persisted: PersistedWizardCartMutation,
  beforeMutate?: () => void,
): RuntimeCartMutation {
  return {
    ...persisted,
    inspect: (snapshot) => inspectWizardCartMutation(
      snapshot,
      persisted.operationId,
      persisted.expectation,
    ),
    mutate: (operationId) => {
      beforeMutate?.()
      return executeWizardCartMutationRequest(persisted.request, operationId)
    },
  }
}

function toPersisted(operation: RuntimeCartMutation): PersistedWizardCartMutation {
  return {
    context: operation.context,
    expectation: operation.expectation,
    fallbackMessage: operation.fallbackMessage,
    localCommit: operation.localCommit,
    operationId: operation.operationId,
    request: operation.request,
  }
}

function isSamePendingCartIntent(
  pending: RuntimeCartMutation,
  request: WizardCartMutationRequest,
  expectation: WizardCartMutationExpectation,
): boolean {
  const candidate = createPersistedWizardCartMutation({
    ...toPersisted(pending),
    expectation,
    request,
  })

  return (
    stableJson(candidate.request) === stableJson(pending.request) &&
    stableJson(candidate.expectation) === stableJson(pending.expectation)
  )
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)

    return `{${entries.join(',')}}`
  }

  return JSON.stringify(value) ?? 'undefined'
}

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}

function getFiniteQty(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function normalizeNetUid(value: string | null | undefined): string {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''

  return normalized === '00000000-0000-0000-0000-000000000000' ? '' : normalized
}

function hasSameSalesCartRowIdentity(
  left: SalesUkraineOrderItem,
  right: SalesUkraineOrderItem,
): boolean {
  const productNetUid = normalizeNetUid(left.Product?.NetUid)

  return Boolean(productNetUid)
    && productNetUid === normalizeNetUid(right.Product?.NetUid)
    && getAssignedSpecificationIdentity(left) === getAssignedSpecificationIdentity(right)
    && normalizeNetUid(left.SourceOrderItemNetUid) === normalizeNetUid(right.SourceOrderItemNetUid)
    && Boolean(left.IsFromReSale) === Boolean(right.IsFromReSale)
    && getFiniteQty(left.Discount) === getFiniteQty(right.Discount)
    && getFiniteQty(left.OneTimeDiscount) === getFiniteQty(right.OneTimeDiscount)
    && (left.OneTimeDiscountComment ?? '') === (right.OneTimeDiscountComment ?? '')
    && (left.Comment ?? '') === (right.Comment ?? '')
    && getFiniteQty(left.PricePerItem) === getFiniteQty(right.PricePerItem)
}

function getAssignedSpecificationIdentity(item: SalesUkraineOrderItem): string {
  const specification = item.AssignedSpecification

  if (!specification) {
    return ''
  }

  return [
    normalizeNetUid(specification.NetUid),
    typeof specification.Id === 'number' && specification.Id > 0 ? String(specification.Id) : '',
    specification.SpecificationCode?.trim() ?? '',
  ].join('|')
}
