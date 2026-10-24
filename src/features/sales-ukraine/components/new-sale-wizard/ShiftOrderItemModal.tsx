import { Button, Group, NumberInput, Stack, Text } from '@mantine/core'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { TableChip } from '../../../../shared/ui/TableChip'
import { AppModal, AppModalFooter } from '../../../../shared/ui/AppModal'
import { useWizardQuantityForm } from './useWizardQuantityForm'

const amountFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })

export function ShiftOrderItemModal({
  amount,
  analyst,
  busy = false,
  opened,
  sessionKey,
  zIndex,
  regionCode,
  sourceName,
  onApply,
  onCancel,
}: {
  amount: number
  analyst: string
  busy?: boolean
  opened: boolean
  sessionKey?: string
  zIndex?: number
  regionCode: string
  sourceName: string
  onApply: (qty: number) => void | Promise<unknown>
  onCancel: () => void
}) {
  const { t } = useI18n()
  const { value, showError, setValue, confirm, cancel, handleKeyDown, isBusy } = useWizardQuantityForm({
    availableQty: amount, onAccept: (qty) => onApply(qty), busy, opened, sessionKey, onCancel,
  })

  return (
    <AppModal
      centered
      size="sm"
      opened={opened}
      zIndex={zIndex}
      title={t('Переміщення з іншого рахунку')}
      onClose={cancel}
      onKeyDown={handleKeyDown}
      closeOnEscape={false}
      closeOnClickOutside={!isBusy}
      closeButtonProps={{ disabled: isBusy }}
    >
      {opened && (
        <Stack className="app-compact-form" gap={10}>
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
            disabled={isBusy}
            decimalScale={3}
            error={showError ? t('Невірна кількість') : undefined}
            label={showError ? t('Невірна кількість') : t('Кількість для переміщення')}
            min={0}
            value={value}
            onChange={setValue}
          />

          <AppModalFooter>
            <Button color="gray" disabled={isBusy} variant="default" onClick={cancel}>
              {t('Скасувати')}
            </Button>
            <Button disabled={showError} loading={isBusy} onClick={confirm}>
              {t('Застосувати')}
            </Button>
          </AppModalFooter>
        </Stack>
      )}
    </AppModal>
  )
}
