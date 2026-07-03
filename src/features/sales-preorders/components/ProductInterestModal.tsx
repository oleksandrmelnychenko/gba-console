import { Alert, Button, Group, NumberInput, Stack, Textarea } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle } from '@tabler/icons-react'
import { type FormEvent } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useValueState } from '../../../shared/hooks/useValueState'
import { AppModal } from '../../../shared/ui/AppModal'
import { createPreorder } from '../api/salesPreordersApi'

export type ProductInterestModalProps = {
  clientAgreementNetId: string
  opened: boolean
  productNetId: string
  onClose: () => void
  onCreated?: () => void
}

type InterestFormState = {
  comment: string
  qty: number | ''
}

function createInitialForm(): InterestFormState {
  return {
    comment: '',
    qty: '',
  }
}

export function ProductInterestModal({
  clientAgreementNetId,
  opened,
  productNetId,
  onClose,
  onCreated,
}: ProductInterestModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useValueState<InterestFormState>(createInitialForm)
  const [touched, setTouched] = useValueState(false)
  const [isCreating, setCreating] = useValueState(false)
  const [previousOpened, setPreviousOpened] = useValueState(opened)
  const qtyError = !isPositiveNumber(form.qty) ? t('Поле - обов’язкове') : null

  if (opened !== previousOpened) {
    setPreviousOpened(opened)

    if (opened) {
      setForm(createInitialForm())
      setTouched(false)
    }
  }

  function closeModal() {
    if (!isCreating) {
      onClose()
    }
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setTouched(true)

    if (!isPositiveNumber(form.qty)) {
      return
    }

    setCreating(true)

    try {
      const message = await createPreorder({
        clientAgreementNetId,
        productNetId,
        qty: Number(form.qty),
        comment: form.comment.trim(),
      })

      notifications.show({ color: 'green', message: message || t('Збережено') })
      onCreated?.()
      onClose()
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося зберегти') })
    } finally {
      setCreating(false)
    }
  }

  return (
    <AppModal centered opened={opened} size="xs" title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Зацікавленість')}</span>} onClose={closeModal}>
      <form onSubmit={submitForm}>
        <Stack gap="sm">
          <NumberInput
            allowDecimal={false}
            allowNegative={false}
            disabled={isCreating}
            label={t('Кількість')}
            min={1}
            value={form.qty}
            onChange={(value) => setForm((current) => ({ ...current, qty: toNumberInputValue(value) }))}
          />
          {touched && qtyError && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {qtyError}
            </Alert>
          )}
          <Textarea
            autosize
            disabled={isCreating}
            label={t('Коментар')}
            minRows={2}
            value={form.comment}
            onChange={(event) => setForm((current) => ({ ...current, comment: event.currentTarget.value }))}
          />
          <Group justify="flex-end" gap="sm">
            <Button color="gray" disabled={isCreating} type="button" variant="light" onClick={closeModal}>
              {t('Скасувати')}
            </Button>
            <Button loading={isCreating} type="submit">
              {t('Створити')}
            </Button>
          </Group>
        </Stack>
      </form>
    </AppModal>
  )
}

function toNumberInputValue(value: string | number): number | '' {
  if (value === '') {
    return ''
  }

  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : ''
}

function isPositiveNumber(value: number | ''): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1
}
