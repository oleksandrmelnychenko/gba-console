import {
  Alert,
  Button,
  FileInput,
  Group,
  NumberInput,
  Select,
  Stack,
  Textarea,
  Title,
} from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useMemo } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { PaymentImageList } from './PaymentImageList'
import { PaymentShopOrderItemsTable } from './PaymentShopOrderItemsTable'
import {
  PaymentType,
  RetailPaymentStatusType,
  type AddPaymentImagePayload,
  type PaymentShopItem,
  type PaymentTypeValue,
  type RetailClientPaymentImageItem,
} from '../types'

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short', timeStyle: 'short' })

export type PaymentShopDetailDrawerProps = {
  createError: string | null
  isCreating: boolean
  item: PaymentShopItem | null
  onAddPayment: (payload: Omit<AddPaymentImagePayload, 'paymentImageId' | 'user'>) => void
  onClose: () => void
  onEditItem: (item: RetailClientPaymentImageItem) => void
}

type CreateFormDraft = {
  amount: number | string
  comment: string
  image: File | null
  paymentType: PaymentTypeValue | null
}

const INITIAL_DRAFT: CreateFormDraft = {
  amount: '',
  comment: '',
  image: null,
  paymentType: null,
}

export function PaymentShopDetailDrawer({
  createError,
  isCreating,
  item,
  onAddPayment,
  onClose,
  onEditItem,
}: PaymentShopDetailDrawerProps) {
  const { t } = useI18n()
  const [draft, setDraft] = useValueState<CreateFormDraft>(INITIAL_DRAFT)

  const statusType = item?.RetailPaymentStatus?.RetailPaymentStatusType
  const isEditing = statusType !== RetailPaymentStatusType.Paid
  const items = useMemo(() => item?.RetailClientPaymentImageItems || [], [item?.RetailClientPaymentImageItems])
  const orderItems = useMemo(() => item?.Sale?.Order?.OrderItems || [], [item?.Sale?.Order?.OrderItems])

  const paymentTypeOptions = [
    { label: t('Предоплата'), value: String(PaymentType.Prepayment) },
    { label: t('Наложений платіж'), value: String(PaymentType.CashOnDelivery) },
  ]

  function handleClose() {
    setDraft(INITIAL_DRAFT)
    onClose()
  }

  function handleCreate() {
    const amount = typeof draft.amount === 'number' ? draft.amount : Number.parseFloat(String(draft.amount))

    if (!(amount > 0) || draft.paymentType === null || !draft.image) {
      return
    }

    onAddPayment({
      amount,
      comment: draft.comment,
      image: draft.image,
      paymentType: draft.paymentType,
    })
    setDraft(INITIAL_DRAFT)
  }

  return (
    <AppDrawer opened={Boolean(item)} padding="lg" position="right" size="86rem" title={getDrawerTitle(item, t)} onClose={handleClose}>
      <Group align="flex-start" gap="lg" grow wrap="nowrap">
        <Stack gap="md" style={{ flex: 1.4 }}>
          <PaymentShopOrderItemsTable
            currencyCode="EUR"
            localCurrencyCode="UAH"
            orders={orderItems}
            sale={item?.Sale || null}
          />
        </Stack>

        <Stack gap="md" style={{ flex: 1 }}>
          <PaymentImageList isEditing={isEditing} items={items} onSelect={onEditItem} />

          {isEditing && (
            <Stack gap="sm">
              <Title order={4}>{t('Створення підтвердження оплати')}</Title>

              {createError && (
                <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
                  {createError}
                </Alert>
              )}

              <NumberInput
                decimalScale={2}
                label={t('Сума')}
                min={0}
                value={draft.amount}
                onChange={(value) => setDraft((current) => ({ ...current, amount: value }))}
              />
              <Select
                data={paymentTypeOptions}
                label={t('Тип')}
                value={draft.paymentType === null ? null : String(draft.paymentType)}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    paymentType: value === null ? null : (Number(value) as PaymentTypeValue),
                  }))
                }
              />
              <Textarea
                label={t('Коментар')}
                value={draft.comment}
                onChange={(event) => setDraft((current) => ({ ...current, comment: event.currentTarget.value }))}
              />
              <FileInput
                label={t('Зображення')}
                value={draft.image}
                onChange={(value) => setDraft((current) => ({ ...current, image: value }))}
              />
              <Group justify="flex-end">
                <Button color="violet" loading={isCreating} onClick={handleCreate}>
                  {t('Створити')}
                </Button>
              </Group>
            </Stack>
          )}
        </Stack>
      </Group>
    </AppDrawer>
  )
}

function getDrawerTitle(item: PaymentShopItem | null, t: (value: string) => string): string {
  if (!item?.Sale) {
    return ''
  }

  const sale = item.Sale
  const dateValue = sale.ChangedToInvoice || sale.Created
  const datePart = dateValue ? formatDateTime(dateValue) : ''
  const numberPart = sale.SaleNumber?.Value || ' --- '
  const clientName = item.RetailClient?.Name || ''
  const clientPhone = item.RetailClient?.PhoneNumber || ''

  return `${datePart} ${t('Номер')}: ${numberPart} ${t('Оплата')} від: ${clientName} (${clientPhone})`.trim()
}

function formatDateTime(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return dateTimeFormatter.format(date)
}
