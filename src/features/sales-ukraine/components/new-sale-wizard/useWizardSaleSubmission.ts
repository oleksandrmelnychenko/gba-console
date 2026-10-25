import { EMPTY_WIZARD_CART_ITEMS } from './useWizardCartItems'
import { notifications } from '@mantine/notifications'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { useAuth } from '../../../auth/useAuth'
import {
  convertVatSaleAndGetPaymentDocument,
  createSale,
  createSalesUkraineMergedSale,
  createSalesUkraineSaleFromData,
  createSalesUkraineVatSaleAndGetPaymentDocument,
  updateMergedSale,
  updateSaleFromData,
  type SaleSubmitResult,
} from '../../api/salesUkraineApi'
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
  type SalesPendingMutationLease,
  type SalesPendingMutationScope,
} from '../../pendingSalesMutationRegistry'
import {
  SALE_FILE_MUTATION_SURFACES,
  advanceSaleFileMutationSession,
  createSaleFileMutationSubmission,
  getLegacySaleFileMutationContext,
  getSaleFileMutationContext,
  restoreSaleFileMutationSubmission,
  resumeSaleFileMutationSubmission,
  type SaleFileMutationIntent,
  type SaleFileMutationKind,
  type SaleFileMutationSubmission,
} from '../../saleFileMutation'
import { getSaleReviewIssues, type SaleReviewIssueCode } from '../../saleReviewGuards'
import { getSalesTtnFileValidationError } from '../../salesPayloadGuards'
import type { SaleDocumentResult, SalesUkraineSale } from '../../types'
import {
  getSaleFileMutationOperationIdentity,
  isPersistedSaleFileMutationRecord,
  persistSaleFileMutationRecord,
  type PersistedSaleFileMutationRecord,
} from '../../usePersistentSaleFileMutation'
import {
  clearWizardMergedSale,
  clearWizardSplitOrderItems,
  confirmWizardSplitFinalMutationCommitted,
  getWizardSplitRecovery,
  isSelfCheckout,
  markWizardSplitFinalMutationSubmitted,
  markWizardSplitFinalMutationUnknown,
  rejectWizardSplitFinalMutation,
  stageWizardSplitFinalMutation,
  useWizardMergedSale,
  useWizardSplitOrderItems,
  type NewSaleReviewValue,
} from './newSaleWizardState'
import { createWizardAsyncGenerationGuard } from './wizardAsyncGeneration'
import {
  advanceWizardCreateSaleSession,
  createWizardCreateSaleSubmission,
  isWizardCreateSaleSubmission,
  type WizardCreateSaleSubmission,
} from './wizardCreateSaleSubmit'
import { createWizardEnterLatch } from './wizardEnterLatch'
import {
  advanceWizardMergedSaleSession,
  buildWizardMergedOrderItems,
  createWizardMergedSaleSubmission,
  isWizardMergedSaleSubmission,
  type WizardMergedSaleSubmission,
} from './wizardMergedSubmit'
import { useWizardRetailPaymentStatus } from './useWizardRetailPaymentStatus'
import { buildWizardSplitSale } from './wizardSplitSale'

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'
const LOCAL_ORDER_SOURCE = 1
const SALE_REVIEW_ISSUE_MESSAGES: Record<SaleReviewIssueCode, string> = {
  cashOnDeliveryAmount: 'Вкажіть коректну суму наложеного платежу',
  ownTtnNumber: 'Вкажіть номер власної ТТН',
  recipient: 'Не вибраний одержувач',
  recipientPhone: 'Вкажіть мобільний телефон одержувача',
  retailPaymentAmount: 'Замовлення не можна відвантажити без передплати',
  retailPaymentConfirmation: 'Оплату інтернет-магазину ще не підтверджено менеджером',
  retailPaymentStatus: 'Не вдалося перевірити оплату роздрібного клієнта',
  transporter: 'Не вибраний перевізник',
}

type FinalCreateSaleFlow = 'merged-split' | 'ordinary-split'

type PendingFinalCreateSale = {
  flow: FinalCreateSaleFlow
  submission: WizardCreateSaleSubmission
}

type PendingFinalMergedSale = {
  submission: WizardMergedSaleSubmission
}

type FinalFileMutationMode = SaleFileMutationIntent

type PendingFinalFileMutation = {
  mode: FinalFileMutationMode
  scope: SalesPendingMutationScope
  submission: SaleFileMutationSubmission
}

type PersistedFinalCreateSale = {
  flow: FinalCreateSaleFlow
  submission: WizardCreateSaleSubmission
}

type BlockedFinalFileMutation = {
  canResume: boolean
  mode: FinalFileMutationMode | null
  payload: PersistedSaleFileMutationRecord
  scope: SalesPendingMutationScope
}

export type WizardSaleSubmissionOptions = {
  canSubmit: boolean
  canConvertMergedToBill: boolean
  clientNetId: string | null
  sale: SalesUkraineSale | null
  value: NewSaleReviewValue
  submitDeniedReason: string
  submitFlow: 'create' | 'edit'
  onBusyChange?: (busy: boolean) => void
  onClose?: () => void
  onCreated?: () => void
  onSaved?: (sale: SalesUkraineSale | null) => void | Promise<void>
  onMergedSubmitted?: () => void
  onVatDocuments?: (result: SaleDocumentResult) => void
}

export function useWizardSaleSubmission({
  canSubmit,
  canConvertMergedToBill,
  clientNetId,
  sale,
  value,
  submitDeniedReason,
  submitFlow,
  onBusyChange,
  onClose,
  onCreated,
  onSaved,
  onMergedSubmitted,
  onVatDocuments,
}: WizardSaleSubmissionOptions) {
  const { t } = useI18n()
  const { session } = useAuth()
  const [finalSubmitOutcomePending, setFinalSubmitOutcomePending] = useState(false)
  const [mutationStorageRevision, setMutationStorageRevision] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [saving, setSaving] = useState(false)
  const busyRef = useRef(false)
  const [enterLatch] = useState(createWizardEnterLatch)
  const createSaleSubmissionRef = useRef<PendingFinalCreateSale | null>(null)
  const mergedSaleSubmissionRef = useRef<PendingFinalMergedSale | null>(null)
  const fileMutationSubmissionRef = useRef<PendingFinalFileMutation | null>(null)
  const blockedFileMutationRef = useRef<BlockedFinalFileMutation | null>(null)
  const [blockedFileMutation, setBlockedFileMutation] = useState<BlockedFinalFileMutation | null>(null)
  const [submitGuard] = useState(createWizardAsyncGenerationGuard)
  const mountedRef = useRef(false)
  const splitItems = useWizardSplitOrderItems()
  const mergedSale = useWizardMergedSale()
  const reviewItems = splitItems.length > 0 ? splitItems : mergedSale?.orderItems ?? sale?.Order?.OrderItems ?? EMPTY_WIZARD_CART_ITEMS
  const isMergedMode = Boolean(mergedSale)
  const mergedConversionDenied = submitFlow === 'edit' && isMergedMode && !canConvertMergedToBill
  const submitPermissionDenied = !canSubmit || mergedConversionDenied
  const effectiveSubmitDeniedReason = mergedConversionDenied
    ? t('Недостатньо прав для перетворення обʼєднаного продажу на рахунок')
    : submitDeniedReason
  const submitSaleFromData = submitFlow === 'create'
    ? createSalesUkraineSaleFromData
    : updateSaleFromData
  const submitMergedSale = submitFlow === 'create'
    ? createSalesUkraineMergedSale
    : updateMergedSale
  const submitVatSale = submitFlow === 'create'
    ? createSalesUkraineVatSaleAndGetPaymentDocument
    : convertVatSaleAndGetPaymentDocument
  const retailSale = mergedSale?.unionSale ?? sale
  const retailStatus = useWizardRetailPaymentStatus(retailSale)
  const pendingMutationUserKey = getSalesPendingMutationUserKey(session)
  const pendingMutationContext = getFinalMutationContext(clientNetId, sale)
  const pendingFileMutationContext = getSaleFileMutationContext(
    sale,
    SALE_FILE_MUTATION_SURFACES.wizard,
  )
  const legacyPendingFileMutationContext = getLegacySaleFileMutationContext(sale)
  const getPendingMutationScope = useCallback((
    kind: 'create-sale' | 'merged-sale' | SaleFileMutationKind,
  ): SalesPendingMutationScope | null => {
    const context = kind === 'sale-update-file' || kind === 'sale-vat-document'
      ? pendingFileMutationContext
      : pendingMutationContext

    return pendingMutationUserKey && context
      ? { context, kind, userKey: pendingMutationUserKey }
      : null
  }, [pendingFileMutationContext, pendingMutationContext, pendingMutationUserKey])
  const getLegacyFileMutationScope = useCallback((
    kind: SaleFileMutationKind,
  ): SalesPendingMutationScope | null => (
    pendingMutationUserKey && legacyPendingFileMutationContext
      ? { context: legacyPendingFileMutationContext, kind, userKey: pendingMutationUserKey }
      : null
  ), [legacyPendingFileMutationContext, pendingMutationUserKey])
  useLayoutEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      submitGuard.invalidate()
    }
  }, [submitGuard])

  useEffect(() => subscribeSalesPendingMutations(({ external }) => {
    if (external) {
      setMutationStorageRevision((revision) => revision + 1)
    }
  }), [])

  useLayoutEffect(() => {
    let cancelled = false
    const scheduleRestoredState = (
      pending: boolean,
      blocked: BlockedFinalFileMutation | null = null,
    ) => {
      queueMicrotask(() => {
        if (!cancelled && mountedRef.current) {
          setBlockedFileMutation(blocked)
          setFinalSubmitOutcomePending(pending)
        }
      })
    }

    submitGuard.invalidate()
    createSaleSubmissionRef.current = null
    mergedSaleSubmissionRef.current = null
    fileMutationSubmissionRef.current = null
    blockedFileMutationRef.current = null

    let restoredPending = false
    let restoredBlocked: BlockedFinalFileMutation | null = null

    try {
      synchronizeSalesPendingMutationUser(pendingMutationUserKey)

      if (pendingMutationUserKey && (pendingMutationContext || pendingFileMutationContext)) {
      const createScope = getPendingMutationScope('create-sale')
      const createEntry = createScope
        ? loadSalesPendingMutation<PersistedFinalCreateSale>(createScope)
        : null

      if (
        createEntry &&
        isPersistedFinalCreateSale(createEntry.payload) &&
        createEntry.payload.submission.operationId === createEntry.operationId
      ) {
        createSaleSubmissionRef.current = createEntry.payload
        restoredPending = true
      } else {
        if (createEntry && createScope) {
          markSalesPendingMutationCorrupt(
            createScope,
            createEntry.operationId,
            'Persisted create-sale payload does not match its durable scope',
          )
        }

        const mergedScope = getPendingMutationScope('merged-sale')
        const mergedEntry = mergedScope
          ? loadSalesPendingMutation<WizardMergedSaleSubmission>(mergedScope)
          : null

        if (
          mergedEntry &&
          isWizardMergedSaleSubmission(mergedEntry.payload) &&
          mergedEntry.payload.operationId === mergedEntry.operationId
        ) {
          mergedSaleSubmissionRef.current = { submission: mergedEntry.payload }
          restoredPending = true
        } else {
          if (mergedEntry && mergedScope) {
            markSalesPendingMutationCorrupt(
              mergedScope,
              mergedEntry.operationId,
              'Persisted merged-sale payload does not match its durable scope',
            )
          }

          fileKinds: for (const kind of ['sale-update-file', 'sale-vat-document'] as const) {
            const candidates = [
              { legacy: false, scope: getPendingMutationScope(kind) },
              { legacy: true, scope: getLegacyFileMutationScope(kind) },
            ]

            for (const candidate of candidates) {
              const { scope } = candidate
              const entry = scope
                ? loadSalesPendingMutation<PersistedSaleFileMutationRecord>(scope)
                : null

              if (!scope || !entry) {
                continue
              }

              if (
                !isPersistedSaleFileMutationRecord(entry.payload) ||
                entry.payload.kind !== kind ||
                entry.payload.operationId !== entry.operationId
              ) {
                markSalesPendingMutationCorrupt(
                  scope,
                  entry.operationId,
                  'Persisted wizard file payload does not match its durable scope',
                )
              }

              const mode = getWizardSaleFileMutationIntent(entry.payload, candidate.legacy)
              const restored = mode ? restoreSaleFileMutationSubmission(entry.payload) : null
              restoredPending = true

              if (mode && restored) {
                fileMutationSubmissionRef.current = { mode, scope, submission: restored }
              } else {
                const blockedEntry: BlockedFinalFileMutation = {
                  canResume: mode !== null,
                  mode,
                  payload: entry.payload,
                  scope,
                }
                blockedFileMutationRef.current = blockedEntry
                restoredBlocked = blockedEntry
              }

              break fileKinds
            }
          }
        }
      }
      }
    } catch (storageError) {
      restoredPending = true
      queueMicrotask(() => {
        if (!cancelled && mountedRef.current) {
          notifications.show({
            autoClose: false,
            color: 'red',
            message: storageError instanceof Error
              ? storageError.message
              : t('Журнал операції недоступний; нові запити заблоковано'),
          })
        }
      })
    }

    scheduleRestoredState(restoredPending, restoredBlocked)

    return () => {
      cancelled = true
    }
  }, [
    getLegacyFileMutationScope,
    getPendingMutationScope,
    pendingFileMutationContext,
    pendingMutationContext,
    pendingMutationUserKey,
    mutationStorageRevision,
    submitGuard,
    t,
  ])

  useEffect(() => {
    onBusyChange?.(submitting || saving)

    return () => {
      onBusyChange?.(false)
    }
  }, [onBusyChange, saving, submitting])

  function buildPayload(mode: 'create' | 'save', current: SalesUkraineSale): SalesUkraineSale & { IsEdited?: boolean } {
    const selfCheckoutPayload = isSelfCheckout(value.transporter)
    const recipientId = selfCheckoutPayload ? null : getPositiveId(value.recipient?.Id)
    const addressId = selfCheckoutPayload ? null : getPositiveId(value.address?.Id)
    const payload: SalesUkraineSale & { IsEdited?: boolean } = {
      ...current,
      RegistrarStorageId: value.registrarStorageId ?? current.RegistrarStorageId,
      CashOnDeliveryAmount: selfCheckoutPayload ? 0 : Number(value.codAmount),
      Comment: value.comment,
      DeliveryRecipient: selfCheckoutPayload
        ? null
        : ({ ...(value.recipient ?? {}), ...(recipientId ? { Id: recipientId } : {}), MobilePhone: value.mobilePhone } as SalesUkraineSale['DeliveryRecipient']),
      DeliveryRecipientAddress: selfCheckoutPayload
        ? null
        : ({
            ...(value.address ?? {}),
            City: value.city,
            Department: value.department,
            ...(addressId ? { Id: addressId } : {}),
          } as SalesUkraineSale['DeliveryRecipientAddress']),
      DeliveryRecipientAddressId: addressId,
      DeliveryRecipientId: recipientId,
      IsCashOnDelivery: selfCheckoutPayload ? false : value.isCashOnDelivery,
      Transporter: value.transporter ?? current.Transporter,
    }

    payload.CustomersOwnTtn = value.hasOwnTtn
      ? { ...(current.CustomersOwnTtn ?? {}), Number: value.ttnNumber.trim() }
      : null
    payload.CustomersOwnTtnId = value.hasOwnTtn
      ? current.CustomersOwnTtnId
      : 0

    if (mode === 'create') {
      payload.BaseLifeCycleStatus = { Deleted: false, Id: 0, NetUid: EMPTY_GUID, SaleLifeCycleType: 1 }
      payload.BaseSalePaymentStatus = { Deleted: false, Id: 0, NetUid: EMPTY_GUID, SalePaymentStatusType: 0 }
      payload.IsPrintedPaymentInvoice = true
    } else {
      payload.IsEdited = true
    }

    return payload
  }

  function validateSelectedTtnFile(): boolean {
    const fileError = getSalesTtnFileValidationError(value.ttnFile)

    if (fileError) {
      notifications.show({ color: 'red', message: t(fileError) })

      return false
    }

    return true
  }

  function validateFinalPayload(payload: SalesUkraineSale, intent: 'submit' | 'save' = 'submit'): boolean {
    const savesPendingDraft = intent === 'save'
      && [0, 5].includes(Number(payload.BaseLifeCycleStatus?.SaleLifeCycleType))
      && !('SaleInvoiceDocument' in payload && payload.SaleInvoiceDocument != null)
    if (payload.Order?.OrderSource !== LOCAL_ORDER_SOURCE && !savesPendingDraft && (!payload.ChangedToInvoice || splitItems.length > 0 || isMergedMode) && (!Number.isSafeInteger(payload.RegistrarStorageId) || Number(payload.RegistrarStorageId) <= 0)) {
      notifications.show({ color: 'red', message: t('Оберіть склад документа') })
      return false
    }
    if (!validateSelectedTtnFile()) {
      return false
    }

    const issues = getSaleReviewIssues(payload, { retailPaymentStatus: retailStatus })
    const firstIssue = issues[0]

    if (firstIssue) {
      notifications.show({ color: 'red', message: t(SALE_REVIEW_ISSUE_MESSAGES[firstIssue]) })

      return false
    }

    return true
  }

  function completeMergedSubmit() {
    clearWizardSplitOrderItems()
    clearWizardMergedSale()
    onCreated?.()
    onMergedSubmitted?.()
  }

  function completeFinalCreateSale(flow: FinalCreateSaleFlow, result: SaleSubmitResult) {
    if (flow === 'merged-split') {
      completeMergedSubmit()
      notifications.show({ color: 'green', message: result.message || t('Рахунок створено') })

      return
    }

    clearWizardSplitOrderItems()
    notifications.show({ color: 'green', message: result.message || t('Продаж створено') })
    onCreated?.()
    onClose?.()
  }

  function stageFinalSplitMutation(
    scope: SalesPendingMutationScope,
    operationId: string,
    settlesSplit = false,
    lease?: SalesPendingMutationLease,
  ): boolean {
    const linkedToSplit = settlesSplit && Boolean(getWizardSplitRecovery())

    if (linkedToSplit) {
      stageWizardSplitFinalMutation({
        context: scope.context,
        flow: submitFlow,
        kind: scope.kind as 'create-sale' | 'sale-update-file' | 'sale-vat-document',
        operationId,
        ...(lease ? { fencingToken: lease.fencingToken, generation: lease.generation } : {}),
        userKey: scope.userKey,
      })
    }

    return linkedToSplit
  }

  function isSubmitAttemptCurrent(
    token: ReturnType<typeof submitGuard.begin>,
  ): boolean {
    return mountedRef.current && submitGuard.isCurrent(token, token.context)
  }

  async function runFinalCreateSale(
    flow: FinalCreateSaleFlow,
    payload?: SalesUkraineSale,
  ): Promise<SaleSubmitResult | null> {
    const pending = createSaleSubmissionRef.current

    if (pending && pending.flow !== flow) {
      throw new Error('Неможливо змінити тип створення, доки попередня операція не підтверджена')
    }

    if (!pending && !payload) {
      throw new Error('Відсутні дані для створення продажу')
    }

    const submission = pending?.submission ?? createWizardCreateSaleSubmission(payload as SalesUkraineSale)
    const scope = getPendingMutationScope('create-sale')

    if (!scope) {
      throw new Error('Неможливо безпечно створити продаж без авторизованого користувача')
    }

    const persisted: PersistedFinalCreateSale = { flow, submission }
    const token = submitGuard.begin(`${scope.context}:create-sale:${submission.operationId}`)
    const attempt = await withSalesPendingMutationLock(
      scope,
      submission.operationId,
      persisted,
      async (lease) => {
        const frozen = lease.entry.payload

        if (
          !isPersistedFinalCreateSale(frozen) ||
          frozen.flow !== flow ||
          frozen.submission.operationId !== lease.operationId
        ) {
          markSalesPendingMutationCorrupt(
            scope,
            lease.operationId,
            'Create-sale durable payload changed before submission',
          )
        }

        const linkedToSplit = stageFinalSplitMutation(
          scope,
          lease.operationId,
          true,
          lease,
        )
        markSalesPendingMutationSubmitted(lease)
        createSaleSubmissionRef.current = frozen

        if (linkedToSplit) {
          markWizardSplitFinalMutationSubmitted(lease.operationId, lease)
        }

        const result = await advanceWizardCreateSaleSession({
          createSale,
          submission: frozen.submission,
        })

        if (result.status === 'pending-reconciliation') {
          markSalesPendingMutationUnknown(lease)

          if (linkedToSplit) {
            markWizardSplitFinalMutationUnknown(lease.operationId, lease)
          }

          return result
        }

        if (result.status === 'definitive-failure') {
          if (linkedToSplit) {
            rejectWizardSplitFinalMutation(lease.operationId, lease)
          }

          resolveRejectedSalesPendingMutation(lease)
          return result
        }

        if (linkedToSplit) {
          confirmWizardSplitFinalMutationCommitted(lease.operationId, lease)
        }

        resolveSalesPendingMutation(lease, 'committed')

        return result
      },
    )

    if (!isSubmitAttemptCurrent(token)) {
      return null
    }

    if (attempt.status === 'pending-reconciliation') {
      createSaleSubmissionRef.current = { flow, submission: attempt.submission }
      setFinalSubmitOutcomePending(true)
      notifications.show({
        color: 'orange',
        message: `${getRequestErrorMessage(attempt.error, t('Сервер не підтвердив створення'))}. ${t('Повторіть перевірку результату')}`,
      })

      return null
    }

    if (attempt.status === 'definitive-failure') {
      createSaleSubmissionRef.current = null
      setFinalSubmitOutcomePending(false)
      notifications.show({
        color: 'red',
        message: getRequestErrorMessage(attempt.error, t('Сервер відхилив створення продажу')),
      })

      return null
    }

    createSaleSubmissionRef.current = null
    setFinalSubmitOutcomePending(false)

    return attempt.result
  }

  async function runFinalMergedSale(payload?: SalesUkraineSale): Promise<boolean> {
    const pending = mergedSaleSubmissionRef.current

    if (!pending && !payload) {
      throw new Error('Відсутні дані для обʼєднання продажу')
    }

    const submission = pending?.submission ?? createWizardMergedSaleSubmission(payload as SalesUkraineSale)
    const scope = getPendingMutationScope('merged-sale')

    if (!scope) {
      throw new Error('Неможливо безпечно обʼєднати продаж без авторизованого користувача')
    }

    const token = submitGuard.begin(`${scope.context}:merged-sale:${submission.operationId}`)
    const attempt = await withSalesPendingMutationLock(
      scope,
      submission.operationId,
      submission,
      async (lease) => {
        const frozen = lease.entry.payload

        if (
          !isWizardMergedSaleSubmission(frozen) ||
          frozen.operationId !== lease.operationId
        ) {
          markSalesPendingMutationCorrupt(
            scope,
            lease.operationId,
            'Merged-sale durable payload changed before submission',
          )
        }

        markSalesPendingMutationSubmitted(lease)
        mergedSaleSubmissionRef.current = { submission: frozen }
        const result = await advanceWizardMergedSaleSession({
          submission: frozen,
          updateMergedSale: submitMergedSale,
        })

        if (result.status === 'pending-reconciliation') {
          markSalesPendingMutationUnknown(lease)
          return result
        }

        if (result.status === 'definitive-failure') {
          resolveRejectedSalesPendingMutation(lease)
          return result
        }

        resolveSalesPendingMutation(lease, 'committed')
        return result
      },
    )

    if (!isSubmitAttemptCurrent(token)) {
      return false
    }

    if (attempt.status === 'pending-reconciliation') {
      mergedSaleSubmissionRef.current = { submission: attempt.submission }
      setFinalSubmitOutcomePending(true)
      notifications.show({
        color: 'orange',
        message: `${getRequestErrorMessage(attempt.error, t('Сервер не підтвердив обʼєднання'))}. ${t('Повторіть перевірку результату')}`,
      })

      return false
    }

    if (attempt.status === 'definitive-failure') {
      mergedSaleSubmissionRef.current = null
      setFinalSubmitOutcomePending(false)
      notifications.show({
        color: 'red',
        message: getRequestErrorMessage(attempt.error, t('Сервер відхилив обʼєднання продажу')),
      })

      return false
    }

    mergedSaleSubmissionRef.current = null
    setFinalSubmitOutcomePending(false)

    return true
  }

  async function runFinalFileMutation<TResult>(
    kind: SaleFileMutationKind,
    mode: FinalFileMutationMode,
    request: (
      currentSale: SalesUkraineSale,
      file: File | null,
      operation: { operationId: string },
    ) => Promise<TResult>,
    payload?: SalesUkraineSale,
    file?: File | null,
  ): Promise<TResult | null> {
    const blocked = blockedFileMutationRef.current
    let pending = fileMutationSubmissionRef.current
    let resumedBlockedFile = false

    if (blocked) {
      if (!blocked.canResume || blocked.mode === null) {
        throw new Error('Незавершена файлова операція належить іншому екрану і не може бути повторена в майстрі')
      }

      if (blocked.mode !== mode || blocked.payload.kind !== kind) {
        throw new Error('Спочатку завершіть перевірку попередньої файлової операції продажу')
      }

      if (!file) {
        throw new Error('Повторно оберіть той самий файл для безпечного повтору з тим самим ключем')
      }

      const resumed = await resumeSaleFileMutationSubmission(blocked.payload, file)
      pending = { mode: blocked.mode, scope: blocked.scope, submission: resumed }
      resumedBlockedFile = true
    }

    if (pending && (pending.mode !== mode || pending.submission.kind !== kind)) {
      throw new Error('Спочатку завершіть перевірку попередньої операції продажу')
    }

    if (!pending && !payload) {
      throw new Error('Відсутні дані для збереження продажу')
    }

    const submission = pending?.submission ?? await createSaleFileMutationSubmission(
      kind,
      payload as SalesUkraineSale,
      file ?? null,
    )
    const scope = pending?.scope ?? getPendingMutationScope(kind)

    if (!scope) {
      throw new Error('Неможливо безпечно зберегти продаж без авторизованого користувача')
    }

    const persisted = persistSaleFileMutationRecord(submission, {
      intent: mode,
      surface: SALE_FILE_MUTATION_SURFACES.wizard,
    })
    const stored = loadSalesPendingMutation<PersistedSaleFileMutationRecord>(scope)
    const durablePayload = stored?.operationId === submission.operationId
      ? stored.payload
      : persisted
    const legacyScope = getLegacyFileMutationScope(kind)
    const isLegacyScope = Boolean(
      legacyScope &&
      legacyScope.context === scope.context &&
      legacyScope.kind === scope.kind &&
      legacyScope.userKey === scope.userKey,
    )
    const settlesSplit = mode === 'submit' && Boolean(getWizardSplitRecovery())
    const token = submitGuard.begin(`${scope.context}:${kind}:${submission.operationId}`)
    const attempt = await withSalesPendingMutationLock(
      scope,
      submission.operationId,
      durablePayload,
      async (lease) => {
        const frozen = lease.entry.payload
        const frozenMode = isPersistedSaleFileMutationRecord(frozen)
          ? getWizardSaleFileMutationIntent(frozen, isLegacyScope)
          : null

        if (
          !isPersistedSaleFileMutationRecord(frozen) ||
          frozen.operationId !== lease.operationId ||
          frozen.kind !== kind ||
          frozenMode !== mode
        ) {
          markSalesPendingMutationCorrupt(
            scope,
            lease.operationId,
            'Sale-file durable payload changed before submission',
          )
        }

        if (
          submission.operationId !== frozen.operationId ||
          submission.kind !== frozen.kind
        ) {
          markSalesPendingMutationCorrupt(
            scope,
            lease.operationId,
            'Runtime file submission no longer matches durable operation',
          )
        }

        const linkedToSplit = stageFinalSplitMutation(
          scope,
          lease.operationId,
          settlesSplit,
          lease,
        )
        markSalesPendingMutationSubmitted(lease)
        fileMutationSubmissionRef.current = { mode, scope, submission }

        if (resumedBlockedFile) {
          blockedFileMutationRef.current = null
          setBlockedFileMutation(null)
        }

        if (linkedToSplit) {
          markWizardSplitFinalMutationSubmitted(lease.operationId, lease)
        }

        const result = await advanceSaleFileMutationSession({
          kind,
          request,
          submission,
        })

        if (result.status === 'pending-reconciliation') {
          markSalesPendingMutationUnknown(lease)

          if (linkedToSplit) {
            markWizardSplitFinalMutationUnknown(lease.operationId, lease)
          }

          return result
        }

        if (result.status === 'definitive-failure') {
          if (linkedToSplit) {
            rejectWizardSplitFinalMutation(lease.operationId, lease)
          }

          resolveRejectedSalesPendingMutation(lease)
          return result
        }

        if (linkedToSplit) {
          confirmWizardSplitFinalMutationCommitted(lease.operationId, lease)
        }

        resolveSalesPendingMutation(lease, 'committed')
        return result
      },
    )

    if (!isSubmitAttemptCurrent(token)) {
      return null
    }

    if (attempt.status === 'pending-reconciliation') {
      fileMutationSubmissionRef.current = { mode, scope, submission: attempt.submission }
      setFinalSubmitOutcomePending(true)
      notifications.show({
        color: 'orange',
        message: `${getRequestErrorMessage(attempt.error, t('Сервер не підтвердив збереження'))}. ${t('Повторіть перевірку результату')}`,
      })

      return null
    }

    if (attempt.status === 'definitive-failure') {
      fileMutationSubmissionRef.current = null
      blockedFileMutationRef.current = null
      setBlockedFileMutation(null)
      setFinalSubmitOutcomePending(false)
      notifications.show({
        color: 'red',
        message: getRequestErrorMessage(attempt.error, t('Сервер відхилив збереження продажу')),
      })

      return null
    }

    fileMutationSubmissionRef.current = null
    blockedFileMutationRef.current = null
    setBlockedFileMutation(null)
    setFinalSubmitOutcomePending(false)

    return attempt.result
  }

  async function submitSale() {
    try {
      if (!sale || busyRef.current) {
        return
      }

      if (submitPermissionDenied) {
        notifications.show({ color: 'red', message: effectiveSubmitDeniedReason })

        return
      }

      const pendingFinalCreateSale = createSaleSubmissionRef.current
      const pendingFinalMergedSale = mergedSaleSubmissionRef.current
      const pendingFinalFileMutation = fileMutationSubmissionRef.current
      const blockedFinalFileMutation = blockedFileMutationRef.current
      const pendingFinalFileKind = pendingFinalFileMutation?.submission.kind ?? blockedFinalFileMutation?.payload.kind
      const pendingFinalFileMode = pendingFinalFileMutation?.mode ?? blockedFinalFileMutation?.mode
      const hasPendingFinalSubmit = Boolean(
        pendingFinalCreateSale ||
        pendingFinalMergedSale ||
        pendingFinalFileMutation ||
        blockedFinalFileMutation,
      )

      if (blockedFinalFileMutation && !blockedFinalFileMutation.canResume) {
        notifications.show({
          color: 'orange',
          message: t('Незавершена файлова операція належить іншому екрану. Завершіть її там перед продовженням'),
        })

        return
      }

      if (hasPendingFinalSubmit && !validateSelectedTtnFile()) {
        return
      }

      if (!hasPendingFinalSubmit && retailSale?.RetailClient && retailStatus && String(retailStatus.Id ?? 0) !== '0' && (retailStatus.Amount ?? 0) <= 0) {
        notifications.show({
          autoClose: 990000,
          color: 'red',
          message: t('Замовлення не буде відвантажено (створено видаткову накладну) поки не буде здійснена оплата (передплата)'),
        })

        return
      }

      busyRef.current = true
      setSubmitting(true)

      try {
        if (pendingFinalCreateSale) {
          const result = await runFinalCreateSale(pendingFinalCreateSale.flow)

          if (result) {
            completeFinalCreateSale(pendingFinalCreateSale.flow, result)
          }

          return
        }

        if (pendingFinalMergedSale) {
          if (await runFinalMergedSale()) {
            completeMergedSubmit()
            notifications.show({ color: 'green', message: t('Рахунок створено') })
          }

          return
        }

        if (pendingFinalFileKind && pendingFinalFileMode) {
          const result = pendingFinalFileKind === 'sale-vat-document'
            ? await runFinalFileMutation(
                'sale-vat-document',
                pendingFinalFileMode,
                submitVatSale,
                undefined,
                value.ttnFile,
              )
            : await runFinalFileMutation(
                'sale-update-file',
                pendingFinalFileMode,
                pendingFinalFileMode === 'submit'
                  ? submitSaleFromData
                  : updateSaleFromData,
                undefined,
                value.ttnFile,
              )

          if (!result) {
            return
          }

          if (pendingFinalFileMode === 'save') {
            await onSaved?.((result as SaleSubmitResult).sale)
            notifications.show({ color: 'green', message: t('Збережено') })

            return
          }

          if (pendingFinalFileKind === 'sale-vat-document') {
            onVatDocuments?.(result as SaleDocumentResult)
          } else {
            notifications.show({
              color: 'green',
              message: (result as SaleSubmitResult).message || t('Продаж створено'),
            })
          }

          clearWizardSplitOrderItems()
          onCreated?.()
          onClose?.()

          return
        }

        const isSplitedSale = splitItems.length > 0

        if (isMergedMode) {
          if (isSplitedSale) {
            const mergedSplitPayload = buildPayload('create', buildWizardSplitSale(sale, splitItems))

            if (!validateFinalPayload(mergedSplitPayload)) {
              return
            }

            const result = await runFinalCreateSale('merged-split', mergedSplitPayload)

            if (result) {
              completeFinalCreateSale('merged-split', result)
            }
          } else {
            const payload = buildPayload('create', sale)
            payload.Order = {
              ...(sale.Order ?? {}),
              OrderItems: buildWizardMergedOrderItems(mergedSale?.orderItems ?? sale.Order?.OrderItems ?? []),
            }

            if (!validateFinalPayload(payload)) {
              return
            }

            if (await runFinalMergedSale(payload)) {
              completeMergedSubmit()
              notifications.show({ color: 'green', message: t('Рахунок створено') })
            }
          }

          return
        }

        const payload = buildPayload('create', isSplitedSale ? buildWizardSplitSale(sale, splitItems) : sale)

        if (!validateFinalPayload(payload)) {
          return
        }

        if (payload.IsVatSale) {
          const documentResult = await runFinalFileMutation(
            'sale-vat-document',
            'submit',
            submitVatSale,
            payload,
            value.ttnFile,
          )

          if (!documentResult) {
            return
          }

          onVatDocuments?.(documentResult)
        } else if (isSplitedSale) {
          const result = await runFinalCreateSale('ordinary-split', payload)

          if (!result) {
            return
          }

          completeFinalCreateSale('ordinary-split', result)

          return
        } else {
          const result = await runFinalFileMutation(
            'sale-update-file',
            'submit',
            submitSaleFromData,
            payload,
            value.ttnFile,
          )

          if (!result) {
            return
          }

          notifications.show({ color: 'green', message: result.message || t('Продаж створено') })
        }

        clearWizardSplitOrderItems()
        onCreated?.()
        onClose?.()
      } catch (submitError) {
        notifications.show({ color: 'red', message: getRequestErrorMessage(submitError, t('Не вдалося завершити продаж')) })
      } finally {
        busyRef.current = false

        if (mountedRef.current) {
          setSubmitting(false)
        }
      }
    } finally {
      enterLatch.release()
    }
  }

  async function saveSale(): Promise<boolean> {
    if (!sale || busyRef.current || isMergedMode) {
      return false
    }

    const payload = buildPayload('save', sale)

    if (!validateFinalPayload(payload, 'save')) {
      return false
    }

    busyRef.current = true
    setSaving(true)

    try {
      const result = await runFinalFileMutation(
        'sale-update-file',
        'save',
        updateSaleFromData,
        payload,
        value.ttnFile,
      )

      if (!result) {
        return false
      }

      await onSaved?.(result.sale)
      notifications.show({ color: 'green', message: result.message || t('Збережено') })

      return true
    } catch (saveError) {
      notifications.show({ color: 'red', message: getRequestErrorMessage(saveError, t('Не вдалося зберегти продаж')) })

      return false
    } finally {
      busyRef.current = false
      setSaving(false)
    }
  }

  function submitFromKeyboard() {
    if (enterLatch.tryAcquire()) {
      void submitSale()
    }
  }

  return {
    blockedFileMutation,
    effectiveSubmitDeniedReason,
    finalSubmitOutcomePending,
    isMergedMode,
    retailSale,
    reviewItems,
    saveSale,
    saving,
    splitItems,
    submitFromKeyboard,
    submitPermissionDenied,
    submitSale,
    submitting,
  }
}

function getWizardSaleFileMutationIntent(
  record: PersistedSaleFileMutationRecord,
  legacyContext: boolean,
): SaleFileMutationIntent | null {
  const identity = getSaleFileMutationOperationIdentity(record)

  if (identity) {
    return identity.surface === SALE_FILE_MUTATION_SURFACES.wizard ? identity.intent : null
  }

  if (
    legacyContext &&
    record.surface === undefined &&
    (record.intent === 'save' || record.intent === 'submit')
  ) {
    return record.intent
  }

  return null
}

function getRequestErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}

function getFinalMutationContext(
  clientNetId: string | null,
  sale: SalesUkraineSale | null,
): string {
  const client = normalizeMutationIdentity(clientNetId || sale?.ClientAgreement?.Client?.NetUid)
  const agreement = normalizeMutationIdentity(sale?.ClientAgreement?.NetUid)
  const saleNetUid = normalizeMutationIdentity(sale?.NetUid)

  return client || agreement || saleNetUid
    ? `wizard-final:${client}:${agreement}:${saleNetUid}`
    : ''
}

function isPersistedFinalCreateSale(value: unknown): value is PersistedFinalCreateSale {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const candidate = value as Partial<PersistedFinalCreateSale>

  return (
    (candidate.flow === 'merged-split' || candidate.flow === 'ordinary-split') &&
    isWizardCreateSaleSubmission(candidate.submission)
  )
}

function normalizeMutationIdentity(value: string | null | undefined): string {
  const normalized = value?.trim().toLowerCase() ?? ''

  return normalized === EMPTY_GUID ? '' : normalized
}

function getPositiveId(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}
