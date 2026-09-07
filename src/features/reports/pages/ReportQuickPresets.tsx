import { Badge, Button, Card, Group, SimpleGrid, Stack, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { SALES_REPORT_PRESETS, type SalesReportPresetId } from '../data/reportPresets'

type Props = {
  disabled: boolean
  onApply: (id: SalesReportPresetId) => void
}

export function ReportQuickPresets({ disabled, onApply }: Props) {
  const { t } = useI18n()

  return (
    <Card withBorder padding="sm" radius="md">
      <Stack gap="xs">
        <Group justify="space-between">
          <Text fw={600} size="sm">{t('Готові налаштування звіту')}</Text>
          <Group gap={6}>
            <Badge variant="light">EUR</Badge>
            <Badge variant="light" color="gray">Europe/Kyiv</Badge>
          </Group>
        </Group>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {SALES_REPORT_PRESETS.map((preset) => (
            <Stack key={preset.id} gap={4}>
              <Button disabled={disabled} variant="light" type="button" onClick={() => onApply(preset.id)}>
                {t(preset.name)}
              </Button>
              <Text size="xs" c="dimmed">{t(preset.description)}</Text>
            </Stack>
          ))}
        </SimpleGrid>
        <Text size="xs" c="dimmed">{t('Дати й відбори зберігаються. Звіт запускається лише кнопкою «Сформувати».')}</Text>
        <Text size="xs" c="orange.8">
          {t('Конструктор рахує проведені продажі, без віднімання повернень. Історичні складські залишки тут не розраховуються.')}
        </Text>
      </Stack>
    </Card>
  )
}
