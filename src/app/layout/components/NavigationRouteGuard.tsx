import { type MantineColor } from '@mantine/core'
import { TriangleAlert } from 'lucide-react'
import { type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useNavigation } from '../../../features/navigation/hooks/useNavigation'
import { isNavigationPathAllowed } from '../../../features/navigation/navigationUtils'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AccessState } from '../../../shared/ui/access-state/AccessState'

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
        icon={<TriangleAlert size={20} strokeWidth={1.8} />}
        title={t('Меню недоступне')}
      />
    )
  }

  if (!isNavigationPathAllowed(modules, targetPath)) {
    return (
      <NavigationRouteState
        color="yellow"
        description={t('Ця сторінка недоступна для вашого облікового запису.')}
        icon={<TriangleAlert size={20} strokeWidth={1.8} />}
        title={t('Доступ заборонено')}
      />
    )
  }

  return children
}

function NavigationRouteState({
  color,
  description,
  title,
}: {
  color: MantineColor
  description: string
  icon: ReactNode
  title: string
}) {
  return <AccessState description={description} title={title} tone={color === 'red' ? 'danger' : 'neutral'} />
}
