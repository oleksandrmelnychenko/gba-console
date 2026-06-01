import { Alert, Button, Group, NumberInput, Stack, Textarea } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { updateSaleDiscount } from '../api/salesUkraineApi'
import type { SalesUkraineSale } from '../types'

const NEW_LIFECYCLE_TYPE = 0

export function SaleDiscountModal({
  sale,
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => void
  sale: SalesUkraineSale | null
}) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={Boolean(sale)} size="sm" title={t('Знижка')} onClose={onClose}>
      {sale && <SaleDiscountForm key={sale.NetUid || sale.Id} sale={sale} onCancel={onClose} onSaved={onSaved} />}
    </AppModal>
  )
}

function SaleDiscountForm({
  sale,
  onCancel,
  onSaved,
}: {
  onCancel: () => void
  onSaved: () => void
  sale: SalesUkraineSale
}) {
  const { t } = useI18n()
  const orderItems = Array.isArray(sale.Order?.OrderItems) ? sale.Order.OrderItems : []
  const isReadOnly = sale.BaseLifeCycleStatus?.SaleLifeCycleType !== NEW_LIFECYCLE_TYPE
  const [amount, setAmount] = useState<number | string>(getInitialDiscount(sale))
  const [comment, setComment] = useState(sale.OneTimeDiscountComment || orderItems[0]?.OneTimeDiscountComment || '')
  const [isSaving, setSaving] = useState(false)

  const numericAmount = typeof amount === 'number' ? amount : Number(String(amount).replace(',', '.'))
  const isAmountValid = Number.isFinite(numericAmount) && numericAmount > -100 && numericAmount < 100

  async function save() {
    if (!comment.trim()) {
      notifications.show({ color: 'red', message: t("Коментар обов'язковий") })

      return
    }

    if (!isAmountValid) {
      notifications.show({ color: 'red', message: t('Некоректний відсоток') })

      return
    }

    setSaving(true)

    const payload: SalesUkraineSale = {
      ...sale,
      OneTimeDiscountComment: comment,
      Order: sale.Order
        ? {
            ...sale.Order,
            OrderItems: orderItems.map((item) => ({
              ...item,
              OneTimeDiscount: numericAmount,
              OneTimeDiscountComment: comment,
            })),
          }
        : sale.Order,
    }

    try {
      await updateSaleDiscount(payload)
      notifications.show({ color: 'green', message: t('Знижку збережено') })
      onSaved()
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося зберегти знижку') })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Stack gap="md">
      {isReadOnly && (
        <Alert color="gray" variant="light">
          {t('Знижку можна змінити лише для нового продажу')}
        </Alert>
      )}
      <NumberInput
        allowDecimal
        decimalScale={2}
        disabled={isReadOnly}
        label={t('Відсоток знижки')}
        max={99}
        min={-99}
        suffix=" %"
        value={amount}
        onChange={setAmount}
      />
      <Textarea
        autosize
        disabled={isReadOnly}
        label={t('Коментар')}
        minRows={2}
        value={comment}
        onChange={(event) => setComment(event.currentTarget.value)}
      />
      <Group justify="flex-end">
        <Button color="gray" disabled={isSaving} variant="subtle" onClick={onCancel}>
          {t('Скасувати')}
        </Button>
        <Button disabled={isReadOnly} loading={isSaving} onClick={save}>
          {t('Зберегти')}
        </Button>
      </Group>
    </Stack>
  )
}

function getInitialDiscount(sale: SalesUkraineSale): number | string {
  const firstItem = sale.Order?.OrderItems?.[0]
  const discount = firstItem?.OneTimeDiscount

  return typeof discount === 'number' && discount !== 0 ? discount : ''
}
