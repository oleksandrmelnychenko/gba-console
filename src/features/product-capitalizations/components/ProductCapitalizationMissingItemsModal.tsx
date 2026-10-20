import { Alert, Group, Stack, Text } from '@mantine/core'
import { TriangleAlert } from 'lucide-react'
import { TableChip } from '../../../shared/ui/TableChip'
import { AppModal } from '../../../shared/ui/AppModal'
import { useI18n } from '../../../shared/i18n/useI18n'

type ProductCapitalizationMissingItemsModalProps = {
  items: string[]
  opened: boolean
  onClose: () => void
}

export function ProductCapitalizationMissingItemsModal({
  items,
  opened,
  onClose,
}: ProductCapitalizationMissingItemsModalProps) {
  const { t } = useI18n()

  return (
    <AppModal
      centered
      opened={opened}
      size="md"
      title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Відсутні артикули')}</span>}
      onClose={onClose}
    >
      <Stack className="app-compact-form" gap="md">
        <Alert color="red" icon={<TriangleAlert size={18} />} variant="light">
          {t('Ці артикули з файлу не знайдено серед товарів')}
        </Alert>
        <Group gap="xs">
          {items.map((code) => (
            <TableChip key={code} tone="danger" value={code} />
          ))}
        </Group>
        {items.length === 0 && (
          <Text c="dimmed" size="sm">
            {t('Список порожній')}
          </Text>
        )}
      </Stack>
    </AppModal>
  )
}
