import { Alert, Button, Group, Text } from '@mantine/core'
import { RotateCcw, TriangleAlert } from 'lucide-react'
import { useI18n } from '../i18n/useI18n'

/** A Ukrainian «changed by someone else» notice with a reload action (409 conflicts). */
export function StaleRecordAlert({ message, onReload }: { message: string; onReload: () => void }) {
  const { t } = useI18n()

  return (
    <Alert color="orange" icon={<TriangleAlert size={18} />} variant="light">
      <Group gap="sm" justify="space-between" wrap="wrap">
        <Text size="sm">{message}</Text>
        <Button color="orange" leftSection={<RotateCcw size={16} />} size="xs" variant="light" onClick={onReload}>
          {t('Перезавантажити')}
        </Button>
      </Group>
    </Alert>
  )
}
