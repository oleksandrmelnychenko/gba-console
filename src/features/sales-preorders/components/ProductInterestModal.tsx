import { Alert, Button, Group, NumberInput, Stack, Textarea } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { CircleAlert } from 'lucide-react'
import { type FormEvent } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { useValueState } from '../../../shared/hooks/useValueState'
import { AppModal } from '../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { usePersistentCreateMutation } from '../../sales-ukraine/persistentCreateMutation'
import { createPreorder } from '../api/salesPreordersApi'
import { usePermissions } from '../../auth/usePermissions'
import './product-interest-modal.css'

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

const MAX_PREORDER_COMMENT_LENGTH = 250
const MAX_PREORDER_QUANTITY = 1_000_000_000

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
  const { can } = usePermissions()
  const canCreate = can(PermissionKeys.SalesUkraineInterest.Preorder.Create)
  const [form, setForm] = useValueState<InterestFormState>(createInitialForm)
  const [touched, setTouched] = useValueState(false)
  const [isCreating, setCreating] = useValueState(false)
  const [previousOpened, setPreviousOpened] = useValueState(opened)
  const runCreatePreorder = usePersistentCreateMutation(
    'preorder',
    `${clientAgreementNetId}:${productNetId}`,
  )
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

    if (!canCreate || !isPositiveNumber(form.qty)) {
      return
    }

    setCreating(true)

    try {
      const message = await runCreatePreorder(
        {
          clientAgreementNetId,
          productNetId,
          qty: Number(form.qty),
          comment: form.comment.trim(),
        },
        createPreorder,
      )

      notifications.show({ color: 'green', message: message || t('Збережено') })
      onCreated?.()
      onClose()
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error && error.message.trim()
          ? error.message
          : t('Не вдалося зберегти'),
      })
    } finally {
      setCreating(false)
    }
  }

  return (
    <AppModal
      centered
      className="product-interest-modal"
      opened={opened && canCreate}
      size="xs"
      title={<span className="product-interest-modal__title">{t('Зацікавленість')}</span>}
      onClose={closeModal}
    >
      <form onSubmit={submitForm}>
        <Stack gap="sm">
          <NumberInput
            allowDecimal={false}
            allowNegative={false}
            disabled={isCreating}
            label={t('Кількість')}
            max={MAX_PREORDER_QUANTITY}
            min={1}
            value={form.qty}
            onChange={(value) => setForm((current) => ({ ...current, qty: toNumberInputValue(value) }))}
          />
          {touched && qtyError && (
            <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
              {qtyError}
            </Alert>
          )}
          <Textarea
            autosize
            disabled={isCreating}
            label={t('Коментар')}
            maxLength={MAX_PREORDER_COMMENT_LENGTH}
            minRows={2}
            value={form.comment}
            onChange={(event) => {
              const { value } = event.currentTarget

              setForm((current) => ({ ...current, comment: value }))
            }}
          />
          <Group justify="flex-end" gap="sm">
            <Button color="gray" disabled={isCreating} type="button" variant="light" onClick={closeModal}>
              {t('Скасувати')}
            </Button>
            <Button color={CREATE_ACTION_COLOR} disabled={!canCreate} loading={isCreating} type="submit">
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
