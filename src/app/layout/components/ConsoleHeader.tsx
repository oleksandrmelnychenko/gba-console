import { ActionIcon, AppShell, Badge, Box, Group, Title, Text, Tooltip } from '@mantine/core'
import { IconBell, IconChevronRight, IconLayoutSidebar, IconLogout } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../features/auth/useAuth'
import { HeaderActionBar } from '../../../features/header-actions/components/HeaderActionBar'
import { useNavigation } from '../../../features/navigation/hooks/useNavigation'
import { getCockpitCount } from '../../../features/sales-cockpit'
import gbaLogo from '../../../assets/brand/gba-logo.svg'
import { useI18n } from '../../../shared/i18n/useI18n'
import { ConsoleNav } from './ConsoleNav'

const COCKPIT_COUNT_POLL_MS = 60000

type ConsoleHeaderProps = {
  navOpened: boolean
  onToggleNav: () => void
}

export function ConsoleHeader({ navOpened, onToggleNav }: ConsoleHeaderProps) {
  const { logout, session, user } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const { selectedModule, selectedNode } = useNavigation()
  const [cockpitCount, setCockpitCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function loadCockpitCount() {
      try {
        const count = await getCockpitCount()

        if (!cancelled) {
          setCockpitCount(count.active_count)
        }
      } catch {
        if (!cancelled) {
          setCockpitCount(0)
        }
      }
    }

    void loadCockpitCount()
    const intervalId = window.setInterval(loadCockpitCount, COCKPIT_COUNT_POLL_MS)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [])

  const displayName =
    user?.FullName ||
    [user?.FirstName, user?.LastName].filter(Boolean).join(' ') ||
    session?.userNetUid ||
    t('Робочий простір')
  const roleName = user?.UserRole?.Name?.trim()
  const currentDateLabel = new Intl.DateTimeFormat('uk-UA', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(new Date())

  return (
    <AppShell.Header className="console-header">
      <Box className="console-header-main">
        <Group gap="xs" wrap="nowrap" className="console-header-brand">
          <button type="button" className="console-brand-button" onClick={() => navigate('/dashboard')}>
            <img className="console-brand-logo" src={gbaLogo} alt="GBA" />
            <Box className="console-header-title">
              <Title order={1} size={14}>
                GBA CONSOLE
              </Title>
            </Box>
          </button>
          <Box className="console-header-divider" aria-hidden="true" />
        </Group>

        <Box className="console-header-top-nav">
          <ConsoleNav mode="modules" />
        </Box>

        <Group gap="xs" wrap="nowrap" className="console-header-actions">
          <HeaderActionBar />
          <Box className="console-bell">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              aria-label={t('Кокпіт продажів')}
              onClick={() => navigate('/sales/cockpit')}
            >
              <IconBell size={24} stroke={1.7} />
            </ActionIcon>
            {cockpitCount > 0 && (
              <span className="console-bell-badge tx-spring-pop" aria-hidden="true" />
            )}
          </Box>
          <ActionIcon variant="subtle" color="gray" size="lg" aria-label={t('Вийти')} onClick={logout}>
            <IconLogout size={24} stroke={1.7} />
          </ActionIcon>
        </Group>

        <Group gap={6} wrap="nowrap" className="console-header-date">
          <IconCalendarEvent size={15} stroke={1.7} />
          <Text size="sm">{currentDateLabel}</Text>
        </Group>

        <Box className="console-header-bottom-nav">
          <ConsoleNav mode="items" />
        </Box>

        <Group gap="xs" wrap="nowrap" className="console-header-user-panel">
          <Text className="console-header-user" visibleFrom="xs" size="sm" fw={600}>
            {displayName}
          </Text>
          {roleName && (
            <Badge className="console-header-role" color="orange" radius="xl" size="sm" variant="light" visibleFrom="xs">
              {roleName}
            </Badge>
          )}
        </Group>
      </Box>
    </AppShell.Header>
  )
}
