import { ActionIcon, AppShell, Badge, Box, Group, Title, Text } from '@mantine/core'
import { LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../features/auth/useAuth'
import { HeaderActionBar } from '../../../features/header-actions/components/HeaderActionBar'
import gbaLogo from '../../../assets/brand/gba-logo.svg'
import { useI18n } from '../../../shared/i18n/useI18n'
import { ConsoleNav } from './ConsoleNav'
import { NotificationCenter } from './NotificationCenter'

const headerDateFormatter = new Intl.DateTimeFormat('uk-UA', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
})

export function ConsoleHeader() {
  const { logout, session, user } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()

  const displayName =
    user?.FullName ||
    [user?.FirstName, user?.LastName].filter(Boolean).join(' ') ||
    session?.userNetUid ||
    t('Робочий простір')
  const roleName = user?.UserRole?.Name?.trim()
  const currentDateLabel = headerDateFormatter.format(new Date())

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
          <NotificationCenter userKey={user?.NetUid || user?.Id?.toString() || session?.userNetUid} />
          <ActionIcon variant="subtle" color="gray" size="lg" aria-label={t('Вийти')} onClick={logout}>
            <LogOut size={24} strokeWidth={1.7} />
          </ActionIcon>
        </Group>

        <Group gap={6} wrap="nowrap" className="console-header-date">
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
