import { Button, Group, Stack, Text } from '@mantine/core'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { AppModal } from '../../../../shared/ui/AppModal'

export function WizardConfirmModal({
  busy = false,
  message,
  opened,
  onCancel,
  onConfirm,
}: {
  busy?: boolean
  message: string
  opened: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const { t } = useI18n()

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()

      if (!busy) {
        onConfirm()
      }
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onCancel()
    }
  }

  return (
    <AppModal centered opened={opened} size="xs" title={t('Підтвердження')} onClose={onCancel}>
      <Stack gap="md" onKeyDown={handleKeyDown}>
        <Text size="sm">{message}</Text>
        <Group justify="flex-end" gap="sm">
          <Button color="gray" disabled={busy} variant="light" onClick={onCancel}>
            {t('Скасувати')}
          </Button>
          <Button autoFocus data-autofocus loading={busy} onClick={onConfirm}>
            {t('Так')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}
