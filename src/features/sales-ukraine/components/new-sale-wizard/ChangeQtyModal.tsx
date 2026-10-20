import { Button, Group, NumberInput, Stack, Text, TextInput } from '@mantine/core'
import { useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { AppModal, AppModalFooter } from '../../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../../shared/ui/page-header-actions/PageHeaderActions'
import { TableChip } from '../../../../shared/ui/TableChip'
import './change-qty-modal.css'

const qtyFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })

export function ChangeQtyModal({
  availableQty,
  busy = false,
  initialComment,
  initialQty,
  opened,
  zIndex,
  onAccept,
  onCancel,
}: {
  availableQty: number
  busy?: boolean
  initialComment?: string
  initialQty?: number
  opened: boolean
  zIndex?: number
  onAccept: (qty: number, comment: string) => void
  onCancel: () => void
}) {
  const { t } = useI18n()

  return (
    <AppModal
      centered
      className="new-sale-quantity-modal"
      opened={opened}
      zIndex={zIndex}
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
    <Stack className="app-compact-form" gap={10} onKeyDown={handleKeyDown}>
      <div className="new-sale-quantity-modal__main">
        <Group gap={8} justify="center" className="new-sale-quantity-modal__available">
          <Text size="sm">{t('Доступно')}</Text>
          <TableChip tone={availableQty > 0 ? 'success' : 'neutral'} value={qtyFormatter.format(availableQty)} />
        </Group>
        <NumberInput
          className="new-sale-quantity-modal__quantity"
          allowNegative={false}
          autoFocus
          data-autofocus
          decimalScale={3}
          error={showError ? t('Невірна кількість') : undefined}
          label={t('Кількість')}
          min={0}
          value={value}
          onChange={(next) => {
            setTouched(true)
            setValue(next)
          }}
          onFocus={(event) => event.currentTarget.select()}
        />
      </div>

      <TextInput
        label={t('Коментар')}
        value={comment}
        onChange={(event) => setComment(event.currentTarget.value)}
      />

      <AppModalFooter>
        <Button disabled={busy} variant="default" onClick={onCancel}>
          {t('Скасувати')}
        </Button>
        <Button color={CREATE_ACTION_COLOR} disabled={showError} loading={busy} onClick={accept}>
          {t('Додати')}
        </Button>
      </AppModalFooter>
    </Stack>
  )
}
