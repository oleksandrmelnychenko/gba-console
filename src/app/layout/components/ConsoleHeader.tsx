import { AppShell, Box, Group, Title, Text } from '@mantine/core'
import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../features/auth/useAuth'
import { HeaderActionBar } from '../../../features/header-actions/components/HeaderActionBar'
import gbaLogo from '../../../assets/brand/gba-logo.svg'
import { useI18n } from '../../../shared/i18n/useI18n'
import { ConsoleNav } from './ConsoleNav'
import { DataEnvironmentSwitch } from './DataEnvironmentSwitch'
import { NotificationCenter } from './NotificationCenter'
import { ConsoleAccountMenu } from './ConsoleAccountMenu'

const SIDE_SELECTORS = ['.console-header-brand', '.console-header-date', '.console-header-actions', '.console-header-user-panel'] as const

function pixels(value: string): number {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function useHeaderNavWidth(main: RefObject<HTMLDivElement | null>) {
  const [width, setWidth] = useState<number>()

  useLayoutEffect(() => {
    const node = main.current
    if (!node) return
    const sides = SIDE_SELECTORS.map(selector => node.querySelector<HTMLElement>(selector))
    const read = () => {
      if (!node.clientWidth) return
      const style = getComputedStyle(node)
      if (style.gridTemplateColumns.trim().split(/\s+/).length !== 3) {
        setWidth(undefined)
        return
      }
      const [brand, date, actions, user] = sides.map(side => side?.getBoundingClientRect().width ?? 0)
      const next = Math.max(0, Math.floor(node.clientWidth - pixels(style.paddingLeft) - pixels(style.paddingRight)
        - 2 * pixels(style.columnGap) - Math.max(brand, date) - Math.max(actions, user)))
      setWidth(current => current === next ? current : next)
    }
    read()
    const observer = new ResizeObserver(read)
    observer.observe(node)
    for (const side of sides) if (side) observer.observe(side)
    return () => observer.disconnect()
  }, [main])

  return width
}

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
  const headerRef = useRef<HTMLDivElement>(null)
  const navWidth = useHeaderNavWidth(headerRef)

  return (
    <AppShell.Header className="console-header">
      <Box ref={headerRef} className="console-header-main">
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
          <ConsoleNav mode="modules" availableWidth={navWidth} />
        </Box>

        <Group gap="xs" wrap="nowrap" className="console-header-actions">
          <HeaderActionBar />
          <NotificationCenter userKey={user?.NetUid || user?.Id?.toString() || session?.userNetUid} />
        </Group>

        <Group gap={6} wrap="nowrap" className="console-header-date">
          <Text size="sm">{currentDateLabel}</Text>
        </Group>

        <Box className="console-header-bottom-nav">
          <ConsoleNav mode="items" availableWidth={navWidth} />
        </Box>

        <Group gap="xs" wrap="nowrap" className="console-header-user-panel">
          <DataEnvironmentSwitch />
          <ConsoleAccountMenu displayName={displayName} email={user?.Email} roleName={roleName} onLogout={logout} />
        </Group>
      </Box>
    </AppShell.Header>
  )
}
