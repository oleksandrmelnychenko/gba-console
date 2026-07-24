import { Button, Stack, Text } from '@mantine/core'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { AppModal, AppModalFooter } from '../../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../../shared/ui/page-header-actions/PageHeaderActions'

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
    <AppModal
      centered
      opened={opened}
      title={t('Підтвердження')}
      onClose={onCancel}
    >
      <Stack gap="md" onKeyDown={handleKeyDown}>
        <Text>{message}</Text>

        <AppModalFooter>
          <Button disabled={busy} variant="default" onClick={onCancel}>
            {t('Скасувати')}
          </Button>
          <Button color={CREATE_ACTION_COLOR} loading={busy} onClick={onConfirm}>
            {t('Так')}
          </Button>
        </AppModalFooter>
      </Stack>
    </AppModal>
  )
}
