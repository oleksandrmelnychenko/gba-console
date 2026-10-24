import { Button, Stack, Text } from '@mantine/core'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { AppModal, AppModalFooter } from '../../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../../shared/ui/page-header-actions/PageHeaderActions'
import { useWizardModalActions } from './useWizardModalActions'

export function WizardConfirmModal({
  busy = false,
  message,
  opened,
  sessionKey,
  zIndex,
  onCancel,
  onConfirm,
}: {
  busy?: boolean
  message: string
  opened: boolean
  sessionKey?: string
  zIndex?: number
  onCancel: () => void
  onConfirm: () => void | Promise<unknown>
}) {
  const { t } = useI18n()

  const { confirm, cancel, handleKeyDown, isBusy } = useWizardModalActions({
    opened, sessionKey, busy, onConfirm, onCancel,
  })

  return (
    <AppModal
      centered
      opened={opened}
      zIndex={zIndex}
      title={t('Підтвердження')}
      onClose={cancel}
      onKeyDown={handleKeyDown}
      closeOnEscape={false}
      closeOnClickOutside={!isBusy}
      closeButtonProps={{ disabled: isBusy }}
    >
      <Stack className="app-compact-form" gap={10}>
        <Text>{message}</Text>

        <AppModalFooter>
          <Button disabled={isBusy} variant="default" onClick={cancel}>
            {t('Скасувати')}
          </Button>
          <Button data-autofocus color={CREATE_ACTION_COLOR} loading={isBusy} onClick={confirm}>
            {t('Так')}
          </Button>
        </AppModalFooter>
      </Stack>
    </AppModal>
  )
}
