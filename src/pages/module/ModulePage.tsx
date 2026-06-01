import { Box, Card, Group, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { IconAlertTriangle, IconDatabase } from '@tabler/icons-react'
import { useLocation } from 'react-router-dom'
import { useNavigation } from '../../features/navigation/hooks/useNavigation'
import { isNavigationNodeRouteTarget } from '../../features/navigation/navigationUtils'
import { useI18n } from '../../shared/i18n/useI18n'
import type { TranslationKey } from '../../shared/i18n/types'

type ModulePageProps = {
  fallback?: boolean
  module?: TranslationKey
}

export function ModulePage({ fallback = false, module }: ModulePageProps) {
  const { t } = useI18n()
  const location = useLocation()
  const { isLoading, selectedNode } = useNavigation()
  const isUnsupportedNavigationRoute =
    fallback && Boolean(selectedNode && isNavigationNodeRouteTarget(selectedNode, location.pathname))
  const title = fallback
    ? isLoading
      ? t('Меню завантажується')
      : isUnsupportedNavigationRoute
        ? t('Модуль не підтримується')
        : t('Маршрут не знайдено')
    : t('Готово до реалізації')
  const description = fallback
    ? isLoading
      ? t('Перевіряємо маршрут у меню консолі.')
      : isUnsupportedNavigationRoute
        ? t('Маршрут є в меню, але ще не підключений у новій оболонці консолі.')
        : t('Для цього шляху немає сторінки у новій оболонці консолі.')
    : t('Маршрут підключений у новій оболонці консолі.')
  const Icon = fallback && !isLoading ? IconAlertTriangle : IconDatabase
  const label = isUnsupportedNavigationRoute ? selectedNode?.Module : module

  return (
    <Stack gap="lg">
      <Card withBorder radius="md" padding="lg">
        <Group justify="space-between" align="center">
          <Box>
            <Title order={3} size="h4">
              {title}
            </Title>
            <Text c="dimmed" size="sm">
              {description}
            </Text>
            {label && (
              <Text mt={6} size="sm" fw={600}>
                {label}
              </Text>
            )}
          </Box>
          <ThemeIcon variant="light" color="cyan" size={48} radius="md">
            <Icon size={24} stroke={1.8} />
          </ThemeIcon>
        </Group>
      </Card>
    </Stack>
  )
}
