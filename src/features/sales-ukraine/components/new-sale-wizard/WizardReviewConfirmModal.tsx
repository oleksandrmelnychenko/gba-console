import { Button, Stack, Text } from '@mantine/core'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { AppModal, AppModalFooter } from '../../../../shared/ui/AppModal'

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
    if (event.key !== 'Enter' && event.key !== 'Escape') return
    event.stopPropagation()
    if (event.defaultPrevented || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 || event.ctrlKey || event.metaKey || event.altKey) return
    if (event.repeat) { event.preventDefault(); return }
    if (event.key === 'Enter') {
      // Enter on Cancel must activate Cancel, not confirm the whole dialog.
      if (event.target instanceof Element && event.target.closest('button')) return
      event.preventDefault()
      onConfirm()
    } else if (event.key === 'Escape') {
      event.preventDefault()
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
      <Stack className="app-compact-form" gap={10} onKeyDown={handleKeyDown}>
        <Text size="sm">{t('Закрити вікно?')}</Text>
        <AppModalFooter>
          <Button color="gray" variant="default" onClick={onCancel}>
            {t('Скасувати')}
          </Button>
          <Button data-autofocus onClick={onConfirm}>
            {t('Так')}
          </Button>
        </AppModalFooter>
      </Stack>
    </AppModal>
  )
}
