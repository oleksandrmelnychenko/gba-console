import { Box, Card, Group, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { IconDatabase } from '@tabler/icons-react'
import { useI18n } from '../../shared/i18n/useI18n'
import type { TranslationKey } from '../../shared/i18n/types'

type ModulePageProps = {
  module?: TranslationKey
}

export function ModulePage(_props: ModulePageProps) {
  const { t } = useI18n()
  void _props

  return (
    <Stack gap="lg">
      <Card withBorder radius="md" padding="lg">
        <Group justify="space-between" align="center">
          <Box>
            <Title order={3} size="h4">
              {t('Готово до реалізації')}
            </Title>
            <Text c="dimmed" size="sm">
              {t('Маршрут підключений у новій оболонці консолі.')}
            </Text>
          </Box>
          <ThemeIcon variant="light" color="cyan" size={48} radius="md">
            <IconDatabase size={24} stroke={1.8} />
          </ThemeIcon>
        </Group>
      </Card>
    </Stack>
  )
}
