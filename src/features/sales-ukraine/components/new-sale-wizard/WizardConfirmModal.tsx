import { Box, Button, Divider, Group, Stack, Text } from '@mantine/core'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { AppModal } from '../../../../shared/ui/AppModal'

const actionButtonStyle = {
  outline: 'none',
  outlineOffset: 0,
} as const

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
      classNames={{ body: 'new-sale-confirm-modal__body' }}
      opened={opened}
      size={420}
      title={
        <span className="new-sale-confirm-modal__title">
          <span className="new-sale-confirm-modal__title-dot" />
          {t('Підтвердження')}
        </span>
      }
      onClose={onCancel}
    >
      <Stack className="new-sale-confirm-modal" gap={0} onKeyDown={handleKeyDown}>
        <Box className="new-sale-confirm-modal__content">
          <Text className="new-sale-confirm-modal__text">{message}</Text>
        </Box>

        <Divider className="new-sale-confirm-modal__divider" />

        <Group className="new-sale-confirm-modal__actions" gap="sm" justify="flex-end">
          <Button
            className="new-sale-confirm-modal__cancel"
            color="gray"
            disabled={busy}
            style={actionButtonStyle}
            variant="light"
            onClick={onCancel}
          >
            {t('Скасувати')}
          </Button>
          <Button className="new-sale-confirm-modal__confirm" loading={busy} style={actionButtonStyle} onClick={onConfirm}>
            {t('Так')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}
