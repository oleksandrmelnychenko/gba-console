import { Button, Group, NumberInput, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { TableChip } from '../../../../shared/ui/TableChip'
import { AppModal, AppModalFooter } from '../../../../shared/ui/AppModal'

const amountFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })

export function ShiftOrderItemModal({
  amount,
  analyst,
  busy = false,
  opened,
  regionCode,
  sourceName,
  onApply,
  onCancel,
}: {
  amount: number
  analyst: string
  busy?: boolean
  opened: boolean
  regionCode: string
  sourceName: string
  onApply: (qty: number) => void
  onCancel: () => void
}) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={opened} size="sm" title={t('Переміщення з іншого рахунку')} onClose={onCancel}>
      {opened && (
        <ShiftOrderItemForm
          amount={amount}
          analyst={analyst}
          busy={busy}
          regionCode={regionCode}
          sourceName={sourceName}
          onApply={onApply}
          onCancel={onCancel}
        />
      )}
    </AppModal>
  )
}

function ShiftOrderItemForm({
  amount,
  analyst,
  busy,
  regionCode,
  sourceName,
  onApply,
  onCancel,
}: {
  amount: number
  analyst: string
  busy: boolean
  regionCode: string
  sourceName: string
  onApply: (qty: number) => void
  onCancel: () => void
}) {
  const { t } = useI18n()
  const [value, setValue] = useState<number | string>('')
  const [touched, setTouched] = useState(false)

  const qty = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
  const isValid = Number.isFinite(qty) && qty > 0 && qty <= amount
  const showError = touched && !isValid

  function apply() {
    setTouched(true)

    if (isValid && !busy) {
      onApply(qty)
    }
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      apply()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onCancel()
    }
  }

  return (
    <Stack className="app-compact-form" gap={10} onKeyDown={handleKeyDown}>
      <Stack gap={4}>
        <Group gap={6}>
          <Text c="gray.9" size="xs">{t('Зарезервовано')}:</Text>
          <Text className="app-money" fw={600} size="sm">{amountFormatter.format(amount)}</Text>
        </Group>
        <Group gap={6}>
          <Text c="gray.9" size="xs">
            {t('Для клієнта')}:
          </Text>
          <TableChip tone="document" value={regionCode} />
        </Group>
        <Group gap={6}>
          <Text c="gray.9" size="xs">
            {t('З рахунка')}:
          </Text>
          <TableChip tone="document" value={sourceName} />
        </Group>
        <Group gap={6}>
          <Text c="gray.9" size="xs">
            {t('Аналітик')}:
          </Text>
          <TableChip tone="warning" value={analyst} />
        </Group>
      </Stack>

      <NumberInput
        w={220}
        maw="100%"
        allowNegative={false}
        autoFocus
        data-autofocus
        decimalScale={3}
        error={showError ? t('Невірна кількість') : undefined}
        label={showError ? t('Невірна кількість') : t('Кількість для переміщення')}
        min={0}
        value={value}
        onChange={(next) => {
          setTouched(true)
          setValue(next)
        }}
      />

      <AppModalFooter>
        <Button color="gray" disabled={busy} variant="default" onClick={onCancel}>
          {t('Скасувати')}
        </Button>
        <Button disabled={showError} loading={busy} onClick={apply}>
          {t('Застосувати')}
        </Button>
      </AppModalFooter>
    </Stack>
  )
}
