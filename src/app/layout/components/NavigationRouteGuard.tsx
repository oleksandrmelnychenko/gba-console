import { Alert, Card, Stack, Text, Title, type MantineColor } from '@mantine/core'
import { IconAlertTriangle, IconLock } from '@tabler/icons-react'
import { type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useNavigation } from '../../../features/navigation/hooks/useNavigation'
import { isNavigationPathAllowed } from '../../../features/navigation/navigationUtils'
import { useI18n } from '../../../shared/i18n/useI18n'

type NavigationLocationState = {
  backgroundLocation?: {
    pathname: string
    search: string
  }
}

export function NavigationRouteGuard({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const location = useLocation()
  const { error, isLoading, modules } = useNavigation()
  const locationState = location.state as NavigationLocationState | null
  const navigationLocation = locationState?.backgroundLocation || location
  const targetPath = `${navigationLocation.pathname}${navigationLocation.search}`
  const isShellRoute = isNavigationPathAllowed([], targetPath)

  if (isShellRoute) {
    return children
  }

  // While the menu loads, render the shell optimistically (the nav shows its own
  // shimmer) instead of a blocking banner; the access check runs once it's ready.
  if (isLoading) {
    return children
  }

  if (error) {
    return (
      <NavigationRouteState
        color="red"
        description={error.message || t('Не вдалося завантажити меню консолі.')}
        icon={<IconAlertTriangle size={20} stroke={1.8} />}
        title={t('Меню недоступне')}
      />
    )
  }

  if (!isNavigationPathAllowed(modules, targetPath)) {
    return (
      <NavigationRouteState
        color="orange"
        description={t('Цей маршрут недоступний для поточної ролі.')}
        icon={<IconLock size={20} stroke={1.8} />}
        title={t('Немає доступу')}
      />
    )
  }

  return children
}

function NavigationRouteState({
  color,
  description,
  icon,
  title,
}: {
  color: MantineColor
  description: string
  icon: ReactNode
  title: string
}) {
  return (
    <Stack gap="lg">
      <Card withBorder padding="lg" radius="md">
        <Alert color={color} icon={icon} variant="light">
          <Title order={3} size="h4">
            {title}
          </Title>
          <Text mt={6} size="sm">
            {description}
          </Text>
        </Alert>
      </Card>
    </Stack>
  )
}
