import { Alert, Badge, Group, Stack, Text } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'
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
    <AppModal centered opened={opened} size="md" title={t('Відсутні артикули')} onClose={onClose}>
      <Stack gap="md">
        <Alert color="red" icon={<IconAlertTriangle size={18} />} variant="light">
          {t('Ці артикули з файлу не знайдено серед товарів')}
        </Alert>
        <Group gap="xs">
          {items.map((code) => (
            <Badge key={code} color="red" size="lg" variant="light">
              {code}
            </Badge>
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
