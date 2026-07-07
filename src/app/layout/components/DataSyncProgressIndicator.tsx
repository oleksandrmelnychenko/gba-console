import { Badge, Group, Loader, Text } from '@mantine/core'
import { CircleAlert } from 'lucide-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useDataSyncProgress } from '../../../shared/realtime/dataSyncProgressStore'

export function DataSyncProgressIndicator() {
  const { t } = useI18n()
  const progress = useDataSyncProgress()

  if (!progress.isActive && !progress.isError) {
    return null
  }

  return (
    <Group className={`data-sync-progress${progress.isError ? ' is-error' : ''}`} gap={8} wrap="nowrap">
      {progress.isError ? <CircleAlert size={16} strokeWidth={1.8} /> : <Loader size={14} type="oval" />}
      <Badge color={progress.isError ? 'red' : 'teal'} variant="light">
        {progress.isError ? t('Помилка синку') : t('Синхронізація')}
      </Badge>
      <Text component="span" size="xs" className="data-sync-progress-message">
        {progress.message || t('Очікування повідомлень')}
      </Text>
    </Group>
  )
}
