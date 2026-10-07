import { Button, Group, Loader, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'

/** A capability check's status, independent of the report's open action. */
export function OriginalConstructorAvailability({ enabled, pending, failed, executable, disabled, onRetry }: {
  enabled: boolean; pending: boolean; failed: boolean; executable: boolean; disabled: boolean; onRetry: () => void
}) {
  const { t } = useI18n()
  if (!enabled) return <Text size="xs" c="dimmed">{t('Для цього конструктора потрібне право формування звітів.')}</Text>
  if (pending) return <Loader size="xs" aria-label={t('Перевірка доступності конструктора')} />
  if (failed) return <Group gap="xs" align="start">
    <Text size="xs" c="dimmed">{t('Не вдалося перевірити доступність конструктора.')}</Text>
    <Button type="button" variant="subtle" size="compact-xs" disabled={disabled} onClick={onRetry}>{t('Повторити')}</Button>
  </Group>
  return executable ? null : <Text size="xs" c="dimmed">{t('Сервер ще не підтримує формування цього конструктора.')}</Text>
}
