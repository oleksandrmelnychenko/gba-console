import { Button, Group, NumberInput, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { AppModal } from '../../../../shared/ui/AppModal'

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
    <Stack gap="md" onKeyDown={handleKeyDown}>
      <Stack align="center" gap={0}>
        <Text fw={700} size="xl">
          {amountFormatter.format(amount)}
        </Text>
        <Text c="dimmed" size="sm">
          {t('Зарезервовано')}
        </Text>
      </Stack>

      <Stack gap={4}>
        <Group gap={6} wrap="nowrap">
          <Text c="dimmed" size="sm">
            {t('Для клієнта')}:
          </Text>
          <Text fw={600} size="sm">
            {regionCode || '—'}
          </Text>
        </Group>
        <Group gap={6} wrap="nowrap">
          <Text c="dimmed" size="sm">
            {t('З рахунка')}:
          </Text>
          <Text fw={600} size="sm">
            {sourceName || '—'}
          </Text>
        </Group>
        <Group gap={6} wrap="nowrap">
          <Text c="dimmed" size="sm">
            {t('Аналітик')}:
          </Text>
          <Text fw={600} size="sm">
            {analyst || '—'}
          </Text>
        </Group>
      </Stack>

      <NumberInput
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

      <Group justify="flex-end" gap="sm">
        <Button color="gray" disabled={busy} variant="light" onClick={onCancel}>
          {t('Скасувати')}
        </Button>
        <Button disabled={showError} loading={busy} onClick={apply}>
          {t('Застосувати')}
        </Button>
      </Group>
    </Stack>
  )
}
