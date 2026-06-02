import { Box, Button, Group, Modal, Text, UnstyledButton } from '@mantine/core'
import { IconBox, IconShoppingCart, IconUser } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { createSale, getCurrentSaleCart, getSaleById } from '../../api/salesUkraineApi'
import type { SalesUkraineSale } from '../../types'
import { NewSaleClientStep } from './NewSaleClientStep'
import { NewSaleProductsStep } from './NewSaleProductsStep'
import { NewSaleReviewStep } from './NewSaleReviewStep'
import { setSaleCarrier } from './newSaleWizardApi'
import {
  canAdvanceToProducts,
  canAdvanceToReview,
  getCartItemCount,
  getReviewError,
  NEW_SALE_REVIEW_INITIAL,
  NEW_SALE_WIZARD_INITIAL,
  type NewSaleReviewValue,
  type NewSaleWizardState,
} from './newSaleWizardState'

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
      padding="lg"
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
        },
        body: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
      }}
      onClose={onClose}
    >
      {opened && <NewSaleWizardContent onClose={onClose} onCreated={onCreated} />}
    </Modal>
  )
}

const WIZARD_STEPS = [
  { icon: IconUser, label: 'Клієнт' },
  { icon: IconBox, label: 'Товари' },
  { icon: IconShoppingCart, label: 'Рев’ю' },
]

function NewSaleWizardContent({ onClose, onCreated }: { onClose: () => void; onCreated: (sale: SalesUkraineSale) => void }) {
  const { t } = useI18n()
  const [active, setActive] = useState(0)
  const [state, setState] = useState<NewSaleWizardState>(NEW_SALE_WIZARD_INITIAL)
  const [review, setReview] = useState<NewSaleReviewValue>(NEW_SALE_REVIEW_INITIAL)
  const [busy, setBusy] = useState(false)

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
      const payload: SalesUkraineSale = {
        ...state.sale,
        Comment: review.comment || state.sale.Comment,
        DeliveryRecipient: (review.recipient ?? state.sale.DeliveryRecipient) as SalesUkraineSale['DeliveryRecipient'],
        DeliveryRecipientAddress: (review.address ?? state.sale.DeliveryRecipientAddress) as SalesUkraineSale['DeliveryRecipientAddress'],
        Transporter: review.transporter ?? state.sale.Transporter,
        TransporterId: review.transporter?.Id ?? state.sale.TransporterId,
      }
      const updated = await setSaleCarrier(payload, null)
      notifications.show({ color: 'green', message: t('Продаж створено') })
      onCreated(updated ?? state.sale)
      onClose()
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося завершити продаж') })
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

  return (
    <Box
      aria-label={t('Майстер нової продажі')}
      role="group"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
      onKeyDown={(event) => {
        if (event.altKey && event.key === '1') {
          setActive(0)
        } else if (event.altKey && event.key === '2') {
          void goToProducts()
        } else if (event.altKey && event.key === '3') {
          goToReview()
        } else if (event.ctrlKey && event.key === 'Enter' && !nextDisabled) {
          void handleNext()
        }
      }}
    >
      <Box style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 4 }}>
        {active === 0 && (
          <NewSaleClientStep
            agreementNetId={state.agreementNetId}
            clientNetId={state.clientNetId}
            onAgreementChange={(agreementNetId, agreement) => setState((current) => ({ ...current, agreement, agreementNetId }))}
            onClientChange={(clientNetId) => setState((current) => ({ ...current, clientNetId }))}
          />
        )}
        {active === 1 && (
          <NewSaleProductsStep agreementNetId={state.agreementNetId} sale={state.sale} onCartChanged={reloadCart} />
        )}
        {active === 2 && (
          <NewSaleReviewStep
            clientNetId={state.clientNetId}
            sale={state.sale}
            value={review}
            onChange={(patch) => setReview((current) => ({ ...current, ...patch }))}
          />
        )}
      </Box>

      <Group
        justify="space-between"
        align="center"
        mt="md"
        pt="md"
        style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}
      >
        <Button
          color="gray"
          disabled={busy}
          variant="subtle"
          onClick={active === 0 ? onClose : () => setActive((index) => Math.max(0, index - 1))}
        >
          {active === 0 ? t('Скасувати') : t('Назад')}
        </Button>

        <Group gap={6}>
          {WIZARD_STEPS.map((step, index) => {
            const Icon = step.icon
            const isActive = index === active
            const isDone = index < active

            return (
              <UnstyledButton
                key={step.label}
                aria-current={isActive ? 'step' : undefined}
                aria-label={t(step.label)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                  padding: '4px 16px',
                  borderRadius: 10,
                  color: isActive
                    ? 'var(--mantine-color-violet-7)'
                    : isDone
                      ? 'var(--mantine-color-teal-7)'
                      : 'var(--mantine-color-gray-5)',
                  background: isActive ? 'var(--mantine-color-violet-0)' : 'transparent',
                }}
                onClick={() => onStepClick(index)}
              >
                <Icon size={20} stroke={1.8} />
                <Text fw={600} size="xs">
                  {t(step.label)}
                </Text>
              </UnstyledButton>
            )
          })}
        </Group>

        <Button color={active === 2 ? 'teal' : undefined} disabled={nextDisabled} loading={busy} onClick={handleNext}>
          {nextLabel}
        </Button>
      </Group>
    </Box>
  )
}
