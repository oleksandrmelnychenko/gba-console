import { ActionIcon, Box, Button, Group, Modal, Text, UnstyledButton } from '@mantine/core'
import { IconX } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { CREATE_ACTION_COLOR } from '../../../../shared/ui/page-header-actions/PageHeaderActions'
import { getCurrentSaleCart, getSaleById } from '../../api/salesUkraineApi'
import type { Client } from '../../../clients/types'
import type { SaleDocumentResult, SalesUkraineSale } from '../../types'
import { NewSaleClientStep } from './NewSaleClientStep'
import { NewSaleProductsStep } from './NewSaleProductsStep'
import { NewSaleReviewStep } from './NewSaleReviewStep'
import {
  bumpWizardDebtRefresh,
  canAdvanceToProducts,
  canAdvanceToReview,
  clearWizardMergedSale,
  clearWizardSplitOrderItems,
  getCartItemCount,
  getWizardMergedSale,
  NEW_SALE_REVIEW_INITIAL,
  NEW_SALE_WIZARD_INITIAL,
  setWizardMergedSale,
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
import './new-sale-wizard.css'

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'

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
  const [vatDocuments, setVatDocuments] = useState<SaleDocumentResult | null>(null)
  const [contentBusy, setContentBusy] = useState(false)

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
          if (!contentBusy) {
            onClose()
          }
        }}
      >
        {opened && (
          <NewSaleWizardContent
            initialSale={editSale ?? null}
            onBusyChange={setContentBusy}
            onClose={onClose}
            onCreated={onCreated}
            onVatDocuments={setVatDocuments}
          />
        )}
      </Modal>

      <WizardDownloadDocumentsModal result={vatDocuments} onClose={() => setVatDocuments(null)} />
    </>
  )
}

const WIZARD_STEPS: { index: WizardStepIndex }[] = [{ index: 0 }, { index: 1 }, { index: 2 }]

function NewSaleWizardContent({
  initialSale,
  onBusyChange,
  onClose,
  onCreated,
  onVatDocuments,
}: {
  initialSale?: SalesUkraineSale | null
  onBusyChange: (busy: boolean) => void
  onClose: () => void
  onCreated: () => void
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
  const [reassignOpen, setReassignOpen] = useState(false)
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false)
  const shellBusy = busy || reviewBusy

  // Clicking the close (X) icon or the step-0 "Скасувати" button now asks for confirmation,
  // mirroring the Esc behaviour inside the steps, instead of discarding the sale immediately.
  function requestExit() {
    if (!shellBusy) {
      setExitConfirmOpen(true)
    }
  }

  function confirmExit() {
    setExitConfirmOpen(false)
    onClose()
  }
  const keyboard = useWizardKeyboardSnapshot()
  const reviewSubmitRef = useRef<(() => Promise<void>) | null>(null)

  const registerReviewSubmit = useCallback((submit: (() => Promise<void>) | null) => {
    reviewSubmitRef.current = submit
  }, [])

  useEffect(() => {
    clearWizardSplitOrderItems()
    clearWizardMergedSale()
  }, [])

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

  useEffect(() => {
    onBusyChange(shellBusy)

    return () => {
      onBusyChange(false)
    }
  }, [onBusyChange, shellBusy])

  useEffect(() => {
    initializeWizardKeyboard(active as WizardStepIndex)
  }, [active])

  async function reloadCart() {
    bumpWizardDebtRefresh()
    const netId = state.sale?.NetUid

    if (netId) {
      const next = await getSaleById(netId)

      if (next) {
        setState((current) => {
          if (current.sale?.NetUid !== netId) {
            return current
          }

          const merged = getWizardMergedSale()

          return {
            ...current,
            sale: merged ? { ...next, Order: { ...(next.Order ?? {}), OrderItems: merged.orderItems } } : next,
          }
        })
      }

      return
    }

    const agreementNetId = state.agreementNetId

    if (!agreementNetId) {
      return
    }

    const next = await getCurrentSaleCart(agreementNetId)

    if (next?.NetUid) {
      setState((current) => (current.agreementNetId === agreementNetId ? { ...current, sale: next } : current))
    }
  }

  async function goToProducts() {
    if (!canAdvanceToProducts(state) || !state.agreementNetId) {
      return
    }

    setBusy(true)

    try {
      const cart = await getCurrentSaleCart(state.agreementNetId)

      clearWizardMergedSale()
      setState((current) => ({ ...current, sale: cart?.NetUid ? cart : null }))
      bumpWizardDebtRefresh()
      setActive(1)
    } catch (loadError) {
      notifications.show({
        color: 'red',
        message: loadError instanceof Error ? t(loadError.message) : t('Не вдалося виконати запит'),
      })
    } finally {
      setBusy(false)
    }
  }

  async function openRegistrySale(sale: SalesUkraineSale): Promise<boolean> {
    const agreement = sale.ClientAgreement ?? null

    setBusy(true)

    try {
      const fresh = sale.NetUid ? await getSaleById(sale.NetUid) : null
      const next = fresh ?? sale

      clearWizardSplitOrderItems()
      clearWizardMergedSale()
      setReview(NEW_SALE_REVIEW_INITIAL)
      setState((current) => ({
        ...current,
        agreement: agreement ?? current.agreement,
        agreementNetId: agreement?.NetUid ?? current.agreementNetId,
        clientNetId: next.ClientAgreement?.Client?.NetUid ?? agreement?.Client?.NetUid ?? current.clientNetId,
        sale: next,
      }))
      bumpWizardDebtRefresh()
      setActive(1)

      return true
    } catch (loadError) {
      notifications.show({
        color: 'red',
        message: loadError instanceof Error ? t(loadError.message) : t('Не вдалося виконати запит'),
      })

      return false
    } finally {
      setBusy(false)
    }
  }

  async function openMergedSaleEdit(sale: SalesUkraineSale, unionSale: SalesUkraineSale | null) {
    const agreement = unionSale?.ClientAgreement ?? null

    setBusy(true)

    try {
      const fresh = sale.NetUid ? await getSaleById(sale.NetUid) : null
      const next = fresh ?? sale

      clearWizardSplitOrderItems()
      setReview(NEW_SALE_REVIEW_INITIAL)
      setState((current) => ({
        ...current,
        agreement: agreement ?? current.agreement,
        agreementNetId: agreement?.NetUid ?? current.agreementNetId,
        sale: next,
      }))
      setWizardMergedSale(
        sale.NetUid ? { netUid: sale.NetUid, orderItems: next.Order?.OrderItems ?? [], unionSale } : null,
      )
      bumpWizardDebtRefresh()
      setActive(1)
    } catch (loadError) {
      notifications.show({
        color: 'red',
        message: loadError instanceof Error ? t(loadError.message) : t('Не вдалося виконати запит'),
      })
    } finally {
      setBusy(false)
    }
  }

  function openMergedSaleInvoice(sale: SalesUkraineSale, unionSale: SalesUkraineSale | null) {
    const agreement = unionSale?.ClientAgreement ?? null

    clearWizardSplitOrderItems()
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

  function startMergedMainClientSale(unionSale: SalesUkraineSale) {
    const agreement = unionSale.ClientAgreement ?? null

    clearWizardSplitOrderItems()
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

  function goToClients() {
    clearWizardSplitOrderItems()
    clearWizardMergedSale()
    setReview(NEW_SALE_REVIEW_INITIAL)
    setState((current) => ({ ...current, sale: null }))
    setActive(0)
  }

  function goToReview() {
    if (canAdvanceToReview(state)) {
      setActive(2)
    }
  }

  async function handleNext() {
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
    if (shellBusy) {
      return
    }

    if (index < active) {
      if (index === 0) {
        goToClients()
      } else {
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

        if (!shellBusy) {
          goToClients()
        }
      } else if (event.code === 'Digit2') {
        event.preventDefault()

        if (!shellBusy && canAdvanceToProducts(state)) {
          void goToProducts()
        }
      } else if (event.code === 'Digit3') {
        event.preventDefault()

        if (!shellBusy && canAdvanceToProducts(state)) {
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
      <IconX size={20} />
    </ActionIcon>
  )
  const wizardHeaderTools = (
    <Group gap={6} justify="flex-end" wrap="nowrap">
      <WizardSaleHeader
        clientNetId={state.clientNetId}
        hideAgreementsAction
        mode="inline"
        reassignDisabled={shellBusy || productsBusy}
        sale={state.sale}
        withVatAccounting={withVatAccounting}
        onReassignOpenChange={setReassignOpen}
        onSaleReassigned={(movedSale) => {
          clearWizardSplitOrderItems()
          clearWizardMergedSale()
          setState((current) => ({ ...current, sale: movedSale ?? current.sale }))
          bumpWizardDebtRefresh()
          setActive(0)
        }}
      />
    </Group>
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
        style={{
          boxSizing: 'border-box',
          flex: 1,
          minHeight: 0,
          overflow: active === 0 ? 'visible' : active === 1 ? 'hidden' : 'auto',
          paddingBottom: active === 0 ? 8 : 0,
          paddingLeft: active === 0 ? 8 : 0,
          paddingRight: active === 0 ? 8 : active === 1 ? 0 : 4,
          paddingTop: active === 0 ? 8 : 0,
        }}
      >
        {active === 0 && (
          <NewSaleClientStep
            clientNetId={state.clientNetId}
            headerTools={wizardHeaderTools}
            initialClient={selectedClient}
            onClientResolved={setSelectedClient}
            onAgreementChange={(agreementNetId, agreement) => {
              clearWizardSplitOrderItems()
              clearWizardMergedSale()
              setReview(NEW_SALE_REVIEW_INITIAL)
              setState((current) => ({ ...current, agreement, agreementNetId }))
            }}
            onClientChange={(clientNetId) => {
              clearWizardSplitOrderItems()
              clearWizardMergedSale()
              setReview(NEW_SALE_REVIEW_INITIAL)
              setState((current) => ({ ...current, clientNetId }))
            }}
            onCreateMergedMainClientSale={startMergedMainClientSale}
            onEditMergedSale={(sale, unionSale) => void openMergedSaleEdit(sale, unionSale)}
            onInvoiceMergedSale={openMergedSaleInvoice}
            onOpenSale={(sale) => void openRegistrySale(sale)}
            onRequestClose={onClose}
          />
        )}
        {active === 1 && (
          <NewSaleProductsStep
            agreementNetId={state.agreementNetId}
            client={wizardClient}
            clientNetId={state.clientNetId}
            headerTools={wizardHeaderTools}
            sale={productsCart}
            onBusyChange={setProductsBusy}
            onCartChanged={reloadCart}
            onRequestClose={onClose}
          />
        )}
        {active === 2 && (
          <NewSaleReviewStep
            clientNetId={state.clientNetId}
            sale={state.sale}
            value={review}
            onBusyChange={setReviewBusy}
            onChange={(patch) => setReview((current) => ({ ...current, ...patch }))}
            onClose={onClose}
            onCreated={onCreated}
            onMergedSubmitted={goToClients}
            onRegisterSubmit={registerReviewSubmit}
            onVatDocuments={onVatDocuments}
          />
        )}
      </Box>

      <Box className="new-sale-wizard-footer">
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

        <Group className="new-sale-wizard-footer__actions" gap="xs" justify="flex-end" wrap="nowrap">
          <Button
            className="new-sale-wizard-footer__button"
            color="gray"
            disabled={shellBusy}
            variant="default"
            onClick={active === 0 ? requestExit : active === 1 ? goToClients : () => setActive(1)}
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
      </Box>

      <WizardConfirmModal
        message={t('Закрити вікно?')}
        opened={exitConfirmOpen}
        onCancel={() => setExitConfirmOpen(false)}
        onConfirm={confirmExit}
      />
    </Box>
  )
}
