import { Box, Card, Stack, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'

export function ProductIncomeUkrainePage() {
  const { t } = useI18n()

  return (
    <Stack gap="lg">
      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Box py={28}>
            <Text c="dimmed" size="sm" ta="center">
              {t('Список наразі порожній')}
            </Text>
          </Box>
        </Stack>
      </Card>
    </Stack>
  )
}
