import { Alert, Button, Group, NumberInput, Stack, Text, Textarea } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { getSaleById, updateSaleDiscount } from '../api/salesUkraineApi'
import {
  getSaleLifecycleTypeKey,
  isDiscountEditableSaleLifecycle,
  isDiscountPercentageEditableSaleLifecycle,
} from '../saleStatus'
import type { SalesUkraineOrderItem, SalesUkraineSale } from '../types'
import { usePersistentSaleJsonMutation } from '../usePersistentSaleJsonMutation'
import {
  buildSaleDiscountPayload,
  findSaleOrderItemByIdentity,
  hasSaleDiscountBaselineConflict,
} from './saleDiscountPayload'
import './sale-discount-modal.css'

export function SaleDiscountModal({
  sale,
  orderItem,
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: (sale: SalesUkraineSale | null) => void
  orderItem?: SalesUkraineOrderItem | null
  sale: SalesUkraineSale | null
}) {
  const { t } = useI18n()

  return (
    <AppModal
      centered
      className="sale-discount-modal"
      opened={Boolean(sale)}
      size="sm"
      title={<span className="sale-discount-modal__title">{t('Знижка')}</span>}
      onClose={onClose}
    >
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
  onSaved: (sale: SalesUkraineSale | null) => void
  orderItem: SalesUkraineOrderItem | null
  sale: SalesUkraineSale
}) {
  const { t } = useI18n()
  const lifecycle = sale.BaseLifeCycleStatus?.SaleLifeCycleType ?? sale.BaseLifeCycleStatus?.Name
  const canEditComment = isDiscountEditableSaleLifecycle(lifecycle)
  const canEditPercentage = isDiscountPercentageEditableSaleLifecycle(lifecycle)
  const isPackaging = getSaleLifecycleTypeKey(lifecycle) === '1'
  const [amount, setAmount] = useState<number | string>(() => getInitialDiscount(sale, orderItem, isPackaging))
  const [comment, setComment] = useState(() =>
    orderItem ? orderItem.OneTimeDiscountComment || '' : sale.OneTimeDiscountComment || '',
  )
  const [isSaving, setSaving] = useState(false)
  const discountMutation = usePersistentSaleJsonMutation(
    `sale-discount:${String(sale.NetUid || sale.Id || '')}:${String(
      orderItem?.NetUid || orderItem?.Id || 'sale',
    )}`,
    'sale-discount',
  )

  const numericAmount = typeof amount === 'number' ? amount : Number(String(amount).replace(',', '.'))
  const isAmountValid = Number.isFinite(numericAmount) && numericAmount > -100 && numericAmount < 100

  async function save() {
    if (!canEditComment || isSaving) {
      return
    }

    setSaving(true)

    try {
      if (discountMutation.hasPendingOperation()) {
        const replayPayload = buildSaleDiscountPayload(
          sale,
          orderItem,
          numericAmount,
          comment,
          canEditPercentage,
        )
        const replay = await discountMutation.run(replayPayload, updateSaleDiscount)

        if (!replay.completed) {
          return
        }

        notifications.show({ color: 'green', message: t(isPackaging ? 'Коментар збережено' : 'Знижку збережено') })
        onSaved(replay.result)

        return
      }

      if (!comment.trim()) {
        notifications.show({ color: 'red', message: t("Коментар обов'язковий") })

        return
      }

      if (canEditPercentage && !isAmountValid) {
        notifications.show({ color: 'red', message: t('Некоректний відсоток') })

        return
      }

      if (!sale.NetUid) {
        throw new Error('Продаж не має збереженого ідентифікатора')
      }

      const freshSale = await getSaleById(sale.NetUid)

      if (!freshSale) {
        throw new Error('Не вдалося повторно завантажити продаж')
      }

      if (hasSaleDiscountBaselineConflict(sale, orderItem, freshSale)) {
        notifications.show({
          color: 'orange',
          message: t('Знижку вже змінив інший користувач. Закрийте форму та відкрийте її повторно'),
        })

        return
      }

      const freshOrderItem = orderItem ? findSaleOrderItemByIdentity(freshSale, orderItem) : null
      const payload = buildSaleDiscountPayload(freshSale, freshOrderItem, numericAmount, comment, canEditPercentage)
      const result = await discountMutation.run(payload, updateSaleDiscount)

      if (!result.completed) {
        return
      }

      notifications.show({ color: 'green', message: t(isPackaging ? 'Коментар збережено' : 'Знижку збережено') })
      onSaved(result.result)
    } catch (saveError) {
      notifications.show({
        color: 'red',
        message: saveError instanceof Error && saveError.message.trim()
          ? saveError.message
          : t('Не вдалося зберегти знижку'),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Stack gap="md">
      {orderItem && (
        <Text className="sale-discount-modal__product-name">
          {orderItem.Product?.NameUA || orderItem.Product?.Name || orderItem.Product?.VendorCode || ''}
        </Text>
      )}
      {isPackaging && (
        <Alert color="blue" variant="light">
          {t('Відсоток знижки зафіксовано на етапі пакування. Можна змінити лише коментар')}
        </Alert>
      )}
      {!canEditComment && (
        <Alert color="gray" variant="light">
          {t('Знижку можна змінити лише для нового продажу')}
        </Alert>
      )}
      {discountMutation.pendingError && (
        <Alert color="orange" variant="light">
          {discountMutation.pendingError}
        </Alert>
      )}
      <NumberInput
        allowDecimal
        decimalScale={2}
        disabled={!canEditPercentage || discountMutation.hasPending}
        label={t('Відсоток знижки')}
        max={99}
        min={-99}
        suffix=" %"
        value={amount}
        onChange={setAmount}
      />
      <Textarea
        autosize
        disabled={!canEditComment || discountMutation.hasPending}
        label={t('Коментар')}
        minRows={2}
        value={comment}
        onChange={(event) => setComment(event.currentTarget.value)}
      />
      <Group justify="flex-end">
        <Button color="gray" disabled={isSaving} variant="subtle" onClick={onCancel}>
          {t('Скасувати')}
        </Button>
        <Button color={CREATE_ACTION_COLOR} disabled={!canEditComment} loading={isSaving} onClick={save}>
          {t('Зберегти')}
        </Button>
      </Group>
    </Stack>
  )
}

function getInitialDiscount(
  sale: SalesUkraineSale,
  orderItem: SalesUkraineOrderItem | null,
  showZero: boolean,
): number | string {
  const discount = orderItem ? orderItem.OneTimeDiscount : sale.Order?.OrderItems?.[0]?.OneTimeDiscount

  return typeof discount === 'number' && (discount !== 0 || showZero) ? discount : ''
}
