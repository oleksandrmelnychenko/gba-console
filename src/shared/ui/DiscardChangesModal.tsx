import { Button, Stack, Text } from '@mantine/core'
import { useI18n } from '../i18n/useI18n'
import { AppModal, AppModalFooter } from './AppModal'

/** «Закрити без збереження?» for forms closed with X, Escape or Скасувати while they hold typed data. */
export function DiscardChangesModal({
  opened,
  onDiscard,
  onKeep,
}: {
  opened: boolean
  onDiscard: () => void
  onKeep: () => void
}) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={opened} size={420} title={t('Закрити без збереження?')} onClose={onKeep}>
      <Stack gap={10}>
        <Text size="sm">{t('Введені дані буде втрачено.')}</Text>
        <AppModalFooter>
          <Button variant="default" onClick={onKeep}>{t('Продовжити редагування')}</Button>
          <Button color="red" onClick={onDiscard}>{t('Закрити')}</Button>
        </AppModalFooter>
      </Stack>
    </AppModal>
  )
}
