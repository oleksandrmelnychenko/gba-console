import { Alert, Button, Group, NumberInput, Stack, Text, Textarea } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { updateSaleDiscount } from '../api/salesUkraineApi'
import { isDiscountEditableSaleLifecycle } from '../saleStatus'
import type { SalesUkraineOrderItem, SalesUkraineSale } from '../types'

export function SaleDiscountModal({
  sale,
  orderItem,
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => void
  orderItem?: SalesUkraineOrderItem | null
  sale: SalesUkraineSale | null
}) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={Boolean(sale)} size="sm" title={t('Знижка')} onClose={onClose}>
      {sale && (
        <SaleDiscountForm
          key={`${sale.NetUid || sale.Id}-${orderItem?.NetUid || orderItem?.Id || 'sale'}`}
          orderItem={orderItem ?? null}
          sale={sale}
          onCancel={onClose}
          onSaved={onSaved}
        />
      )}
    </AppModal>
  )
}

function SaleDiscountForm({
  sale,
  orderItem,
  onCancel,
  onSaved,
}: {
  onCancel: () => void
  onSaved: () => void
  orderItem: SalesUkraineOrderItem | null
  sale: SalesUkraineSale
}) {
  const { t } = useI18n()
  const orderItems = Array.isArray(sale.Order?.OrderItems) ? sale.Order.OrderItems : []
  const isReadOnly = !isDiscountEditableSaleLifecycle(sale.BaseLifeCycleStatus?.SaleLifeCycleType)
  const [amount, setAmount] = useState<number | string>(() => getInitialDiscount(sale, orderItem))
  const [comment, setComment] = useState(() =>
    orderItem ? orderItem.OneTimeDiscountComment || '' : sale.OneTimeDiscountComment || orderItems[0]?.OneTimeDiscountComment || '',
  )
  const [isSaving, setSaving] = useState(false)

  const numericAmount = typeof amount === 'number' ? amount : Number(String(amount).replace(',', '.'))
  const isAmountValid = Number.isFinite(numericAmount) && numericAmount > -100 && numericAmount < 100

  async function save() {
    if (isReadOnly || isSaving) {
      return
    }

    if (!comment.trim()) {
      notifications.show({ color: 'red', message: t("Коментар обов'язковий") })

      return
    }

    if (!isAmountValid) {
      notifications.show({ color: 'red', message: t('Некоректний відсоток') })

      return
    }

    setSaving(true)

    const matchItem = (item: SalesUkraineOrderItem) =>
      Boolean(orderItem) &&
      ((orderItem?.NetUid && item.NetUid === orderItem.NetUid) ||
        (typeof orderItem?.Id === 'number' && item.Id === orderItem.Id))

    const payload: SalesUkraineSale = orderItem
      ? {
          ...sale,
          Order: sale.Order
            ? {
                ...sale.Order,
                OrderItems: orderItems.map((item) =>
                  matchItem(item) ? { ...item, OneTimeDiscount: numericAmount, OneTimeDiscountComment: comment } : item,
                ),
              }
            : sale.Order,
        }
      : {
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
      {orderItem && (
        <Text size="sm" fw={600}>
          {orderItem.Product?.NameUA || orderItem.Product?.Name || orderItem.Product?.VendorCode || ''}
        </Text>
      )}
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

function getInitialDiscount(sale: SalesUkraineSale, orderItem: SalesUkraineOrderItem | null): number | string {
  const discount = orderItem ? orderItem.OneTimeDiscount : sale.Order?.OrderItems?.[0]?.OneTimeDiscount

  return typeof discount === 'number' && discount !== 0 ? discount : ''
}
