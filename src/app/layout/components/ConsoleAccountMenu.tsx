import { Box, Menu, Text } from '@mantine/core'
import { ChevronDown, LogOut, UserRound } from 'lucide-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { TableChip } from '../../../shared/ui/TableChip'
import './console-account-menu.css'

type Props = {
  displayName: string
  email?: string
  roleName?: string
  onLogout: () => void
}

export function ConsoleAccountMenu({ displayName, email, roleName, onLogout }: Props) {
  const { t } = useI18n()
  const visibleEmail = email?.trim()

  return (
    <Menu position="bottom-end" offset={6} width={280} withinPortal shadow="md" radius="md">
      <Menu.Target>
        <button
          type="button"
          className="console-account-trigger"
          aria-label={`${t('Обліковий запис')}: ${displayName}`}
        >
          <Box component="span" className="console-account-mobile-icon" hiddenFrom="xs" aria-hidden="true">
            <UserRound size={18} />
          </Box>
          <Text component="span" className="console-header-user" visibleFrom="xs" size="sm" fw={600}>
            {displayName}
          </Text>
          <ChevronDown className="console-account-chevron" size={14} aria-hidden="true" />
        </button>
      </Menu.Target>
      <Menu.Dropdown className="console-account-menu">
        <div className="console-account-details">
          <span className="console-account-name">{displayName}</span>
          {visibleEmail && <span className="console-account-email">{visibleEmail}</span>}
          {roleName && (
            <div className="console-account-role-row">
              <span>{t('Роль')}</span>
              <TableChip tone="product" value={roleName} />
            </div>
          )}
        </div>
        <Menu.Divider />
        <Menu.Item className="console-account-menu-item" leftSection={<LogOut size={16} />} onClick={onLogout}>
          {t('Вийти')}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}
