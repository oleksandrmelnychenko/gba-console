import { Group } from '@mantine/core'
import { useAuth } from '../../auth/useAuth'
import { AiFleetControl } from '../../ai-fleet/components/AiFleetControl'
import { canRunAiFleetWarmup } from '../../ai-fleet/utils/aiFleetAccess'
import { UserRoleType } from '../../../shared/auth/types'
import { OneCExportControl } from './OneCExportControl'
import { ProductWriteOffRulesControl } from './ProductWriteOffRulesControl'
import { SyncControl } from './SyncControl'

export function HeaderActionBar() {
  const { hasPermission, user } = useAuth()
  const isPrivilegedRole =
    user?.UserRole?.UserRoleType === UserRoleType.Administrator || user?.UserRole?.UserRoleType === UserRoleType.GBA
  const canOpenSync = hasPermission('HEADER_SyncButton_BTN') || isPrivilegedRole

  return (
    <Group gap={4} wrap="nowrap" className="console-header-tool-actions">
      <AiFleetControl canRunWarmup={canRunAiFleetWarmup(user)} />
      {canOpenSync && <SyncControl />}
      {canOpenSync && <OneCExportControl />}
      <ProductWriteOffRulesControl />
    </Group>
  )
}
