import {
  Alert,
  Anchor,
  Button,
  Group,
  Image,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
} from '@mantine/core'
import { CircleAlert, RefreshCw } from 'lucide-react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { toProxiedAssetUrl } from '../../../shared/url/proxiedAssetUrl'
import {
  PaymentType,
  type PaymentTypeValue,
  type RetailClientPaymentImageItem,
} from '../types'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'

export type PaymentImageEditModalProps = {
  editError: string | null
  editNotice: string | null
  isRefreshing: boolean
  isSaving: boolean
  item: RetailClientPaymentImageItem | null
  onClose: () => void
  onConfirm: (
    amount: number,
    comment: string,
    paymentType: PaymentTypeValue,
  ) => void
  onRefresh: () => void
}

export function PaymentImageEditModal({
  editError,
  editNotice,
  isRefreshing,
  isSaving,
  item,
  onClose,
  onConfirm,
  onRefresh,
}: PaymentImageEditModalProps) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={Boolean(item)} title={t('Редагування')} onClose={onClose}>
      {item && (
        <PaymentImageEditForm
          key={getPaymentImageEditKey(item)}
          editError={editError}
          editNotice={editNotice}
          isRefreshing={isRefreshing}
          isSaving={isSaving}
          item={item}
          onClose={onClose}
          onConfirm={onConfirm}
          onRefresh={onRefresh}
        />
      )}
    </AppModal>
  )
}

type PaymentImageEditFormProps = {
  editError: string | null
  editNotice: string | null
  isRefreshing: boolean
  isSaving: boolean
  item: RetailClientPaymentImageItem
  onClose: () => void
  onConfirm: (
    amount: number,
    comment: string,
    paymentType: PaymentTypeValue,
  ) => void
  onRefresh: () => void
}

function PaymentImageEditForm({
  editError,
  editNotice,
  isRefreshing,
  isSaving,
  item,
  onClose,
  onConfirm,
  onRefresh,
}: PaymentImageEditFormProps) {
  const { t } = useI18n()
  const [amount, setAmount] = useValueState<number | string>(item.Amount ?? '')
  const [comment, setComment] = useValueState(item.Comment || '')
  const [paymentType, setPaymentType] = useValueState<string | null>(
    isPaymentType(item.PaymentType) ? String(item.PaymentType) : null,
  )
  const [validationError, setValidationError] = useValueState<string | null>(null)

  function handleConfirm() {
    const parsedAmount = typeof amount === 'number' ? amount : Number.parseFloat(String(amount))

    if (!(parsedAmount > 0)) {
      setValidationError(t('Сума не може бути 0'))
      return
    }

    const parsedPaymentType = Number(paymentType)

    if (!isPaymentType(parsedPaymentType)) {
      setValidationError(t('Оберіть тип оплати'))
      return
    }

    setValidationError(null)
    onConfirm(parsedAmount, comment, parsedPaymentType)
  }

  return (
    <Stack gap="sm">
      <PaymentImageEditServerSummary item={item} />
      {editNotice && (
        <Alert color="yellow" icon={<CircleAlert size={18} />} variant="light">
          {editNotice}
        </Alert>
      )}
      {(validationError || editError) && (
        <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
          {validationError || editError}
        </Alert>
      )}
      <NumberInput
        decimalScale={2}
        label={t('Сума')}
        min={0}
        value={amount}
        onChange={setAmount}
      />
      <Select
        data={[
          { label: t('Передплата'), value: String(PaymentType.Prepayment) },
          {
            label: t('Накладений платіж'),
            value: String(PaymentType.CashOnDelivery),
          },
        ]}
        label={t('Тип оплати')}
        value={paymentType}
        onChange={setPaymentType}
      />
      <Textarea
        label={t('Коментар')}
        value={comment}
        onChange={(event) => setComment(event.currentTarget.value)}
      />
      <Group justify="space-between">
        <Button
          color="gray"
          leftSection={<RefreshCw size={16} />}
          loading={isRefreshing}
          variant="subtle"
          onClick={onRefresh}
        >
          {t('Оновити дані')}
        </Button>
        <Group gap="sm">
          <Button color="gray" variant="light" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button
            color={CREATE_ACTION_COLOR}
            disabled={isRefreshing}
            loading={isSaving}
            onClick={handleConfirm}
          >
            {t('Підтвердити')}
          </Button>
        </Group>
      </Group>
    </Stack>
  )
}

function PaymentImageEditServerSummary({
  item,
}: {
  item: RetailClientPaymentImageItem
}) {
  const { t } = useI18n()
  const imageUrl = toProxiedAssetUrl(item.ImgUrl?.trim())

  return (
    <Paper p="sm" radius="md" withBorder>
      <SimpleGrid cols={{ base: 1, sm: imageUrl ? 2 : 1 }} spacing="sm">
        {imageUrl && (
          <Anchor href={imageUrl} rel="noreferrer" target="_blank">
            <Image
              alt={t('Підтвердження оплати')}
              fit="contain"
              h={110}
              radius="sm"
              src={imageUrl}
            />
          </Anchor>
        )}
        <Stack gap={4} justify="center">
          <Text c="dimmed" size="xs">
            {t('Поточні дані сервера')}
          </Text>
          <Text size="sm">
            {t('Сума')}: <strong className="app-money">{formatAmount(item.Amount)} UAH</strong>
          </Text>
          <Text size="sm">
            {t('Тип')}: <strong>{getPaymentTypeLabel(item.PaymentType, t)}</strong>
          </Text>
          {item.Updated && (
            <Text c="dimmed" size="xs">
              {t('Оновлено')}: {formatDateTime(item.Updated)}
            </Text>
          )}
        </Stack>
      </SimpleGrid>
    </Paper>
  )
}

function isPaymentType(value: unknown): value is PaymentTypeValue {
  return value === PaymentType.Prepayment || value === PaymentType.CashOnDelivery
}

function getPaymentTypeLabel(
  value: unknown,
  t: (message: string) => string,
): string {
  if (value === PaymentType.Prepayment) {
    return t('Передплата')
  }

  if (value === PaymentType.CashOnDelivery) {
    return t('Накладений платіж')
  }

  return t('Не вказано')
}

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

function formatAmount(value: number | undefined): string {
  return amountFormatter.format(value ?? 0)
}

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})

function formatDateTime(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)

  return Number.isNaN(date.getTime()) ? String(value) : dateTimeFormatter.format(date)
}

function getPaymentImageEditKey(item: RetailClientPaymentImageItem): string | number {
  return item.NetUid || item.Id || item.RetailClientPaymentImageId || item.ImgUrl || 'payment-image'
}
