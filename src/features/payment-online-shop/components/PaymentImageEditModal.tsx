import { Alert, Button, Group, NumberInput, Stack, Textarea } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import type { RetailClientPaymentImageItem } from '../types'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'

export type PaymentImageEditModalProps = {
  editError: string | null
  isSaving: boolean
  item: RetailClientPaymentImageItem | null
  onClose: () => void
  onConfirm: (amount: number, comment: string) => void
}

export function PaymentImageEditModal({ editError, isSaving, item, onClose, onConfirm }: PaymentImageEditModalProps) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={Boolean(item)} title={t('Редагування')} onClose={onClose}>
      {item && (
        <PaymentImageEditForm
          key={getPaymentImageEditKey(item)}
          editError={editError}
          isSaving={isSaving}
          item={item}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      )}
    </AppModal>
  )
}

type PaymentImageEditFormProps = {
  editError: string | null
  isSaving: boolean
  item: RetailClientPaymentImageItem
  onClose: () => void
  onConfirm: (amount: number, comment: string) => void
}

function PaymentImageEditForm({ editError, isSaving, item, onClose, onConfirm }: PaymentImageEditFormProps) {
  const { t } = useI18n()
  const [amount, setAmount] = useValueState<number | string>(item.Amount ?? '')
  const [comment, setComment] = useValueState(item.Comment || '')
  const [validationError, setValidationError] = useValueState<string | null>(null)

  function handleConfirm() {
    const parsedAmount = typeof amount === 'number' ? amount : Number.parseFloat(String(amount))

    if (!(parsedAmount > 0)) {
      setValidationError(t('Сума не може бути 0'))
      return
    }

    onConfirm(parsedAmount, comment)
  }

  return (
    <Stack gap="sm">
      {(validationError || editError) && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
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
      <Textarea
        label={t('Коментар')}
        value={comment}
        onChange={(event) => setComment(event.currentTarget.value)}
      />
      <Group justify="flex-end">
        <Button color="gray" variant="light" onClick={onClose}>
          {t('Скасувати')}
        </Button>
        <Button color={CREATE_ACTION_COLOR} loading={isSaving} onClick={handleConfirm}>
          {t('Підтвердити')}
        </Button>
      </Group>
    </Stack>
  )
}

function getPaymentImageEditKey(item: RetailClientPaymentImageItem): string | number {
  return item.NetUid || item.Id || item.RetailClientPaymentImageId || item.ImgUrl || 'payment-image'
}
