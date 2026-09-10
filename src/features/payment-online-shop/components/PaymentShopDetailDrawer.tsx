import {
  Alert,
  Badge,
  Button,
  FileInput,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
} from '@mantine/core'
import { CircleAlert } from 'lucide-react'
import { useMemo } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DocumentDetailLayout, DocumentDetailSummary, DocumentDetailMetric, DocumentDetailSection, DocumentDetailRow } from '../../../shared/ui/document-detail/DocumentDetail'
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
  canCreatePayment: boolean
  canEditPayment: boolean
  createError: string | null
  createNotice: string | null
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
  canCreatePayment,
  canEditPayment,
  createError,
  createNotice,
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

  const status = getRetailPaymentStatusPresentation(statusType)
  const sale = item?.Sale
  const date = sale?.ChangedToInvoice || sale?.Created

  return (
    <AppDrawer opened={Boolean(item)} padding="md" position="right" size="xl" title={t('Оплата магазину')} onClose={handleClose}>
      <DocumentDetailLayout summary={
        <DocumentDetailSummary
          eyebrow={t('Документ')}
          title={sale?.SaleNumber?.Value || '—'}
          meta={<>{date ? formatDateTime(date) : '—'} · {item?.RetailClient?.Name || '—'}</>}
          metrics={<>
            <DocumentDetailMetric label={t('Підтверджено менеджером')} value={formatAmount(item?.RetailPaymentStatus?.Amount)} suffix="UAH" />
            <DocumentDetailMetric label={t('Проведено бухгалтерією')} value={formatAmount(item?.RetailPaymentStatus?.PaidAmount)} suffix="UAH" />
            <DocumentDetailMetric label={t('Залишок до оплати')} value={formatAmount(item?.RetailPaymentStatus?.AmountToPay)} suffix="UAH" />
          </>}
        />
      }>
        <DocumentDetailSection title={t('Документ')} subtitle={sale?.SaleNumber?.Value}>
          <DocumentDetailRow label={t('Дата')} value={date ? formatDateTime(date) : null} />
          <DocumentDetailRow label={t('Номер')} value={sale?.SaleNumber?.Value} mono />
          <DocumentDetailRow label={t('Клієнт')} value={item?.RetailClient?.Name} />
          <DocumentDetailRow label={t('Телефон')} value={item?.RetailClient?.PhoneNumber} mono />
        </DocumentDetailSection>
        <DocumentDetailSection title={t('Статус оплати')} stacked>
          <Group><Badge color={status.color} variant="light">{t(status.label)}</Badge></Group>
        </DocumentDetailSection>
        <DocumentDetailSection title={t('Товари')} subtitle={String(orderItems.length)} stacked>
          <PaymentShopOrderItemsTable currencyCode="EUR" localCurrencyCode="UAH" orders={orderItems} sale={sale || null} />
        </DocumentDetailSection>
        <DocumentDetailSection title={t('Підтвердження оплат')} subtitle={String(items.length)} stacked>
          <PaymentImageList canEdit={canEditPayment} isEditing={isEditing} items={items} onSelect={onEditItem} />
        </DocumentDetailSection>
        {isEditing && canCreatePayment && (
          <DocumentDetailSection title={t('Підтвердження оплати менеджером')} stacked>
            <Stack gap="sm">
              {createNotice && (
                <Alert color="yellow" icon={<CircleAlert size={18} />} variant="light">
                  {createNotice}
                </Alert>
              )}

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

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
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
              </SimpleGrid>
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
          </DocumentDetailSection>
        )}
      </DocumentDetailLayout>
    </AppDrawer>
  )
}

const paymentAmountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

function formatAmount(value: number | undefined): string {
  return paymentAmountFormatter.format(value ?? 0)
}

function formatDateTime(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return dateTimeFormatter.format(date)
}
