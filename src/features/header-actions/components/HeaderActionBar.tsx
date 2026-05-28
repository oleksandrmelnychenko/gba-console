import { ActionIcon, Group, Tooltip } from '@mantine/core'
import { IconBasket, IconTruckReturn } from '@tabler/icons-react'
import type { ComponentType } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { UserRoleType } from '../../../shared/auth/types'
import { useI18n } from '../../../shared/i18n/useI18n'
import { ProductWriteOffRulesControl } from './ProductWriteOffRulesControl'
import { SyncControl } from './SyncControl'

type HeaderActionButtonProps = {
  icon: ComponentType<{ size?: number; stroke?: number }>
  label: string
  onClick: () => void
}

export function HeaderActionBar() {
  const navigate = useNavigate()
  const { hasPermission, user } = useAuth()
  const { t } = useI18n()
  const isPrivilegedRole =
    user?.UserRole?.UserRoleType === UserRoleType.Administrator || user?.UserRole?.UserRoleType === UserRoleType.GBA
  const canOpenResales = hasPermission('HEADER_ReSalesPage_BTN') || isPrivilegedRole
  const canOpenSync = hasPermission('HEADER_SyncButton_BTN') || isPrivilegedRole

  return (
    <Group gap={4} wrap="nowrap" className="console-header-tool-actions">
      {canOpenResales && (
        <HeaderActionButton icon={IconTruckReturn} label="Resales" onClick={() => navigate('/resales')} />
      )}
      {canOpenSync && <SyncControl />}
      <ProductWriteOffRulesControl />
      <HeaderActionButton icon={IconBasket} label={t('Кошик')} onClick={() => navigate('/basket-supply-ukraine-order')} />
    </Group>
  )
}

function HeaderActionButton({ icon: Icon, label, onClick }: HeaderActionButtonProps) {
  return (
    <Tooltip label={label} openDelay={300}>
      <ActionIcon
        aria-label={label}
        className="console-header-action"
        variant="subtle"
        color="gray"
        size="lg"
        onClick={onClick}
      >
        <Icon size={24} stroke={1.7} />
      </ActionIcon>
    </Tooltip>
  )
}
