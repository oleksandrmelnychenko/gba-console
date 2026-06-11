import { Box, Button, Group, Modal, Text, Tooltip, UnstyledButton } from '@mantine/core'
import { IconBox, IconTruckDelivery, IconUser } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getCurrentSaleCart, getSaleById } from '../../api/salesUkraineApi'
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
import { WizardDownloadDocumentsModal } from './WizardDownloadDocumentsModal'
import { WizardSaleHeader } from './WizardSaleHeader'

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'

export function NewSaleWizard({
  opened,
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
  opened: boolean
}) {
  const { t } = useI18n()
  const [vatDocuments, setVatDocuments] = useState<SaleDocumentResult | null>(null)
  const [contentBusy, setContentBusy] = useState(false)

  return (
    <>
      <Modal
        opened={opened}
        title={t('Нова продажа')}
        withCloseButton
        closeOnEscape={false}
        size="100%"
        padding="lg"
        overlayProps={{ backgroundOpacity: 0.25, blur: 2 }}
        transitionProps={{ transition: 'pop', duration: 200 }}
        styles={{
          inner: { padding: 8 },
          content: {
            width: '100%',
            maxWidth: '100%',
            height: 'calc(100dvh - 16px)',
            maxHeight: 'calc(100dvh - 16px)',
            borderRadius: 14,
            display: 'flex',
            flexDirection: 'column',
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

const WIZARD_STEPS: { icon: typeof IconUser; index: WizardStepIndex }[] = [
  { icon: IconUser, index: 0 },
  { icon: IconBox, index: 1 },
  { icon: IconTruckDelivery, index: 2 },
]

function NewSaleWizardContent({
  onBusyChange,
  onClose,
  onCreated,
  onVatDocuments,
}: {
  onBusyChange: (busy: boolean) => void
  onClose: () => void
  onCreated: () => void
  onVatDocuments: (result: SaleDocumentResult) => void
}) {
  const { t } = useI18n()
  const [active, setActive] = useState(0)
  const [state, setState] = useState<NewSaleWizardState>(NEW_SALE_WIZARD_INITIAL)
  const [review, setReview] = useState<NewSaleReviewValue>(NEW_SALE_REVIEW_INITIAL)
  const [busy, setBusy] = useState(false)
  const [reviewBusy, setReviewBusy] = useState(false)
  const [productsBusy, setProductsBusy] = useState(false)
  const [reassignOpen, setReassignOpen] = useState(false)
  const shellBusy = busy || reviewBusy
  const keyboard = useWizardKeyboardSnapshot()
  const reviewSubmitRef = useRef<(() => Promise<void>) | null>(null)

  const registerReviewSubmit = useCallback((submit: (() => Promise<void>) | null) => {
    reviewSubmitRef.current = submit
  }, [])

  useEffect(() => {
    clearWizardSplitOrderItems()
    clearWizardMergedSale()
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

      clearWizardSplitOrderItems()
      clearWizardMergedSale()
      setReview(NEW_SALE_REVIEW_INITIAL)
      setState((current) => ({
        ...current,
        agreement: agreement ?? current.agreement,
        agreementNetId: agreement?.NetUid ?? current.agreementNetId,
        sale: fresh ?? sale,
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

    if (event.altKey) {
      if (event.code === 'Digit1') {
        event.preventDefault()
        event.stopPropagation()

        if (!shellBusy) {
          goToClients()
        }
      } else if (event.code === 'Digit2') {
        event.preventDefault()
        event.stopPropagation()

        if (!shellBusy && canAdvanceToProducts(state)) {
          void goToProducts()
        }
      } else if (event.code === 'Digit3') {
        event.preventDefault()
        event.stopPropagation()

        if (!shellBusy && canAdvanceToProducts(state)) {
          if (canAdvanceToReview(state)) {
            goToReview()
          } else {
            notifications.show({ color: 'red', message: t('Потрібно створити рахунок, або вибрати рахунок') })
          }
        }
      } else {
        event.stopPropagation()
      }

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

  return (
    <Box
      aria-label={t('Майстер нової продажі')}
      role="group"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
      onKeyDown={handleRootKeyDown}
    >
      <WizardSaleHeader
        clientNetId={state.clientNetId}
        reassignDisabled={shellBusy || productsBusy}
        sale={state.sale}
        withVatAccounting={Boolean(
          state.agreement?.Agreement?.WithVATAccounting ?? state.sale?.ClientAgreement?.Agreement?.WithVATAccounting,
        )}
        onReassignOpenChange={setReassignOpen}
        onSaleReassigned={(movedSale) => {
          clearWizardSplitOrderItems()
          clearWizardMergedSale()
          setState((current) => ({ ...current, sale: movedSale ?? current.sale }))
          bumpWizardDebtRefresh()
          setActive(0)
        }}
      />

      <Box style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 4 }}>
        {active === 0 && (
          <NewSaleClientStep
            clientNetId={state.clientNetId}
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
            clientNetId={state.clientNetId}
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

      <Box
        mt="md"
        px="md"
        py={8}
        style={{
          alignItems: 'center',
          background: '#2f3339',
          borderRadius: 10,
          display: 'flex',
          gap: 12,
          minHeight: 56,
        }}
      >
        <Group gap={6} style={{ flex: 1 }} wrap="nowrap">
          <Text c="gray.4" size="xs" style={{ whiteSpace: 'nowrap' }}>
            {t('Стан режиму клавіатури')}:
          </Text>
          {keyboard.label && (
            <Text fw={600} size="xs" style={{ color: '#37a000', whiteSpace: 'nowrap' }}>
              {keyboard.label}
            </Text>
          )}
        </Group>

        <Group gap={10} justify="center" wrap="nowrap">
          {WIZARD_STEPS.map((step, index) => {
            const Icon = step.icon
            const title = t(WIZARD_STEP_TITLES[step.index])
            const isActive = index === active
            const isDone = index < active

            return (
              <Tooltip key={step.index} label={title} position="top">
                <UnstyledButton
                  aria-current={isActive ? 'step' : undefined}
                  aria-label={title}
                  style={{
                    alignItems: 'center',
                    borderBottom: isActive ? '2px solid #37a000' : '2px solid transparent',
                    color: isActive ? '#ffffff' : isDone ? '#37a000' : '#8b9096',
                    display: 'flex',
                    height: 38,
                    justifyContent: 'center',
                    width: 38,
                  }}
                  onClick={() => onStepClick(index)}
                >
                  <Icon size={22} stroke={1.8} />
                </UnstyledButton>
              </Tooltip>
            )
          })}
        </Group>

        <Group gap="xs" justify="flex-end" style={{ flex: 1 }} wrap="nowrap">
          <Button
            color="gray"
            disabled={shellBusy}
            variant="light"
            onClick={active === 0 ? onClose : active === 1 ? goToClients : () => setActive(1)}
          >
            {active === 0 ? t('Скасувати') : t('Назад')}
          </Button>
          <Button color={active === 2 ? 'teal' : undefined} disabled={nextDisabled} loading={busy} onClick={handleNext}>
            {nextLabel}
          </Button>
        </Group>
      </Box>
    </Box>
  )
}

