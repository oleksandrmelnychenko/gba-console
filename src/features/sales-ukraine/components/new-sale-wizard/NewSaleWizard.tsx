import { ActionIcon, Alert, Box, Button, Center, FileInput, Group, Loader, Modal, Stack, Text, UnstyledButton } from '@mantine/core'
import { X } from 'lucide-react'
import { notifications } from '@mantine/notifications'
import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { CREATE_ACTION_COLOR } from '../../../../shared/ui/page-header-actions/PageHeaderActions'
import { useAuth } from '../../../auth/useAuth'
import { getCurrentSaleCart, getSaleById } from '../../api/salesUkraineApi'
import { getSalesPendingMutationUserKey } from '../../pendingSalesMutationRegistry'
import type { Client } from '../../../clients/types'
import type { SaleDocumentResult, SalesUkraineSale } from '../../types'
import { NewSaleClientStep } from './NewSaleClientStep'
import { NewSaleProductsStep } from './NewSaleProductsStep'
import { NewSaleReviewStep } from './NewSaleReviewStep'
import {
  bumpWizardDebtRefresh,
  canAdvanceToProducts,
  canAdvanceToReview,
  claimWizardSplitRecoveryOwnership,
  clearWizardMergedSale,
  getCartItemCount,
  getWizardMergedSale,
  getWizardSplitRecovery,
  hydrateWizardSplitRecovery,
  isWizardShellBusy,
  NEW_SALE_REVIEW_INITIAL,
  NEW_SALE_WIZARD_INITIAL,
  refreshWizardSplitRecoveryOwnership,
  replaceWizardMergedOrderItems,
  setWizardMergedSale,
  useWizardSplitOrderItems,
  type NewSaleReviewValue,
  type NewSaleWizardState,
} from './newSaleWizardState'
import {
  dispatchWizardKey,
  initializeWizardKeyboard,
  useWizardKeyboardSnapshot,
  WIZARD_STEP_TITLES,
  type WizardStepIndex,
} from './wizardKeyboard'
import { WizardConfirmModal } from './WizardConfirmModal'
import { WizardClientHeroHeader } from './WizardClientHeroHeader'
import { WizardDownloadDocumentsModal } from './WizardDownloadDocumentsModal'
import { WizardSaleHeader } from './WizardSaleHeader'
import { createWizardAsyncGenerationGuard } from './wizardAsyncGeneration'
import {
  getWizardMutationContextKey,
  restorePersistedWizardSplitRecovery,
  type WizardSplitRecoveryRunResult,
} from './wizardSplitSale'
import {
  confirmLinkedWizardFinalMutationCommitted,
  recoverLinkedWizardFinalMutation,
  type WizardFinalSplitRecoveryResult,
} from './wizardFinalSplitRecovery'
import './new-sale-wizard.css'

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'

function getWizardRequestErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}

export function NewSaleWizard({
  opened,
  editSale,
  onClose,
  onCreated,
}: {
  editSale?: SalesUkraineSale | null
  onClose: () => void
  onCreated: () => void
  opened: boolean
}) {
  const { t } = useI18n()
  const { session } = useAuth()
  const [vatDocuments, setVatDocuments] = useState<SaleDocumentResult | null>(null)
  const [splitRecoveryStatus, setSplitRecoveryStatus] = useState<'failed' | 'loading' | 'ready'>('loading')
  const [splitRecoveryError, setSplitRecoveryError] = useState<string | null>(null)
  const [splitRecoveryFile, setSplitRecoveryFile] = useState<File | null>(null)
  const [splitRecoveryNeedsManualConfirmation, setSplitRecoveryNeedsManualConfirmation] = useState(false)
  const [splitRecoveryNeedsFile, setSplitRecoveryNeedsFile] = useState(false)
  const contentBusyRef = useRef(false)
  const splitRecoveryAttemptRef = useRef(0)
  const splitRecoveryUserKey = getSalesPendingMutationUserKey(session)
  const handleContentBusyChange = useCallback((next: boolean) => {
    contentBusyRef.current = next
  }, [])
  const restoreSplit = useCallback(
    () => restorePersistedWizardSplitRecovery(splitRecoveryUserKey),
    [splitRecoveryUserKey],
  )
  const runAutomaticSplitRecovery = useCallback(async (recoveryFile: File | null = null) => {
    const attempt = splitRecoveryAttemptRef.current + 1
    splitRecoveryAttemptRef.current = attempt
    const hydratedRecovery = hydrateWizardSplitRecovery(splitRecoveryUserKey)

    if (!hydratedRecovery) {
      contentBusyRef.current = false
      setSplitRecoveryError(null)
      setSplitRecoveryNeedsManualConfirmation(false)
      setSplitRecoveryNeedsFile(false)
      setSplitRecoveryStatus('ready')

      return
    }

    const recovery = claimWizardSplitRecoveryOwnership(hydratedRecovery)

    if (!recovery) {
      const message = t('Це незавершене розділення зараз обробляється в іншій вкладці. Закрийте її або повторіть після звільнення координації')
      contentBusyRef.current = false
      setSplitRecoveryError(message)
      setSplitRecoveryNeedsManualConfirmation(false)
      setSplitRecoveryNeedsFile(false)
      setSplitRecoveryStatus('failed')

      return
    }

    contentBusyRef.current = true
    setSplitRecoveryError(null)
    setSplitRecoveryNeedsManualConfirmation(false)
    setSplitRecoveryNeedsFile(false)
    setSplitRecoveryStatus('loading')
    let finalResult: WizardFinalSplitRecoveryResult

    try {
      finalResult = recovery.finalMutation
        ? await recoverLinkedWizardFinalMutation(recovery, recoveryFile)
        : { status: 'not-linked' as const }
    } catch (error) {
      if (splitRecoveryAttemptRef.current !== attempt) {
        return
      }

      const message = getWizardRequestErrorMessage(error, t('Не вдалося звірити фінальну операцію продажу'))
      contentBusyRef.current = false
      setSplitRecoveryError(message)
      setSplitRecoveryNeedsManualConfirmation(false)
      setSplitRecoveryNeedsFile(false)
      setSplitRecoveryStatus('failed')
      notifications.show({ autoClose: false, color: 'red', message })

      return
    }

    if (splitRecoveryAttemptRef.current !== attempt) {
      return
    }

    if (
      finalResult.status === 'pending' ||
      finalResult.status === 'requires-file' ||
      finalResult.status === 'requires-manual-confirmation'
    ) {
      const message = getWizardRequestErrorMessage(
        finalResult.error,
        t('Не вдалося звірити фінальну операцію продажу'),
      )
      contentBusyRef.current = false
      setSplitRecoveryError(message)
      setSplitRecoveryNeedsManualConfirmation(finalResult.status === 'requires-manual-confirmation')
      setSplitRecoveryNeedsFile(finalResult.status === 'requires-file')
      setSplitRecoveryStatus('failed')
      notifications.show({ autoClose: false, color: 'orange', message })

      return
    }

    if (finalResult.status === 'committed') {
      contentBusyRef.current = false
      setSplitRecoveryError(null)
      setSplitRecoveryFile(null)
      setSplitRecoveryNeedsManualConfirmation(false)
      setSplitRecoveryNeedsFile(false)
      setSplitRecoveryStatus('ready')

      if (isSaleDocumentResult(finalResult.result)) {
        setVatDocuments(finalResult.result)
      }

      notifications.show({ color: 'green', message: t('Продаж підтверджено без повторного повернення позицій') })
      onCreated()
      onClose()

      return
    }

    const result = await restoreSplit()

    if (splitRecoveryAttemptRef.current !== attempt) {
      return
    }

    contentBusyRef.current = false

    if (!result.succeeded) {
      const message = getWizardRequestErrorMessage(result.error, t('Не вдалося відновити розділені позиції'))
      setSplitRecoveryError(message)
      setSplitRecoveryNeedsManualConfirmation(false)
      setSplitRecoveryNeedsFile(false)
      setSplitRecoveryStatus('failed')
      notifications.show({ autoClose: false, color: 'red', message })

      return
    }

    setSplitRecoveryError(null)
    setSplitRecoveryFile(null)
    setSplitRecoveryNeedsManualConfirmation(false)
    setSplitRecoveryNeedsFile(false)
    setSplitRecoveryStatus('ready')

    if (result.changed) {
      notifications.show({ color: 'green', message: t('Розділені позиції відновлено у вихідному рахунку') })
    }
  }, [onClose, onCreated, restoreSplit, splitRecoveryUserKey, t])
  const confirmManualSplitDestination = useCallback(async () => {
    const recovery = hydrateWizardSplitRecovery(splitRecoveryUserKey)

    if (
      !recovery?.finalMutation ||
      !await confirmLinkedWizardFinalMutationCommitted(recovery)
    ) {
      const message = t('Не вдалося підтвердити фінальну операцію. Повторіть звірку')
      setSplitRecoveryError(message)
      notifications.show({ autoClose: false, color: 'red', message })

      return
    }

    contentBusyRef.current = false
    setSplitRecoveryError(null)
    setSplitRecoveryFile(null)
    setSplitRecoveryNeedsManualConfirmation(false)
    setSplitRecoveryNeedsFile(false)
    setSplitRecoveryStatus('ready')
    notifications.show({
      color: 'green',
      message: t('Створення продажу підтверджено вручну; позиції у джерело не поверталися'),
    })
    onCreated()
    onClose()
  }, [onClose, onCreated, splitRecoveryUserKey, t])
  const runAutomaticSplitRecoveryEvent = useEffectEvent(runAutomaticSplitRecovery)

  useEffect(() => {
    let cancelled = false

    if (!opened) {
      contentBusyRef.current = false
      splitRecoveryAttemptRef.current += 1

      return () => {
        cancelled = true
      }
    }

    queueMicrotask(() => {
      if (!cancelled) {
        void runAutomaticSplitRecoveryEvent()
      }
    })

    return () => {
      cancelled = true
      splitRecoveryAttemptRef.current += 1
    }
  }, [opened])

  useEffect(() => {
    if (!opened) {
      return
    }

    const timer = window.setInterval(() => {
      refreshWizardSplitRecoveryOwnership()
    }, 5_000)

    return () => window.clearInterval(timer)
  }, [opened])

  return (
    <>
      <Modal
        opened={opened}
        withCloseButton={false}
        closeOnEscape={false}
        closeOnClickOutside={false}
        size="100%"
        padding={0}
        overlayProps={{ backgroundOpacity: 0.25, blur: 2 }}
        transitionProps={{ transition: 'pop', duration: 200 }}
        styles={{
          inner: { padding: 8 },
          content: {
            width: 'calc(100vw - 16px)',
            maxWidth: 'calc(100vw - 16px)',
            height: 'calc(100dvh - 16px)',
            maxHeight: 'calc(100dvh - 16px)',
            borderRadius: 14,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          },
          body: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
        }}
        onClose={() => {
          if (!contentBusyRef.current) {
            onClose()
          }
        }}
      >
        {opened && splitRecoveryStatus === 'ready' && (
          <NewSaleWizardContent
            initialSale={editSale ?? null}
            onBusyChange={handleContentBusyChange}
            onClose={onClose}
            onCreated={onCreated}
            onRestoreSplit={restoreSplit}
            onVatDocuments={setVatDocuments}
          />
        )}
        {opened && splitRecoveryStatus === 'loading' && (
          <Center style={{ flex: 1 }}>
            <Loader aria-label={t('Відновлення розділених позицій')} />
          </Center>
        )}
        {opened && splitRecoveryStatus === 'failed' && (
          <Center p="md" style={{ flex: 1 }}>
            <Alert color="red" title={t('Не вдалося відновити розділені позиції')} w="min(520px, 100%)">
              <Stack gap="sm">
                <Text size="sm">{splitRecoveryError}</Text>
                {splitRecoveryNeedsFile && (
                  <FileInput
                    clearable
                    label={t('Файл для повторної звірки')}
                    value={splitRecoveryFile}
                    onChange={setSplitRecoveryFile}
                  />
                )}
                <Group justify="flex-end">
                  <Button variant="default" onClick={onClose}>{t('Закрити без змін')}</Button>
                  {splitRecoveryNeedsManualConfirmation && (
                    <Button color="orange" onClick={confirmManualSplitDestination}>
                      {t('Продаж існує: не повертати позиції')}
                    </Button>
                  )}
                  <Button
                    disabled={splitRecoveryNeedsFile && !splitRecoveryFile}
                    onClick={() => void runAutomaticSplitRecovery(splitRecoveryFile)}
                  >
                    {t('Повторити')}
                  </Button>
                </Group>
              </Stack>
            </Alert>
          </Center>
        )}
      </Modal>

      <WizardDownloadDocumentsModal result={vatDocuments} onClose={() => setVatDocuments(null)} />
    </>
  )
}

function isSaleDocumentResult(value: unknown): value is SaleDocumentResult {
  return value !== null && typeof value === 'object' && 'isAcceptedToPacking' in value
}

const WIZARD_STEPS: { index: WizardStepIndex }[] = [{ index: 0 }, { index: 1 }, { index: 2 }]

// Leaf subscriber to the keyboard-mode store: only these ~4 DOM nodes re-render
// on a mode transition instead of the whole wizard host (which used to recreate
// header tools and re-render the mounted step on every transition).
function WizardKeyboardStateLabel() {
  const { t } = useI18n()
  const keyboard = useWizardKeyboardSnapshot()

  return (
    <Group className="new-sale-wizard-keyboard-state" gap={6} wrap="nowrap">
      <Text className="new-sale-wizard-keyboard-state__label">
        {t('Стан режиму клавіатури')}:
      </Text>
      {keyboard.label && (
        <Text className="new-sale-wizard-keyboard-state__value">
          {keyboard.label}
        </Text>
      )}
    </Group>
  )
}

function NewSaleWizardContent({
  initialSale,
  onBusyChange,
  onClose,
  onCreated,
  onRestoreSplit,
  onVatDocuments,
}: {
  initialSale?: SalesUkraineSale | null
  onBusyChange: (busy: boolean) => void
  onClose: () => void
  onCreated: () => void
  onRestoreSplit: () => Promise<WizardSplitRecoveryRunResult>
  onVatDocuments: (result: SaleDocumentResult) => void
}) {
  const { t } = useI18n()
  const [active, setActive] = useState(0)
  const [state, setState] = useState<NewSaleWizardState>(NEW_SALE_WIZARD_INITIAL)
  // Preserved across step switches so the client step can restore instantly on remount.
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [review, setReview] = useState<NewSaleReviewValue>(NEW_SALE_REVIEW_INITIAL)
  const [busy, setBusy] = useState(false)
  const [reviewBusy, setReviewBusy] = useState(false)
  const [productsBusy, setProductsBusy] = useState(false)
  const productsBusyRef = useRef(false)
  const stateRef = useRef(state)
  const [reloadGuard] = useState(createWizardAsyncGenerationGuard)
  const [navigationGuard] = useState(createWizardAsyncGenerationGuard)
  const [reassignOpen, setReassignOpen] = useState(false)
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false)
  const splitItems = useWizardSplitOrderItems()
  const shellBusy = isWizardShellBusy(busy, productsBusy, reviewBusy)

  useLayoutEffect(() => {
    stateRef.current = state
  }, [state])

  const handleProductsBusyChange = useCallback(
    (next: boolean) => {
      productsBusyRef.current = next
      setProductsBusy(next)

      if (next) {
        onBusyChange(true)
      }
    },
    [onBusyChange],
  )

  function isShellBusyNow(): boolean {
    return isWizardShellBusy(busy, productsBusyRef.current, reviewBusy)
  }

  const restoreSplitBeforeAbandonment = useCallback(async (): Promise<boolean> => {
    if (!getWizardSplitRecovery()) {
      return true
    }

    setBusy(true)
    onBusyChange(true)

    try {
      const result = await onRestoreSplit()

      if (!result.succeeded) {
        notifications.show({
          autoClose: false,
          color: 'red',
          message: getWizardRequestErrorMessage(result.error, t('Не вдалося відновити розділені позиції')),
        })

        return false
      }

      if (result.sale && result.source) {
        const current = stateRef.current

        if (current.sale?.NetUid?.trim().toLowerCase() === result.source.saleNetUid) {
          const updated = { ...current, sale: result.sale }
          stateRef.current = updated
          setState(updated)

          if (result.source.origin === 'merged') {
            replaceWizardMergedOrderItems(result.source.saleNetUid, result.sale.Order?.OrderItems ?? [])
          }

          bumpWizardDebtRefresh()
        }
      }

      return true
    } finally {
      setBusy(false)
    }
  }, [onBusyChange, onRestoreSplit, t])

  function invalidateCartReloads() {
    reloadGuard.invalidate()
    navigationGuard.invalidate()
  }

  async function closeWizard() {
    if (isShellBusyNow()) {
      return
    }

    if (!(await restoreSplitBeforeAbandonment())) {
      return
    }

    invalidateCartReloads()
    onClose()
  }

  // Clicking the close (X) icon or the step-0 "Скасувати" button now asks for confirmation,
  // mirroring the Esc behaviour inside the steps, instead of discarding the sale immediately.
  function requestExit() {
    if (!isShellBusyNow()) {
      setExitConfirmOpen(true)
    }
  }

  async function confirmExit() {
    if (isShellBusyNow()) {
      return
    }

    setExitConfirmOpen(false)
    await closeWizard()
  }
  const reviewSubmitRef = useRef<(() => Promise<void>) | null>(null)

  const registerReviewSubmit = useCallback((submit: (() => Promise<void>) | null) => {
    reviewSubmitRef.current = submit
  }, [])

  useEffect(() => {
    clearWizardMergedSale()

    return () => {
      reloadGuard.invalidate()
      navigationGuard.invalidate()
    }
  }, [navigationGuard, reloadGuard])

  // Opened from the sales grid "Редагування" action: load the given sale and jump straight to
  // the products step (step 2) instead of starting at client selection.
  const editStartedRef = useRef(false)

  useEffect(() => {
    if (initialSale && !editStartedRef.current) {
      editStartedRef.current = true
      void openRegistrySale(initialSale)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useLayoutEffect(() => {
    onBusyChange(shellBusy)
  }, [onBusyChange, shellBusy])

  useEffect(() => () => onBusyChange(false), [onBusyChange])

  useEffect(() => {
    initializeWizardKeyboard(active as WizardStepIndex)
  }, [active])

  async function reloadCart(): Promise<SalesUkraineSale | null> {
    const requestState = stateRef.current
    const netId = requestState.sale?.NetUid
    const agreementNetId = requestState.agreementNetId
    const context = getWizardMutationContextKey(agreementNetId, netId)
    const token = reloadGuard.begin(context)
    let next: SalesUkraineSale | null

    try {
      next = netId
        ? await getSaleById(netId, token.signal)
        : agreementNetId
          ? await getCurrentSaleCart(agreementNetId, token.signal)
          : null
    } catch (loadError) {
      if (token.signal.aborted) {
        return null
      }

      throw loadError
    }

    const currentContext = getWizardMutationContextKey(
      stateRef.current.agreementNetId,
      stateRef.current.sale?.NetUid,
    )

    if (!reloadGuard.isCurrent(token, currentContext)) {
      return null
    }

    if (netId) {
      if (next) {
        const merged = getWizardMergedSale()

        if (merged?.netUid === netId) {
          replaceWizardMergedOrderItems(netId, next.Order?.OrderItems ?? [])
        }

        const current = stateRef.current
        const updateContext = getWizardMutationContextKey(current.agreementNetId, current.sale?.NetUid)

        if (!reloadGuard.isCurrent(token, updateContext) || current.sale?.NetUid !== netId) {
          return null
        }

        const updated = { ...current, sale: next }
        stateRef.current = updated
        setState(updated)
        bumpWizardDebtRefresh()
      }

      return next
    }

    if (!agreementNetId) {
      return null
    }

    if (next?.NetUid) {
      const current = stateRef.current
      const updateContext = getWizardMutationContextKey(current.agreementNetId, current.sale?.NetUid)

      if (!reloadGuard.isCurrent(token, updateContext) || current.agreementNetId !== agreementNetId) {
        return null
      }

      const updated = { ...current, sale: next }
      stateRef.current = updated
      setState(updated)
      bumpWizardDebtRefresh()
    }

    return next
  }

  async function goToProducts() {
    if (!canAdvanceToProducts(state) || !state.agreementNetId) {
      return
    }

    const agreementNetId = state.agreementNetId
    invalidateCartReloads()
    const token = navigationGuard.begin(`products:${agreementNetId.toLowerCase()}`)
    setBusy(true)

    try {
      const cart = await getCurrentSaleCart(agreementNetId, token.signal)

      if (
        !navigationGuard.isCurrent(token, token.context) ||
        stateRef.current.agreementNetId !== agreementNetId
      ) {
        return
      }

      clearWizardMergedSale()
      const updated = { ...stateRef.current, sale: cart?.NetUid ? cart : null }
      stateRef.current = updated
      setState(updated)
      bumpWizardDebtRefresh()
      setActive(1)
    } catch (loadError) {
      if (token.signal.aborted || !navigationGuard.isCurrent(token, token.context)) {
        return
      }

      notifications.show({
        color: 'red',
        message: loadError instanceof Error ? t(loadError.message) : t('Не вдалося виконати запит'),
      })
    } finally {
      if (navigationGuard.isCurrent(token, token.context)) {
        setBusy(false)
      }
    }
  }

  async function openRegistrySale(sale: SalesUkraineSale): Promise<boolean> {
    if (!(await restoreSplitBeforeAbandonment())) {
      return false
    }

    const agreement = sale.ClientAgreement ?? null
    const targetNetUid = sale.NetUid ?? ''

    invalidateCartReloads()
    const token = navigationGuard.begin(`registry:${targetNetUid.toLowerCase()}`)
    setBusy(true)

    try {
      const fresh = sale.NetUid ? await getSaleById(sale.NetUid, token.signal) : null

      if (!navigationGuard.isCurrent(token, token.context)) {
        return false
      }

      const next = fresh ?? sale

      clearWizardMergedSale()
      setReview(NEW_SALE_REVIEW_INITIAL)
      const current = stateRef.current
      const updated = {
        ...current,
        agreement: agreement ?? current.agreement,
        agreementNetId: agreement?.NetUid ?? current.agreementNetId,
        clientNetId: next.ClientAgreement?.Client?.NetUid ?? agreement?.Client?.NetUid ?? current.clientNetId,
        sale: next,
      }
      stateRef.current = updated
      setState(updated)
      bumpWizardDebtRefresh()
      setActive(1)

      return true
    } catch (loadError) {
      if (token.signal.aborted || !navigationGuard.isCurrent(token, token.context)) {
        return false
      }

      notifications.show({
        color: 'red',
        message: loadError instanceof Error ? t(loadError.message) : t('Не вдалося виконати запит'),
      })

      return false
    } finally {
      if (navigationGuard.isCurrent(token, token.context)) {
        setBusy(false)
      }
    }
  }

  async function openMergedSaleEdit(sale: SalesUkraineSale, unionSale: SalesUkraineSale | null) {
    if (!(await restoreSplitBeforeAbandonment())) {
      return
    }

    const agreement = unionSale?.ClientAgreement ?? null
    const targetNetUid = sale.NetUid ?? ''

    invalidateCartReloads()
    const token = navigationGuard.begin(`merged-edit:${targetNetUid.toLowerCase()}`)
    setBusy(true)

    try {
      const fresh = sale.NetUid ? await getSaleById(sale.NetUid, token.signal) : null

      if (!navigationGuard.isCurrent(token, token.context)) {
        return
      }

      const next = fresh ?? sale

      setReview(NEW_SALE_REVIEW_INITIAL)
      const current = stateRef.current
      const updated = {
        ...current,
        agreement: agreement ?? current.agreement,
        agreementNetId: agreement?.NetUid ?? current.agreementNetId,
        sale: next,
      }
      stateRef.current = updated
      setState(updated)
      setWizardMergedSale(
        sale.NetUid ? { netUid: sale.NetUid, orderItems: next.Order?.OrderItems ?? [], unionSale } : null,
      )
      bumpWizardDebtRefresh()
      setActive(1)
    } catch (loadError) {
      if (token.signal.aborted || !navigationGuard.isCurrent(token, token.context)) {
        return
      }

      notifications.show({
        color: 'red',
        message: loadError instanceof Error ? t(loadError.message) : t('Не вдалося виконати запит'),
      })
    } finally {
      if (navigationGuard.isCurrent(token, token.context)) {
        setBusy(false)
      }
    }
  }

  async function openMergedSaleInvoice(sale: SalesUkraineSale, unionSale: SalesUkraineSale | null) {
    if (!(await restoreSplitBeforeAbandonment())) {
      return
    }

    const agreement = unionSale?.ClientAgreement ?? null

    invalidateCartReloads()
    setReview(NEW_SALE_REVIEW_INITIAL)
    setState((current) => ({
      ...current,
      agreement: agreement ?? current.agreement,
      agreementNetId: agreement?.NetUid ?? current.agreementNetId,
      sale,
    }))
    setWizardMergedSale(sale.NetUid ? { netUid: sale.NetUid, orderItems: sale.Order?.OrderItems ?? [], unionSale: null } : null)
    bumpWizardDebtRefresh()
    setActive(2)
  }

  async function startMergedMainClientSale(unionSale: SalesUkraineSale) {
    if (!(await restoreSplitBeforeAbandonment())) {
      return
    }

    const agreement = unionSale.ClientAgreement ?? null

    invalidateCartReloads()
    clearWizardMergedSale()
    setReview(NEW_SALE_REVIEW_INITIAL)
    setState((current) => ({
      ...current,
      agreement: agreement ?? current.agreement,
      agreementNetId: agreement?.NetUid ?? current.agreementNetId,
      sale: null,
    }))
    bumpWizardDebtRefresh()
    setActive(1)
  }

  async function goToClients() {
    if (!(await restoreSplitBeforeAbandonment())) {
      return
    }

    invalidateCartReloads()
    clearWizardMergedSale()
    setReview(NEW_SALE_REVIEW_INITIAL)
    setState((current) => ({ ...current, sale: null }))
    setActive(0)
  }

  function goToReview() {
    if (canAdvanceToReview(state)) {
      invalidateCartReloads()
      setActive(2)
    }
  }

  async function handleNext() {
    if (isShellBusyNow()) {
      return
    }

    if (active === 0) {
      await goToProducts()
    } else if (active === 1) {
      goToReview()
    } else {
      const submit = reviewSubmitRef.current

      if (!submit) {
        return
      }

      setBusy(true)

      try {
        await submit()
      } finally {
        setBusy(false)
      }
    }
  }

  function onStepClick(index: number) {
    if (isShellBusyNow()) {
      return
    }

    if (index < active) {
      if (index === 0) {
        void goToClients()
      } else {
        invalidateCartReloads()
        setActive(index)
      }

      return
    }

    if (index === 1) {
      void goToProducts()
    } else if (index === 2) {
      goToReview()
    }
  }

  const nextDisabled =
    shellBusy ||
    (active === 0 && !canAdvanceToProducts(state)) ||
    (active === 1 && getCartItemCount(state.sale) === 0)
  const nextLabel = active === 2 ? t('Створити продаж') : t('Далі')
  const productsCart: SalesUkraineSale =
    state.sale ?? {
      ClientAgreement: state.agreement ?? undefined,
      IsVatSale: Boolean(state.agreement?.Agreement?.WithVATAccounting),
      NetUid: EMPTY_GUID,
    }

  function handleRootKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (productsBusyRef.current) {
      event.preventDefault()

      return
    }

    if (reassignOpen) {
      return
    }

    // Alt+1/2/3 step navigation is handled globally on the document so it works
    // regardless of which element (or none) currently holds focus.
    if (event.altKey) {
      return
    }

    if (event.key === 'F1' || event.key === 'F3') {
      event.preventDefault()
      event.stopPropagation()

      return
    }

    if (event.key === 'F2') {
      event.preventDefault()
      event.stopPropagation()
    }

    if (dispatchWizardKey(event)) {
      return
    }

    if (event.ctrlKey && event.key === 'Enter' && !nextDisabled) {
      void handleNext()
    }
  }

  // Keep the latest shortcut handler in a ref so the document listener (registered once)
  // always runs against fresh state without re-binding on every render.
  const altNavigationRef = useRef<(event: KeyboardEvent) => void>(() => {})

  useEffect(() => {
    altNavigationRef.current = (event: KeyboardEvent) => {
      if (reassignOpen || exitConfirmOpen || !event.altKey) {
        return
      }

      if (event.code === 'Digit1') {
        event.preventDefault()

        if (!isShellBusyNow()) {
          void goToClients()
        }
      } else if (event.code === 'Digit2') {
        event.preventDefault()

        if (!isShellBusyNow() && canAdvanceToProducts(state)) {
          if (active > 1) {
            invalidateCartReloads()
            setActive(1)
          } else {
            void goToProducts()
          }
        }
      } else if (event.code === 'Digit3') {
        event.preventDefault()

        if (!isShellBusyNow() && canAdvanceToProducts(state)) {
          if (canAdvanceToReview(state)) {
            goToReview()
          } else {
            notifications.show({ color: 'red', message: t('Потрібно створити рахунок, або вибрати рахунок') })
          }
        }
      }
    }
  })

  useEffect(() => {
    const listener = (event: KeyboardEvent) => altNavigationRef.current(event)
    document.addEventListener('keydown', listener)

    return () => document.removeEventListener('keydown', listener)
  }, [])

  const withVatAccounting = Boolean(state.agreement?.Agreement?.WithVATAccounting ?? state.sale?.ClientAgreement?.Agreement?.WithVATAccounting)
  const wizardClient = selectedClient ?? state.sale?.ClientAgreement?.Client ?? state.agreement?.Client ?? null
  const wizardHeaderClose = (
    <ActionIcon aria-label={t('Закрити')} color="gray" disabled={shellBusy} size="lg" variant="subtle" onClick={requestExit}>
      <X size={20} />
    </ActionIcon>
  )
  const onSaleReassigned = useCallback((movedSale: SalesUkraineSale | null) => {
    reloadGuard.invalidate()
    clearWizardMergedSale()
    setState((current) => ({ ...current, sale: movedSale ?? current.sale }))
    bumpWizardDebtRefresh()
    setActive(0)
  }, [reloadGuard])

  // Memoized: this element is passed into every step — rebuilding it each host
  // render re-rendered the 490-line WizardSaleHeader (and the receiving step)
  // on every keystroke that touched host state.
  const wizardHeaderTools = useMemo(
    () => (
      <Group gap={6} justify="flex-end" wrap="nowrap">
        <WizardSaleHeader
          clientNetId={state.clientNetId}
          hideAgreementsAction
          mode="inline"
          reassignDisabled={shellBusy || productsBusy || splitItems.length > 0 || Boolean(getWizardSplitRecovery())}
          sale={state.sale}
          withVatAccounting={withVatAccounting}
          onReassignOpenChange={setReassignOpen}
          onSaleReassigned={onSaleReassigned}
        />
      </Group>
    ),
    [onSaleReassigned, productsBusy, shellBusy, splitItems.length, state.clientNetId, state.sale, withVatAccounting],
  )

  return (
    <Box
      aria-label={t('Майстер нової продажі')}
      className="new-sale-wizard-frame"
      role="group"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
      onKeyDown={handleRootKeyDown}
    >
      <Box className="new-sale-wizard-frame-close">{wizardHeaderClose}</Box>
      {active === 2 && (
        <WizardClientHeroHeader
          activeAgreementNetId={state.agreementNetId}
          client={wizardClient}
          clientNetId={state.clientNetId}
          headerTools={wizardHeaderTools}
        />
      )}

      <Box
        className="new-sale-wizard-stage"
        style={{
          overflow: active === 0 ? 'visible' : active === 1 ? 'hidden' : 'auto',
        }}
      >
        {active === 0 && (
          <NewSaleClientStep
            clientNetId={state.clientNetId}
            headerTools={wizardHeaderTools}
            initialClient={selectedClient}
            onClientResolved={setSelectedClient}
            onAgreementChange={(agreementNetId, agreement) => {
              invalidateCartReloads()
              clearWizardMergedSale()
              setReview(NEW_SALE_REVIEW_INITIAL)
              // Bail on no-change: returning the same object skips the host re-render.
              setState((current) =>
                current.agreementNetId === agreementNetId && current.agreement === agreement
                  ? current
                  : { ...current, agreement, agreementNetId },
              )
            }}
            onClientChange={(clientNetId) => {
              invalidateCartReloads()
              clearWizardMergedSale()
              setReview(NEW_SALE_REVIEW_INITIAL)
              setState((current) => (current.clientNetId === clientNetId ? current : { ...current, clientNetId }))
            }}
            onCreateMergedMainClientSale={(sale) => void startMergedMainClientSale(sale)}
            onEditMergedSale={(sale, unionSale) => void openMergedSaleEdit(sale, unionSale)}
            onInvoiceMergedSale={(sale, unionSale) => void openMergedSaleInvoice(sale, unionSale)}
            onOpenSale={(sale) => void openRegistrySale(sale)}
            onRequestClose={requestExit}
          />
        )}
        {active === 1 && (
          <NewSaleProductsStep
            agreementNetId={state.agreementNetId}
            client={wizardClient}
            clientNetId={state.clientNetId}
            headerTools={wizardHeaderTools}
            sale={productsCart}
            onBusyChange={handleProductsBusyChange}
            onCartChanged={reloadCart}
            onRequestClose={requestExit}
            onRestoreSplitItems={restoreSplitBeforeAbandonment}
          />
        )}
        {active === 2 && (
          <NewSaleReviewStep
            clientNetId={state.clientNetId}
            sale={state.sale}
            value={review}
            onBusyChange={setReviewBusy}
            onChange={(patch) => setReview((current) => ({ ...current, ...patch }))}
            onClose={() => void closeWizard()}
            onCreated={() => {
              invalidateCartReloads()
              onCreated()
            }}
            onMergedSubmitted={() => void goToClients()}
            onRegisterSubmit={registerReviewSubmit}
            onVatDocuments={onVatDocuments}
            withVatAccounting={withVatAccounting}
          />
        )}
      </Box>

      <Box className="new-sale-wizard-footer">
        <WizardKeyboardStateLabel />

        <Group className="new-sale-wizard-step-list" gap={4} justify="center" wrap="nowrap">
          {WIZARD_STEPS.map((step, index) => {
            const title = t(WIZARD_STEP_TITLES[step.index])
            const isActive = index === active
            const isDone = index < active

            return (
              <UnstyledButton
                aria-current={isActive ? 'step' : undefined}
                aria-label={title}
                className={`new-sale-wizard-step ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''}`}
                key={step.index}
                onClick={() => onStepClick(index)}
              >
                <span className="new-sale-wizard-step__label">{title}</span>
              </UnstyledButton>
            )
          })}
        </Group>

        {active !== 2 ? (
          <Group className="new-sale-wizard-footer__actions" gap="xs" justify="flex-end" wrap="nowrap">
            <Button
              className="new-sale-wizard-footer__button"
              color="gray"
              disabled={shellBusy}
              variant="default"
              onClick={active === 0 ? requestExit : active === 1 ? () => void goToClients() : () => setActive(1)}
            >
              {active === 0 ? t('Скасувати') : t('Назад')}
            </Button>
            <Button
              className="new-sale-wizard-footer__button"
              color={CREATE_ACTION_COLOR}
              disabled={nextDisabled}
              loading={busy}
              onClick={handleNext}
            >
              {nextLabel}
            </Button>
          </Group>
        ) : (
          <Box className="new-sale-wizard-footer__actions" aria-hidden="true" />
        )}
      </Box>

      <WizardConfirmModal
        busy={shellBusy}
        message={t('Закрити вікно?')}
        opened={exitConfirmOpen}
        onCancel={() => setExitConfirmOpen(false)}
        onConfirm={() => void confirmExit()}
      />
    </Box>
  )
}
