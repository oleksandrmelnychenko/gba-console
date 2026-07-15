import { ActionIcon, Alert, Box, Button, Checkbox, FileInput, Group, Text, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { CircleX, Copy, Upload } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAuth } from '../../../auth/useAuth'
import { useI18n } from '../../../../shared/i18n/useI18n'
import {
  convertVatSaleAndGetPaymentDocument,
  createSale,
  getRetailPaymentStatusBySaleId,
  getSaleTransporterTypes,
  getSaleTransportersByType,
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
  advanceSaleFileMutationSession,
  createSaleFileMutationSubmission,
  getLegacySaleFileMutationContext,
  getSaleFileMutationContext,
  resumeSaleFileMutationSubmission,
  restoreSaleFileMutationSubmission,
  SALE_FILE_MUTATION_SURFACES,
  type SaleFileMutationIntent,
  type SaleFileMutationKind,
  type SaleFileMutationSubmission,
} from '../../saleFileMutation'
import { getSaleLifecycleTypeKey } from '../../saleStatus'
import type { SaleDocumentResult, SalesUkraineRetailPaymentStatus, SalesUkraineSale, SalesUkraineTransporter } from '../../types'
import {
  getSaleFileMutationOperationIdentity,
  isPersistedSaleFileMutationRecord,
  persistSaleFileMutationRecord,
  type PersistedSaleFileMutationRecord,
} from '../../usePersistentSaleFileMutation'
import {
  getClientDeliveryRecipients,
  newDeliveryRecipient,
  newDeliveryRecipientAddress,
  type WizardDeliveryRecipient,
  type WizardDeliveryRecipientAddress,
} from './newSaleWizardApi'
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
import { useWizardKeyboard, useWizardKeyHandler } from './wizardKeyboard'
import { WizardReviewCombobox, type WizardReviewComboboxOption } from './WizardReviewCombobox'
import { WizardReviewConfirmModal } from './WizardReviewConfirmModal'
import {
  advanceWizardCreateSaleSession,
  createWizardCreateSaleSubmission,
  isWizardCreateSaleSubmission,
  type WizardCreateSaleSubmission,
} from './wizardCreateSaleSubmit'
import {
  advanceWizardMergedSaleSession,
  buildWizardMergedOrderItems,
  createWizardMergedSaleSubmission,
  isWizardMergedSaleSubmission,
  type WizardMergedSaleSubmission,
} from './wizardMergedSubmit'
import { buildWizardSplitSale } from './wizardSplitSale'
import { createWizardAsyncGenerationGuard } from './wizardAsyncGeneration'
import { createWizardEnterLatch } from './wizardEnterLatch'

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'
const SALE_LIFE_CYCLE_STATUS_NAMES: Record<number, string> = {
  0: 'Рахунок',
  1: 'Накладна',
  2: 'Накладна',
  3: 'Відправлено',
  4: 'Отримано',
  5: 'Очікування',
}
const reviewFieldClassNames = {
  input: 'new-sale-review-field__input',
  label: 'new-sale-review-field__label',
  root: 'new-sale-review-field',
}
const reviewCheckboxClassNames = {
  body: 'new-sale-review-checkbox__body',
  input: 'new-sale-review-checkbox__input',
  label: 'new-sale-review-checkbox__label',
  root: 'new-sale-review-checkbox',
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

export function NewSaleReviewStep({
  clientNetId,
  sale,
  value,
  onBusyChange,
  onChange,
  onClose,
  onCreated,
  onMergedSubmitted,
  onRegisterSubmit,
  onVatDocuments,
  withVatAccounting,
}: {
  clientNetId: string | null
  onBusyChange?: (busy: boolean) => void
  onChange: (patch: Partial<NewSaleReviewValue>) => void
  onClose?: () => void
  onCreated?: () => void
  onMergedSubmitted?: () => void
  onRegisterSubmit?: (submit: (() => Promise<void>) | null) => void
  onVatDocuments?: (result: SaleDocumentResult) => void
  sale: SalesUkraineSale | null
  value: NewSaleReviewValue
  withVatAccounting?: boolean
}) {
  const { t } = useI18n()
  const { session } = useAuth()
  const [transporters, setTransporters] = useState<SalesUkraineTransporter[]>([])
  const [recipients, setRecipients] = useState<WizardDeliveryRecipient[]>([])
  const [retailStatus, setRetailStatus] = useState<SalesUkraineRetailPaymentStatus | null>(null)
  const [confirmOpened, setConfirmOpened] = useState(false)
  const [finalSubmitOutcomePending, setFinalSubmitOutcomePending] = useState(false)
  const [mutationStorageRevision, setMutationStorageRevision] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [saving, setSaving] = useState(false)
  const submitRef = useRef<HTMLButtonElement>(null)
  const busyRef = useRef(false)
  const [enterLatch] = useState(createWizardEnterLatch)
  const transporterSeededRef = useRef(false)
  const recipientSeededRef = useRef(false)
  const flagsSeededRef = useRef(false)
  const createSaleSubmissionRef = useRef<PendingFinalCreateSale | null>(null)
  const mergedSaleSubmissionRef = useRef<PendingFinalMergedSale | null>(null)
  const fileMutationSubmissionRef = useRef<PendingFinalFileMutation | null>(null)
  const blockedFileMutationRef = useRef<BlockedFinalFileMutation | null>(null)
  const [blockedFileMutation, setBlockedFileMutation] = useState<BlockedFinalFileMutation | null>(null)
  const [submitGuard] = useState(createWizardAsyncGenerationGuard)
  const mountedRef = useRef(false)
  const splitItems = useWizardSplitOrderItems()
  const mergedSale = useWizardMergedSale()
  const isMergedMode = Boolean(mergedSale)
  const retailSale = mergedSale?.unionSale ?? sale
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
  const latestRef = useRef({ onChange, sale, value })

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
    latestRef.current = { onChange, sale, value }
  })

  const submitSaleRef = useRef<() => Promise<void>>(() => Promise.resolve())

  useEffect(() => {
    submitSaleRef.current = submitSale
  })

  useEffect(() => {
    if (!onRegisterSubmit) {
      return
    }

    onRegisterSubmit(() => submitSaleRef.current())

    return () => {
      onRegisterSubmit(null)
    }
  }, [onRegisterSubmit])

  useEffect(() => {
    onBusyChange?.(finalSubmitOutcomePending || submitting || saving)

    return () => {
      onBusyChange?.(false)
    }
  }, [finalSubmitOutcomePending, onBusyChange, saving, submitting])

  useWizardKeyboard(2)

  useWizardKeyHandler((event) => {
    if (event.hotkey === 'Escape') {
      if (finalSubmitOutcomePending) {
        notifications.show({ color: 'orange', message: t('Спочатку перевірте результат створення продажу') })

        return true
      }

      if (!confirmOpened) {
        setConfirmOpened(true)
      }

      return true
    }

    if (event.hotkey === 'Enter') {
      if (enterLatch.tryAcquire()) {
        void submitSale()
      }

      return true
    }

    return false
  })

  useEffect(() => {
    submitRef.current?.focus()
  }, [])

  useEffect(() => {
    const { onChange: change, value: current } = latestRef.current

    if (flagsSeededRef.current || !sale) {
      return
    }

    flagsSeededRef.current = true

    const patch: Partial<NewSaleReviewValue> = {}

    if (!current.hasOwnTtn && (sale.CustomersOwnTtnId ?? 0) > 0) {
      patch.hasOwnTtn = true
    }

    if (!current.ttnNumber && sale.CustomersOwnTtn?.Number) {
      patch.ttnNumber = sale.CustomersOwnTtn.Number
    }

    if (!current.isCashOnDelivery && sale.IsCashOnDelivery) {
      patch.isCashOnDelivery = true
    }

    if (current.codAmount === '' && typeof sale.CashOnDeliveryAmount === 'number' && sale.CashOnDeliveryAmount !== 0) {
      patch.codAmount = sale.CashOnDeliveryAmount
    }

    if (Object.keys(patch).length > 0) {
      change(patch)
    }
  }, [sale])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const types = await getSaleTransporterTypes()
        const firstType = types[0]

        if (!firstType?.NetUid) {
          if (!cancelled) {
            setTransporters([])
          }

          return
        }

        const next = await getSaleTransportersByType(firstType.NetUid)

        if (!cancelled) {
          setTransporters(next)
        }
      } catch {
        if (!cancelled) {
          setTransporters([])
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const { onChange: change, sale: currentSale, value: current } = latestRef.current

    if (transporterSeededRef.current || transporters.length === 0) {
      return
    }

    transporterSeededRef.current = true

    if (!current.transporter && currentSale?.Transporter?.NetUid) {
      const match = transporters.find((item) => item.NetUid === currentSale.Transporter?.NetUid)

      if (match) {
        change({ transporter: match })
      }
    }
  }, [transporters])

  useEffect(() => {
    if (!clientNetId) {
      return
    }

    let cancelled = false

    async function load(id: string) {
      try {
        const next = await getClientDeliveryRecipients(id)

        if (!cancelled) {
          setRecipients(next)
        }
      } catch {
        if (!cancelled) {
          setRecipients([])
        }
      }
    }

    void load(clientNetId)

    return () => {
      cancelled = true
    }
  }, [clientNetId])

  useEffect(() => {
    const { onChange: change, sale: currentSale, value: current } = latestRef.current

    if (recipientSeededRef.current || recipients.length === 0) {
      return
    }

    recipientSeededRef.current = true

    if (current.recipient) {
      return
    }

    const patch: Partial<NewSaleReviewValue> = {}
    const saleRecipient = currentSale?.DeliveryRecipient

    if (saleRecipient) {
      patch.comment = currentSale?.Comment || current.comment

      const match = recipients.find((item) => item.NetUid === saleRecipient.NetUid)

      if (match) {
        applyRecipientSelection(patch, match, currentSale?.DeliveryRecipientAddress?.NetUid)
      }
    } else if (recipients[0]) {
      applyRecipientSelection(patch, recipients[0], undefined)
    }

    if (Object.keys(patch).length > 0) {
      change(patch)
    }
  }, [recipients])

  useEffect(() => {
    const saleId = retailSale?.RetailClient ? retailSale.Id : undefined

    if (!saleId) {
      return
    }

    let cancelled = false

    async function load(id: number) {
      try {
        const next = await getRetailPaymentStatusBySaleId(id)

        if (!cancelled) {
          setRetailStatus(next)
        }
      } catch {
        if (!cancelled) {
          setRetailStatus(null)
        }
      }
    }

    void load(saleId)

    return () => {
      cancelled = true
    }
  }, [retailSale?.Id, retailSale?.RetailClient])

  const selfCheckout = isSelfCheckout(value.transporter)

  const transporterOptions: WizardReviewComboboxOption<SalesUkraineTransporter>[] = transporters.map((item, index) => ({
    entity: item,
    key: item.Id != null ? String(item.Id) : `transporter-${index}`,
    label: item.Name ? item.Name : '---',
  }))
  const transporterKey = value.transporter?.Id != null ? String(value.transporter.Id) : null

  const syntheticClientId = sale?.ClientAgreement?.Client?.Id
  // Once a real recipient is picked/created (e.g. typed-in new one), show the real list so it is
  // present among the options — otherwise the self-checkout synthetic placeholder hides it and the
  // field looks cleared after creating a recipient.
  const hasSelectedRecipient = (value.recipient?.Id ?? 0) > 0
  const recipientSource =
    selfCheckout && !hasSelectedRecipient && !recipients.some((item) => item.FullName === t('Не вибраний перевізник'))
      ? [{ FullName: '', ...(syntheticClientId ? { ClientId: syntheticClientId } : {}) } as WizardDeliveryRecipient]
      : recipients
  const recipientOptions: WizardReviewComboboxOption<WizardDeliveryRecipient>[] = recipientSource.map((item, index) => ({
    entity: item,
    key: item.Id != null ? String(item.Id) : `recipient-${index}`,
    label: item.FullName ? item.FullName : '---',
  }))
  const recipientKey = value.recipient ? (value.recipient.Id != null ? String(value.recipient.Id) : 'recipient-0') : null

  const recipientAddresses = value.recipient?.DeliveryRecipientAddresses ?? []
  const addressOptions: WizardReviewComboboxOption<WizardDeliveryRecipientAddress>[] = recipientAddresses.map(
    (item, index) => ({
      entity: item,
      key: item.Id != null ? String(item.Id) : `address-${index}`,
      label: item.Value ?? '',
    }),
  )
  const addressKey = value.address?.Id != null ? String(value.address.Id) : null

  const lifecycleKey = getSaleLifecycleTypeKey(sale?.BaseLifeCycleStatus?.SaleLifeCycleType)
  const documentTitle = sale
    ? `${withVatAccounting ? `(${t('ПДВ')}) ` : ''}${getSaleLifeCycleStatusName(sale)} ${sale.SaleNumber?.Value ?? ''}`.trim()
    : ''
  const primaryLabel = finalSubmitOutcomePending
    ? t('Перевірити результат')
    : isMergedMode
      ? t('Створити накладну')
      : sale
        ? sale.IsVatSale
          ? t('Завантажити рахунок на оплату')
          : lifecycleKey === '0'
            ? t('Створити накладну')
            : t('Оновити накладну')
        : t('Створити продаж')

  function selectTransporter(transporter: SalesUkraineTransporter) {
    onChange({ transporter })
  }

  function selectRecipient(recipient: WizardDeliveryRecipient) {
    const addresses = recipient.DeliveryRecipientAddresses ?? []

    onChange({
      address: addresses[0] ?? null,
      addressValue: '',
      isNewRecipient: false,
      recipient,
      recipientName: recipient.FullName || '',
    })
  }

  function selectAddress(address: WizardDeliveryRecipientAddress) {
    onChange({ address, addressValue: '' })
  }

  function clearAddress() {
    const empty = recipientAddresses.find((item) => item.Value === '')

    onChange({ address: empty ?? null, addressValue: '' })
  }

  async function createRecipient(fullName: string) {
    const clientId = syntheticClientId

    if (!clientId) {
      notifications.show({ color: 'red', message: t('Не вдалося визначити клієнта для отримувача') })

      return
    }

    try {
      const created = await newDeliveryRecipient({ ClientId: clientId, FullName: fullName })

      if (created && (created.Id ?? 0) > 0) {
        setRecipients((current) => [...current, created])
        onChange({ isNewRecipient: false, recipient: created, recipientName: created.FullName || '' })
      } else {
        notifications.show({ color: 'red', message: t('Не вдалося створити отримувача') })
      }
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося створити отримувача') })
    }
  }

  async function createAddress(input: string) {
    const recipient = value.recipient
    const recipientId = recipient?.Id

    if (!recipient || !recipientId || recipientId <= 0) {
      return
    }

    const addresses = recipient.DeliveryRecipientAddresses ?? []
    const duplicate = addresses.some((item) => (item.Value ?? '').toLowerCase() === input.toLowerCase())

    if (duplicate || input.length <= 3) {
      return
    }

    try {
      const created = await newDeliveryRecipientAddress({
        DeliveryRecipient: recipient,
        DeliveryRecipientId: recipientId,
        Value: input,
      })

      if (created && (created.Id ?? 0) > 0) {
        const updated = { ...recipient, DeliveryRecipientAddresses: [...addresses, created] }

        setRecipients((current) => current.map((item) => (item.Id === recipientId ? updated : item)))
        onChange({ address: created, addressValue: '', recipient: updated })
      } else {
        notifications.show({ color: 'red', message: t('Не вдалося створити адресу доставки') })
      }
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося створити адресу доставки') })
    }
  }

  function getCarrierValidationError(): string | null {
    if (!((value.transporter?.Id ?? 0) > 0)) {
      return 'Не вибраний перевізник'
    }

    if (!isSelfCheckout(value.transporter) && !((value.recipient?.Id ?? 0) > 0)) {
      return 'Не вибраний одержувач'
    }

    return null
  }

  function buildPayload(mode: 'create' | 'save', current: SalesUkraineSale): SalesUkraineSale & { IsEdited?: boolean } {
    const selfCheckoutPayload = isSelfCheckout(value.transporter)
    const recipientId = selfCheckoutPayload ? null : getPositiveId(value.recipient?.Id)
    const addressId = selfCheckoutPayload ? null : getPositiveId(value.address?.Id)
    const payload: SalesUkraineSale & { IsEdited?: boolean } = {
      ...current,
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

    payload.CustomersOwnTtn =
      current.CustomersOwnTtn || value.ttnNumber
        ? { ...(current.CustomersOwnTtn ?? {}), Number: value.ttnNumber }
        : current.CustomersOwnTtn ?? null

    if (mode === 'create') {
      payload.BaseLifeCycleStatus = { Deleted: false, Id: 0, NetUid: EMPTY_GUID, SaleLifeCycleType: 1 }
      payload.BaseSalePaymentStatus = { Deleted: false, Id: 0, NetUid: EMPTY_GUID, SalePaymentStatusType: 0 }
      payload.IsPrintedPaymentInvoice = true
    } else {
      payload.IsEdited = true
    }

    return payload
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
          updateMergedSale,
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

      const error = hasPendingFinalSubmit ? null : getCarrierValidationError()

      if (error) {
        notifications.show({ color: 'red', message: t(error) })

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
                convertVatSaleAndGetPaymentDocument,
                undefined,
                value.ttnFile,
              )
            : await runFinalFileMutation(
                'sale-update-file',
                pendingFinalFileMode,
                updateSaleFromData,
                undefined,
                value.ttnFile,
              )

          if (!result) {
            return
          }

          if (pendingFinalFileMode === 'save') {
            notifications.show({ color: 'green', message: t('Збережено') })
            onCreated?.()

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
          const result = await runFinalCreateSale(
            'merged-split',
            buildPayload('create', buildWizardSplitSale(sale, splitItems)),
          )

          if (result) {
            completeFinalCreateSale('merged-split', result)
          }
        } else {
          const payload = buildPayload('create', sale)
          payload.Order = {
            ...(sale.Order ?? {}),
            OrderItems: buildWizardMergedOrderItems(mergedSale?.orderItems ?? sale.Order?.OrderItems ?? []),
          }

          if (await runFinalMergedSale(payload)) {
            completeMergedSubmit()
            notifications.show({ color: 'green', message: t('Рахунок створено') })
          }
        }

        return
      }

      const payload = buildPayload('create', isSplitedSale ? buildWizardSplitSale(sale, splitItems) : sale)

        if (payload.IsVatSale) {
          const documentResult = await runFinalFileMutation(
            'sale-vat-document',
            'submit',
            convertVatSaleAndGetPaymentDocument,
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
            updateSaleFromData,
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

    const error = getCarrierValidationError()

    if (error) {
      notifications.show({ color: 'red', message: t(error) })

      return false
    }

    busyRef.current = true
    setSaving(true)

    try {
      const result = await runFinalFileMutation(
        'sale-update-file',
        'save',
        updateSaleFromData,
        buildPayload('save', sale),
        value.ttnFile,
      )

      if (!result) {
        return false
      }

      notifications.show({ color: 'green', message: result.message || t('Збережено') })
      onCreated?.()

      return true
    } catch (saveError) {
      notifications.show({ color: 'red', message: getRequestErrorMessage(saveError, t('Не вдалося зберегти продаж')) })

      return false
    } finally {
      busyRef.current = false
      setSaving(false)
    }
  }

  async function handleSave() {
    if (await saveSale()) {
      onClose?.()
    }
  }

  async function handleConfirmClose() {
    if (finalSubmitOutcomePending) {
      notifications.show({ color: 'orange', message: t('Спочатку перевірте результат створення продажу') })

      return
    }

    setConfirmOpened(false)

    if (await saveSale()) {
      onClose?.()
    }
  }

  function handleCancelClose() {
    setConfirmOpened(false)
    window.setTimeout(() => submitRef.current?.focus(), 0)
  }

  return (
    <Box className="new-sale-review-step app-form-sheet">
      {blockedFileMutation && (
        <Alert color="orange" mb="sm" title={t('Потрібна звірка операції')}>
          <Text size="sm">
            {blockedFileMutation.canResume
              ? t('Попередній запит із файлом міг завершитися на сервері. Повторно оберіть той самий файл: система звірить SHA-256 і повторить незмінний запит із тим самим ключем.')
              : t('Неможливо безпечно визначити дію попереднього запиту. Завершіть файлову операцію на початковому екрані або дочекайтеся завершення строку звірки.')}
          </Text>
          {blockedFileMutation.canResume ? (
            <Group align="flex-end" gap="sm" mt="sm">
              <FileInput
                aria-label={t('Повторно оберіть файл для звірки')}
                leftSection={<Upload size={16} />}
                placeholder={t('Завантажити')}
                value={value.ttnFile}
                onChange={(file) => onChange({ ttnFile: file })}
              />
              <Button
                disabled={!value.ttnFile}
                loading={submitting}
                size="xs"
                onClick={() => void submitSale()}
              >
                {t('Перевірити результат')}
              </Button>
            </Group>
          ) : null}
        </Alert>
      )}
      <Box className="new-sale-review-step__body">
        <Box className="new-sale-review-form app-form-sheet">
          <Box className="new-sale-review-layout">
            <Box className="new-sale-review-main">
              {documentTitle && (
                <Box className="new-sale-review-document-head">
                  <span className="new-sale-review-document-head__icon" aria-hidden="true">
                    <Copy size={17} strokeWidth={1.8} />
                  </span>
                  <Text className="new-sale-review-document-head__title" title={documentTitle}>
                    {documentTitle}
                  </Text>
                </Box>
              )}

              <Box className="new-sale-review-section">
                <Box className="new-sale-review-section__head">
                  <Text className="new-sale-review-section__title">{t('Доставка')}</Text>
                </Box>

                <Box className="new-sale-review-grid">
                  <WizardReviewCombobox
                    classNames={reviewFieldClassNames}
                    label={t('Перевізник')}
                    options={transporterOptions}
                    selectedKey={transporterKey}
                    tabIndex={-1}
                    onSelect={selectTransporter}
                  />

                  <WizardReviewCombobox
                    allowFreeForm
                    classNames={reviewFieldClassNames}
                    label={t('Одержувач')}
                    options={recipientOptions}
                    selectedKey={recipientKey}
                    onFreeText={(input) => void createRecipient(input)}
                    onSelect={selectRecipient}
                  />

                  {!selfCheckout && (
                    <>
                      <Box className="new-sale-review-field-span">
                        <Group className="new-sale-review-address-row" align="flex-end" gap={8} wrap="nowrap">
                          <Box className="new-sale-review-address-control">
                            <WizardReviewCombobox
                              allowFreeForm
                              classNames={reviewFieldClassNames}
                              label={t('Адреса')}
                              options={addressOptions}
                              selectedKey={addressKey}
                              onFreeText={(input) => void createAddress(input)}
                              onSelect={selectAddress}
                            />
                          </Box>
                          <ActionIcon
                            aria-label={t('Очистити адресу')}
                            className="new-sale-review-clear"
                            color="gray"
                            size="lg"
                            variant="subtle"
                            onClick={clearAddress}
                          >
                            <CircleX size={17} />
                          </ActionIcon>
                        </Group>
                      </Box>

                      <TextInput
                        classNames={reviewFieldClassNames}
                        label={t('Місто')}
                        value={value.city}
                        onChange={(event) => onChange({ city: event.currentTarget.value })}
                      />
                      <TextInput
                        classNames={reviewFieldClassNames}
                        label={t('Відділення')}
                        value={value.department}
                        onChange={(event) => onChange({ department: event.currentTarget.value })}
                      />
                    </>
                  )}

                  <TextInput
                    classNames={reviewFieldClassNames}
                    label={t('Мобільний телефон')}
                    value={value.mobilePhone}
                    onChange={(event) => onChange({ mobilePhone: event.currentTarget.value })}
                  />
                  <TextInput
                    classNames={reviewFieldClassNames}
                    label={t('Коментар')}
                    value={value.comment}
                    onChange={(event) => onChange({ comment: event.currentTarget.value === '' ? ' ' : event.currentTarget.value })}
                  />
                </Box>
              </Box>

              <Box className="new-sale-review-section">
                <Box className="new-sale-review-section__head">
                  <Text className="new-sale-review-section__title">{t('Оплата і документи')}</Text>
                </Box>

                <Box className="new-sale-review-options">
                  <Box className={`new-sale-review-option-row ${value.isCashOnDelivery ? 'is-active' : 'is-idle'}`}>
                    <Checkbox
                      checked={value.isCashOnDelivery}
                      classNames={reviewCheckboxClassNames}
                      label={t('Наложений платіж')}
                      onChange={() => onChange({ isCashOnDelivery: !value.isCashOnDelivery })}
                    />
                    {value.isCashOnDelivery ? (
                      <TextInput
                        classNames={reviewFieldClassNames}
                        label={t('Рекомендована покупцем')}
                        value={String(value.codAmount)}
                        onChange={(event) => onChange({ codAmount: event.currentTarget.value })}
                      />
                    ) : null}
                  </Box>

                  <Box className={`new-sale-review-option-row ${value.hasOwnTtn ? 'is-active' : 'is-idle'}`}>
                    <Checkbox
                      checked={value.hasOwnTtn}
                      classNames={reviewCheckboxClassNames}
                      label={t('Власне ТТН')}
                      onChange={() => onChange({ hasOwnTtn: !value.hasOwnTtn })}
                    />
                    {value.hasOwnTtn ? (
                      <TextInput
                        autoFocus
                        aria-label={t('Номер ТТН')}
                        classNames={reviewFieldClassNames}
                        label={t('Номер ТТН')}
                        value={value.ttnNumber}
                        onChange={(event) => onChange({ ttnNumber: event.currentTarget.value })}
                      />
                    ) : null}
                  </Box>

                  {value.hasOwnTtn && (
                    <Box className="new-sale-review-option-row is-upload">
                      <Box className="new-sale-review-option-spacer" />
                      <FileInput
                        classNames={reviewFieldClassNames}
                        label={t('Файл ТТН')}
                        leftSection={<Upload size={16} />}
                        placeholder={t('Завантажити')}
                        value={value.ttnFile}
                        onChange={(file) => {
                          if (file) {
                            onChange({ ttnFile: file })
                          }
                        }}
                      />
                    </Box>
                  )}

                  {(sale?.Id ?? 0) > 0 && sale?.CustomersOwnTtn?.TtnPDFPath ? (
                    <Group className="new-sale-review-field-span" justify="flex-start">
                      <Button
                        className="new-sale-review-link-button"
                        component="a"
                        href={sale.CustomersOwnTtn.TtnPDFPath}
                        rel="noopener noreferrer"
                        target="_blank"
                        variant="outline"
                      >
                        {t('Завантажити ТТН')}
                      </Button>
                    </Group>
                  ) : null}
                </Box>
              </Box>
            </Box>
          </Box>

          <Group className="new-sale-review-actions" gap="sm" justify="flex-end">
            {sale && !isMergedMode ? (
              <Button className="new-sale-review-actions__secondary" color="gray" disabled={finalSubmitOutcomePending} loading={saving} variant="light" onClick={() => void handleSave()}>
                {t('Зберегти')}
              </Button>
            ) : null}
            <Button
              ref={submitRef}
              className="new-sale-review-actions__primary"
              disabled={Boolean(blockedFileMutation && !blockedFileMutation.canResume)}
              loading={submitting}
              onClick={() => void submitSale()}
            >
              {primaryLabel}
            </Button>
          </Group>
        </Box>
      </Box>

      <WizardReviewConfirmModal opened={confirmOpened} onCancel={handleCancelClose} onConfirm={() => void handleConfirmClose()} />
    </Box>
  )
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

function applyRecipientSelection(
  patch: Partial<NewSaleReviewValue>,
  recipient: WizardDeliveryRecipient,
  preferredAddressNetUid: string | undefined,
) {
  patch.recipient = recipient
  patch.recipientName = recipient.FullName || ''
  patch.isNewRecipient = false
  patch.mobilePhone = recipient.MobilePhone || ''

  const addresses = recipient.DeliveryRecipientAddresses ?? []
  const preferred = preferredAddressNetUid ? addresses.find((item) => item.NetUid === preferredAddressNetUid) : undefined
  const address = preferred ?? addresses[0] ?? null

  patch.address = address
  patch.addressValue = ''
  patch.city = address?.City || ''
  patch.department = address?.Department || ''
}

function getPositiveId(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function getSaleLifeCycleStatusName(sale: SalesUkraineSale): string {
  const type = Number(sale.BaseLifeCycleStatus?.SaleLifeCycleType)

  return Number.isFinite(type) ? (SALE_LIFE_CYCLE_STATUS_NAMES[type] ?? '') : ''
}
