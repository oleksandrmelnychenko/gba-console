import { Box, Button, Group, NumberInput, Stack, Text, TextInput } from '@mantine/core'
import { useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { AppModal } from '../../../../shared/ui/AppModal'

const qtyFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })

export function ChangeQtyModal({
  availableQty,
  busy = false,
  initialComment,
  initialQty,
  opened,
  onAccept,
  onCancel,
}: {
  availableQty: number
  busy?: boolean
  initialComment?: string
  initialQty?: number
  opened: boolean
  onAccept: (qty: number, comment: string) => void
  onCancel: () => void
}) {
  const { t } = useI18n()

  return (
    <AppModal
      centered
      classNames={{
        body: 'new-sale-qty-modal__body',
        close: 'new-sale-qty-modal__close',
        content: 'new-sale-qty-modal__content',
        header: 'new-sale-qty-modal__header',
        title: 'new-sale-qty-modal__title',
      }}
      opened={opened}
      size={420}
      title={t('Додати в кошик')}
      onClose={onCancel}
    >
      {opened && (
        <ChangeQtyForm
          availableQty={availableQty}
          busy={busy}
          initialComment={initialComment ?? ''}
          initialQty={initialQty ?? 0}
          onAccept={onAccept}
          onCancel={onCancel}
        />
      )}
    </AppModal>
  )
}

function ChangeQtyForm({
  availableQty,
  busy,
  initialComment,
  initialQty,
  onAccept,
  onCancel,
}: {
  availableQty: number
  busy: boolean
  initialComment: string
  initialQty: number
  onAccept: (qty: number, comment: string) => void
  onCancel: () => void
}) {
  const { t } = useI18n()
  const [value, setValue] = useState<number | string>(initialQty > 0 ? initialQty : '')
  const [comment, setComment] = useState(initialComment)
  const [touched, setTouched] = useState(false)

  const qty = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
  const isValid = Number.isFinite(qty) && qty > 0 && qty <= availableQty
  const showError = touched && !isValid

  function accept() {
    setTouched(true)

    if (isValid && !busy) {
      onAccept(qty, comment)
    }
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      accept()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onCancel()
    }
  }

  return (
    <Stack className="new-sale-qty-form" gap={0} onKeyDown={handleKeyDown}>
      <Box className="new-sale-qty-form__available">
        <Text className="new-sale-qty-form__available-value">
          {qtyFormatter.format(availableQty)}
        </Text>
        <Text className="new-sale-qty-form__available-label">
          {t('Доступна К-сть')}
        </Text>
      </Box>

      <Box className="new-sale-qty-form__fields">
        <NumberInput
          allowNegative={false}
          autoFocus
          classNames={{
            input: 'new-sale-qty-form__input',
            label: 'new-sale-qty-form__label',
            root: 'new-sale-qty-form__field',
          }}
          data-autofocus
          decimalScale={3}
          error={showError ? t('Невірна кількість') : undefined}
          label={showError ? t('Невірна кількість') : t('Кількість')}
          min={0}
          value={value}
          onChange={(next) => {
            setTouched(true)
            setValue(next)
          }}
          onFocus={(event) => event.currentTarget.select()}
        />

        <TextInput
          classNames={{
            input: 'new-sale-qty-form__input',
            label: 'new-sale-qty-form__label',
            root: 'new-sale-qty-form__field',
          }}
          label={t('Коментар')}
          value={comment}
          onChange={(event) => setComment(event.currentTarget.value)}
        />
      </Box>

      <Group className="new-sale-qty-form__actions" justify="flex-end" gap="sm">
        <Button className="new-sale-qty-form__cancel" color="gray" disabled={busy} variant="light" onClick={onCancel}>
          {t('Скасувати')}
        </Button>
        <Button className="new-sale-qty-form__submit" disabled={showError} loading={busy} onClick={accept}>
          {t('Додати')}
        </Button>
      </Group>
    </Stack>
  )
}
