import { Button, Group, Stack, Text } from '@mantine/core'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { AppModal } from '../../../../shared/ui/AppModal'

export function WizardReviewConfirmModal({
  opened,
  onCancel,
  onConfirm,
}: {
  onCancel: () => void
  onConfirm: () => void
  opened: boolean
}) {
  const { t } = useI18n()

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      onConfirm()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onCancel()
    }
  }

  return (
    <AppModal
      centered
      closeOnEscape={false}
      opened={opened}
      returnFocus={false}
      size="sm"
      title={t('Підтвердження')}
      withCloseButton={false}
      onClose={onCancel}
    >
      <Stack gap="md" onKeyDown={handleKeyDown}>
        <Text>{t('Закрити вікно?')}</Text>
        <Group gap="xs" justify="flex-end">
          <Button color="gray" variant="light" onClick={onCancel}>
            {t('Скасувати')}
          </Button>
          <Button data-autofocus onClick={onConfirm}>
            {t('Так')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}
