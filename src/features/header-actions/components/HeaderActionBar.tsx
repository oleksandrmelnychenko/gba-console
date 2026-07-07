import { ActionIcon, Group, Tooltip } from '@mantine/core'
import { ShoppingBasket } from 'lucide-react'
import type { ComponentType } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { AiFleetControl } from '../../ai-fleet/components/AiFleetControl'
import { UserRoleType } from '../../../shared/auth/types'
import { useI18n } from '../../../shared/i18n/useI18n'
import { ProductWriteOffRulesControl } from './ProductWriteOffRulesControl'
import { SyncControl } from './SyncControl'

type HeaderActionButtonProps = {
  icon: ComponentType<{ size?: number; strokeWidth?: number }>
  label: string
  onClick: () => void
}

export function HeaderActionBar() {
  const navigate = useNavigate()
  const { hasPermission, user } = useAuth()
  const { t } = useI18n()
  const isPrivilegedRole =
    user?.UserRole?.UserRoleType === UserRoleType.Administrator || user?.UserRole?.UserRoleType === UserRoleType.GBA
  const canOpenSync = hasPermission('HEADER_SyncButton_BTN') || isPrivilegedRole

  return (
    <Group gap={4} wrap="nowrap" className="console-header-tool-actions">
      <AiFleetControl />
      {canOpenSync && <SyncControl />}
      <ProductWriteOffRulesControl />
      <HeaderActionButton icon={ShoppingBasket} label={t('Кошик')} onClick={() => navigate('/basket-supply-ukraine-order')} />
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
        <Icon size={24} strokeWidth={1.7} />
      </ActionIcon>
    </Tooltip>
  )
}
