import { Box, Button, Group, Modal, Text, Tooltip, UnstyledButton } from '@mantine/core'
import { IconBox, IconTruckDelivery, IconUser } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useEffect, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import {
  convertVatSaleAndGetPaymentDocument,
  createSale,
  getCurrentSaleCart,
  getSaleById,
  updateSaleFromData,
} from '../../api/salesUkraineApi'
import type { SalesUkraineSale } from '../../types'
import { NewSaleClientStep } from './NewSaleClientStep'
import { NewSaleProductsStep } from './NewSaleProductsStep'
import { NewSaleReviewStep } from './NewSaleReviewStep'
import {
  newDeliveryRecipient,
  newDeliveryRecipientAddress,
  type WizardDeliveryRecipient,
  type WizardDeliveryRecipientAddress,
} from './newSaleWizardApi'
import {
  canAdvanceToProducts,
  canAdvanceToReview,
  getCartItemCount,
  getReviewError,
  hasDeliveryAddressDraft,
  isSelfCheckout,
  NEW_SALE_REVIEW_INITIAL,
  NEW_SALE_WIZARD_INITIAL,
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
import { WizardSaleHeader } from './WizardSaleHeader'

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'

export function NewSaleWizard({
  opened,
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (sale: SalesUkraineSale) => void
  opened: boolean
}) {
  const { t } = useI18n()

  return (
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
      onClose={onClose}
    >
      {opened && <NewSaleWizardContent onClose={onClose} onCreated={onCreated} />}
    </Modal>
  )
}

const WIZARD_STEPS: { icon: typeof IconUser; index: WizardStepIndex }[] = [
  { icon: IconUser, index: 0 },
  { icon: IconBox, index: 1 },
  { icon: IconTruckDelivery, index: 2 },
]

function NewSaleWizardContent({ onClose, onCreated }: { onClose: () => void; onCreated: (sale: SalesUkraineSale) => void }) {
  const { t } = useI18n()
  const [active, setActive] = useState(0)
  const [state, setState] = useState<NewSaleWizardState>(NEW_SALE_WIZARD_INITIAL)
  const [review, setReview] = useState<NewSaleReviewValue>(NEW_SALE_REVIEW_INITIAL)
  const [busy, setBusy] = useState(false)
  const keyboard = useWizardKeyboardSnapshot()

  useEffect(() => {
    initializeWizardKeyboard(active as WizardStepIndex)
  }, [active])

  async function reloadCart() {
    const netId = state.sale?.NetUid

    if (!netId) {
      return
    }

    const next = await getSaleById(netId)

    if (next) {
      setState((current) => ({ ...current, sale: next }))
    }
  }

  async function goToProducts() {
    if (!canAdvanceToProducts(state) || !state.agreementNetId) {
      return
    }

    setBusy(true)

    try {
      let cart = await getCurrentSaleCart(state.agreementNetId)

      if (!cart?.NetUid) {
        cart = await createSale({ ClientAgreement: state.agreement ?? undefined })
      }

      if (!cart?.NetUid) {
        notifications.show({ color: 'red', message: t('Не вдалося створити кошик') })

        return
      }

      setState((current) => ({ ...current, sale: cart }))
      setActive(1)
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося створити кошик') })
    } finally {
      setBusy(false)
    }
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
      await finalize()
    }
  }

  async function finalize() {
    if (!state.sale) {
      return
    }

    const reviewError = getReviewError(review)

    if (reviewError) {
      notifications.show({ color: 'orange', message: t(reviewError) })

      return
    }

    setBusy(true)

    try {
      const selfCheckout = isSelfCheckout(review.transporter)
      const payload: SalesUkraineSale = {
        ...state.sale,
        Comment: review.comment || state.sale.Comment,
        Transporter: review.transporter ?? state.sale.Transporter,
        TransporterId: review.transporter?.Id ?? state.sale.TransporterId,
      }

      if (!selfCheckout) {
        const recipient = await resolveDeliveryRecipient(review, state)
        const address = await resolveDeliveryAddress(review, recipient)

        payload.DeliveryRecipient = recipient
          ? ({ ...recipient, MobilePhone: review.mobilePhone || recipient.MobilePhone } as SalesUkraineSale['DeliveryRecipient'])
          : recipient
        payload.DeliveryRecipientAddress = address
          ? ({
              ...address,
              City: review.city || address.City,
              Department: review.department || address.Department,
              Value: review.addressValue || address.Value,
            } as SalesUkraineSale['DeliveryRecipientAddress'])
          : address
        payload.DeliveryRecipientAddressId = address?.Id ?? state.sale.DeliveryRecipientAddressId
        payload.IsCashOnDelivery = review.isCashOnDelivery
        payload.CashOnDeliveryAmount = review.isCashOnDelivery ? toAmount(review.codAmount) : state.sale.CashOnDeliveryAmount
        payload.TTN = review.hasOwnTtn ? review.ttnNumber || state.sale.TTN : state.sale.TTN
        payload.CustomersOwnTtn =
          review.hasOwnTtn && review.ttnNumber ? { Number: review.ttnNumber } : state.sale.CustomersOwnTtn
      }

      payload.BaseLifeCycleStatus = { Deleted: false, Id: 0, NetUid: EMPTY_GUID, SaleLifeCycleType: 1 }
      payload.BaseSalePaymentStatus = { Deleted: false, Id: 0, NetUid: EMPTY_GUID, SalePaymentStatusType: 0 }
      payload.IsPrintedPaymentInvoice = true

      const file = !selfCheckout && review.hasOwnTtn ? review.ttnFile : null

      if (payload.IsVatSale) {
        const document = await convertVatSaleAndGetPaymentDocument(payload, file)
        const url = document.pdfUrl || document.excelUrl

        if (url) {
          window.open(url, '_blank', 'noopener,noreferrer')
        }
      } else {
        await updateSaleFromData(payload, file)
      }

      notifications.show({ color: 'green', message: t('Продаж створено') })
      onCreated(state.sale)
      onClose()
    } catch (finalizeError) {
      notifications.show({
        color: 'red',
        message: finalizeError instanceof Error ? t(finalizeError.message) : t('Не вдалося завершити продаж'),
      })
    } finally {
      setBusy(false)
    }
  }

  function onStepClick(index: number) {
    if (index < active) {
      setActive(index)

      return
    }

    if (index === 1) {
      void goToProducts()
    } else if (index === 2) {
      goToReview()
    }
  }

  const nextDisabled =
    busy ||
    (active === 0 && !canAdvanceToProducts(state)) ||
    (active === 1 && getCartItemCount(state.sale) === 0)
  const nextLabel = active === 2 ? t('Створити продаж') : t('Далі')

  function handleRootKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.altKey) {
      if (event.code === 'Digit1') {
        event.preventDefault()
        event.stopPropagation()

        if (!busy) {
          setActive(0)
        }
      } else if (event.code === 'Digit2') {
        event.preventDefault()
        event.stopPropagation()

        if (!busy && canAdvanceToProducts(state)) {
          void goToProducts()
        }
      } else if (event.code === 'Digit3') {
        event.preventDefault()
        event.stopPropagation()

        if (!busy && canAdvanceToProducts(state)) {
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
        sale={state.sale}
        withVatAccounting={Boolean(
          state.agreement?.Agreement?.WithVATAccounting ?? state.sale?.ClientAgreement?.Agreement?.WithVATAccounting,
        )}
      />

      <Box style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 4 }}>
        {active === 0 && (
          <NewSaleClientStep
            agreementNetId={state.agreementNetId}
            clientNetId={state.clientNetId}
            onAgreementChange={(agreementNetId, agreement) => setState((current) => ({ ...current, agreement, agreementNetId }))}
            onClientChange={(clientNetId) => setState((current) => ({ ...current, clientNetId }))}
            onRequestClose={onClose}
          />
        )}
        {active === 1 && (
          <NewSaleProductsStep
            agreementNetId={state.agreementNetId}
            clientNetId={state.clientNetId}
            sale={state.sale}
            onCartChanged={reloadCart}
            onRequestClose={onClose}
          />
        )}
        {active === 2 && (
          <NewSaleReviewStep
            clientNetId={state.clientNetId}
            sale={state.sale}
            value={review}
            onChange={(patch) => setReview((current) => ({ ...current, ...patch }))}
            onClose={onClose}
            onCreated={onCreated}
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
            disabled={busy}
            variant="light"
            onClick={active === 0 ? onClose : () => setActive((index) => Math.max(0, index - 1))}
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

async function resolveDeliveryRecipient(
  review: NewSaleReviewValue,
  state: NewSaleWizardState,
): Promise<WizardDeliveryRecipient | SalesUkraineSale['DeliveryRecipient'] | null> {
  if (!review.isNewRecipient) {
    return review.recipient ?? state.sale?.DeliveryRecipient ?? null
  }

  const clientId = state.agreement?.Client?.Id ?? state.sale?.ClientAgreement?.Client?.Id

  if (!clientId) {
    throw new Error('Не вдалося визначити клієнта для отримувача')
  }

  const recipient = await newDeliveryRecipient({
    ClientId: clientId,
    FullName: review.recipientName.trim(),
    MobilePhone: review.mobilePhone.trim(),
  })

  if (!recipient?.Id) {
    throw new Error('Не вдалося створити отримувача')
  }

  return recipient
}

async function resolveDeliveryAddress(
  review: NewSaleReviewValue,
  recipient: WizardDeliveryRecipient | SalesUkraineSale['DeliveryRecipient'] | null,
): Promise<WizardDeliveryRecipientAddress | SalesUkraineSale['DeliveryRecipientAddress'] | null> {
  if (!review.isNewAddress && review.address) {
    return review.address
  }

  if (!hasDeliveryAddressDraft(review)) {
    return null
  }

  if (!recipient?.Id) {
    throw new Error('Не вдалося визначити отримувача для адреси')
  }

  const address = await newDeliveryRecipientAddress({
    City: review.city.trim(),
    DeliveryRecipient: recipient as WizardDeliveryRecipient,
    DeliveryRecipientId: recipient.Id,
    Department: review.department.trim(),
    Value: review.addressValue.trim(),
  })

  if (!address?.Id) {
    throw new Error('Не вдалося створити адресу доставки')
  }

  return address
}

function toAmount(value: number | string): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))

  return Number.isFinite(parsed) ? parsed : undefined
}
