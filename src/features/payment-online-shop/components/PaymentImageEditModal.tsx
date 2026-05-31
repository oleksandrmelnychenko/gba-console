import { Alert, Button, Group, NumberInput, Stack, Textarea } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useEffect } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import type { RetailClientPaymentImageItem } from '../types'

export type PaymentImageEditModalProps = {
  editError: string | null
  isSaving: boolean
  item: RetailClientPaymentImageItem | null
  onClose: () => void
  onConfirm: (amount: number, comment: string) => void
}

export function PaymentImageEditModal({ editError, isSaving, item, onClose, onConfirm }: PaymentImageEditModalProps) {
  const { t } = useI18n()
  const [amount, setAmount] = useValueState<number | string>('')
  const [comment, setComment] = useValueState('')
  const [validationError, setValidationError] = useValueState<string | null>(null)

  useEffect(() => {
    if (item) {
      setAmount('')
      setComment('')
      setValidationError(null)
    }
  }, [item, setAmount, setComment, setValidationError])

  function handleConfirm() {
    const parsedAmount = typeof amount === 'number' ? amount : Number.parseFloat(String(amount))

    if (!(parsedAmount > 0)) {
      setValidationError(t('Сума не може бути 0'))
      return
    }

    onConfirm(parsedAmount, comment)
  }

  return (
    <AppModal centered opened={Boolean(item)} title={t('Редагування')} onClose={onClose}>
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
          placeholder={item?.Amount === undefined ? undefined : String(item.Amount)}
          value={amount}
          onChange={setAmount}
        />
        <Textarea
          label={t('Коментар')}
          placeholder={item?.Comment || undefined}
          value={comment}
          onChange={(event) => setComment(event.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button color="gray" variant="light" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button color="violet" loading={isSaving} onClick={handleConfirm}>
            {t('Підтвердити')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}
