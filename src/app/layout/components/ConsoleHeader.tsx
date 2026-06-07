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

  return (
    <AppShell.Header className="console-header">
      <Group className="console-header-main" h={60} px="md" justify="space-between" wrap="nowrap">
        <Group gap="xs" wrap="nowrap" className="console-header-brand">
          <Tooltip label={navOpened ? t('Сховати меню') : t('Показати меню')} withArrow>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="md"
              aria-label={t('Меню')}
              aria-pressed={navOpened}
              onClick={onToggleNav}
              className="console-nav-toggle tx-icon-swap"
              data-flipped={navOpened}
            >
              <IconLayoutSidebar size={20} stroke={1.7} />
            </ActionIcon>
          </Tooltip>
          <button type="button" className="console-brand-button" onClick={() => navigate('/dashboard')}>
            <img className="console-brand-logo" src={gbaLogo} alt="GBA" />
            <Box className="console-header-title">
              <Title order={1} size={14} lh={1.05}>
                GBA CONSOLE
              </Title>
            </Box>
          </button>
          {(selectedModule || selectedNode) && (
            <>
              <Box className="console-header-divider" aria-hidden="true" />
              <Group gap={4} wrap="nowrap" className="console-header-crumbs">
                {selectedModule && (
                  <Text className="console-header-crumb-module" size="sm">
                    {selectedModule.Module}
                  </Text>
                )}
                {selectedModule && selectedNode && (
                  <IconChevronRight size={14} stroke={1.8} className="console-header-crumb-sep" />
                )}
                {selectedNode && (
                  <Tooltip label={selectedNode.Module} withArrow openDelay={400} disabled={selectedNode.Module.length < 40}>
                    <Text className="console-header-crumb-page tx-text-swap" key={selectedNode.NetUid || selectedNode.Id} size="sm" fw={600}>
                      {selectedNode.Module}
                    </Text>
                  </Tooltip>
                )}
              </Group>
            </>
          )}
        </Group>

        <Group gap="xs" wrap="nowrap" className="console-header-actions">
          <HeaderActionBar />
          <Text className="console-header-user" visibleFrom="xs" size="sm" fw={600}>
            {displayName}
          </Text>
          {roleName && (
            <Badge className="console-header-role" color="orange" radius="xl" size="sm" variant="light" visibleFrom="xs">
              {roleName}
            </Badge>
          )}
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
      </Group>
    </AppShell.Header>
  )
}
