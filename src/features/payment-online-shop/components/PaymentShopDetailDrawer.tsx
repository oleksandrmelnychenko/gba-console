import {
  Alert,
  Badge,
  Button,
  FileInput,
  Group,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core'
import { CircleAlert } from 'lucide-react'
import { useMemo } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { PaymentImageList } from './PaymentImageList'
import { PaymentShopOrderItemsTable } from './PaymentShopOrderItemsTable'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import {
  PaymentType,
  RetailPaymentStatusType,
  type AddPaymentImagePayload,
  type PaymentShopItem,
  type PaymentTypeValue,
  type RetailClientPaymentImageItem,
} from '../types'
import {
  getRetailPaymentStatusPresentation,
  isRetailPaymentManagerConfirmed,
} from '../retailPaymentStatus'

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short', timeStyle: 'short' })

export type PaymentShopDetailDrawerProps = {
  createError: string | null
  isCreating: boolean
  item: PaymentShopItem | null
  onAddPayment: (
    payload: Omit<AddPaymentImagePayload, 'paymentImageId' | 'user'>,
  ) => Promise<boolean>
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
  const [validationError, setValidationError] = useValueState<string | null>(null)

  const statusType = item?.RetailPaymentStatus?.RetailPaymentStatusType
  const isEditing = statusType !== RetailPaymentStatusType.Paid
  const items = useMemo(() => item?.RetailClientPaymentImageItems || [], [item?.RetailClientPaymentImageItems])
  const orderItems = useMemo(() => item?.Sale?.Order?.OrderItems || [], [item?.Sale?.Order?.OrderItems])

  const paymentTypeOptions = [
    { label: t('Передплата'), value: String(PaymentType.Prepayment) },
    { label: t('Накладений платіж'), value: String(PaymentType.CashOnDelivery) },
  ]

  function handleClose() {
    setDraft(INITIAL_DRAFT)
    setValidationError(null)
    onClose()
  }

  async function handleCreate() {
    const amount = typeof draft.amount === 'number' ? draft.amount : Number.parseFloat(String(draft.amount))

    if (!(amount > 0)) {
      setValidationError(t('Вкажіть суму оплати або передплати'))
      return
    }

    if (draft.paymentType === null) {
      setValidationError(t('Оберіть тип оплати'))
      return
    }

    if (!draft.image) {
      setValidationError(t('Додайте зображення підтвердження оплати'))
      return
    }

    setValidationError(null)

    const created = await onAddPayment({
      amount,
      comment: draft.comment,
      image: draft.image,
      paymentType: draft.paymentType,
    })

    if (created) {
      setDraft(INITIAL_DRAFT)
    }
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
          <PaymentStatusSummary item={item} />
          <PaymentImageList isEditing={isEditing} items={items} onSelect={onEditItem} />

          {isEditing && (
            <Stack gap="sm">
              <Title order={4}>{t('Підтвердження оплати менеджером')}</Title>

              {(createError || validationError) && (
                <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
                  {createError || validationError}
                </Alert>
              )}

              {!isRetailPaymentManagerConfirmed(statusType) && (
                <Text c="dimmed" size="sm">
                  {t('Після збереження суми статус стане підтвердженим, і рахунок можна буде змінити на накладну.')}
                </Text>
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
                onChange={(event) => { const nextValue = event.currentTarget.value; setDraft((current) => ({ ...current, comment: nextValue })) }}
              />
              <FileInput
                accept="image/*"
                label={t('Зображення')}
                value={draft.image}
                onChange={(value) => setDraft((current) => ({ ...current, image: value }))}
              />
              <Group justify="flex-end">
                <Button color={CREATE_ACTION_COLOR} loading={isCreating} onClick={() => void handleCreate()}>
                  {t('Підтвердити оплату')}
                </Button>
              </Group>
            </Stack>
          )}
        </Stack>
      </Group>
    </AppDrawer>
  )
}

function PaymentStatusSummary({ item }: { item: PaymentShopItem | null }) {
  const { t } = useI18n()
  const status = getRetailPaymentStatusPresentation(
    item?.RetailPaymentStatus?.RetailPaymentStatusType,
  )

  return (
    <Paper p="md" radius="md" withBorder>
      <Stack gap="sm">
        <Group justify="space-between">
          <Text fw={600}>{t('Статус оплати')}</Text>
          <Badge color={status.color} variant="light">
            {t(status.label)}
          </Badge>
        </Group>
        <SimpleGrid cols={3} spacing="sm">
          <PaymentAmountMetric
            label={t('Підтверджено менеджером')}
            value={item?.RetailPaymentStatus?.Amount}
          />
          <PaymentAmountMetric
            label={t('Проведено бухгалтерією')}
            value={item?.RetailPaymentStatus?.PaidAmount}
          />
          <PaymentAmountMetric
            label={t('Залишок до оплати')}
            value={item?.RetailPaymentStatus?.AmountToPay}
          />
        </SimpleGrid>
      </Stack>
    </Paper>
  )
}

function PaymentAmountMetric({ label, value }: { label: string; value: number | undefined }) {
  return (
    <Stack gap={2}>
      <Text c="dimmed" size="xs">
        {label}
      </Text>
      <Text fw={600}>{formatAmount(value)} UAH</Text>
    </Stack>
  )
}

const paymentAmountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

function formatAmount(value: number | undefined): string {
  return paymentAmountFormatter.format(value ?? 0)
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
