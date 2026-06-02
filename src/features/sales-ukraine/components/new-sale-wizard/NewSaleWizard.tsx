import { Box, Button, Group, Stepper } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { AppModal } from '../../../../shared/ui/AppModal'
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
    <AppModal centered opened={opened} size="min(1100px, 96vw)" title={t('Нова продажа')} onClose={onClose}>
      {opened && <NewSaleWizardContent onClose={onClose} onCreated={onCreated} />}
    </AppModal>
  )
}

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
      <Stepper active={active} size="sm" onStepClick={onStepClick}>
        <Stepper.Step label={t('Клієнт')} description={t('Клієнт і договір')}>
          <NewSaleClientStep
            agreementNetId={state.agreementNetId}
            clientNetId={state.clientNetId}
            onAgreementChange={(agreementNetId, agreement) => setState((current) => ({ ...current, agreement, agreementNetId }))}
            onClientChange={(clientNetId) => setState((current) => ({ ...current, clientNetId }))}
          />
        </Stepper.Step>
        <Stepper.Step label={t('Товари')} description={t('Кошик')}>
          <NewSaleProductsStep agreementNetId={state.agreementNetId} sale={state.sale} onCartChanged={reloadCart} />
        </Stepper.Step>
        <Stepper.Step label={t('Рев’ю')} description={t('Перевізник і підтвердження')}>
          <NewSaleReviewStep
            clientNetId={state.clientNetId}
            sale={state.sale}
            value={review}
            onChange={(patch) => setReview((current) => ({ ...current, ...patch }))}
          />
        </Stepper.Step>
      </Stepper>

      <Group justify="space-between" mt="lg">
        <Button color="gray" disabled={busy} variant="subtle" onClick={active === 0 ? onClose : () => setActive((index) => Math.max(0, index - 1))}>
          {active === 0 ? t('Скасувати') : t('Назад')}
        </Button>
        <Button color={active === 2 ? 'teal' : undefined} disabled={nextDisabled} loading={busy} onClick={handleNext}>
          {nextLabel}
        </Button>
      </Group>
    </Box>
  )
}
