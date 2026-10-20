import { Group } from '@mantine/core'
import { useAuth } from '../../auth/useAuth'
import { AiFleetControl } from '../../ai-fleet/components/AiFleetControl'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { ProductWriteOffRulesControl } from './ProductWriteOffRulesControl'
import { SyncControl } from './SyncControl'

export function HeaderActionBar() {
  const { hasPermission } = useAuth()
  const canOpenSync = hasPermission(PermissionKeys.OnlineShopSeo.Synchronization.Run)

  return (
    <Group gap={4} wrap="nowrap" className="console-header-tool-actions">
      <AiFleetControl canRunWarmup={canOpenSync} />
      {canOpenSync && <SyncControl />}
      <ProductWriteOffRulesControl />
    </Group>
  )
}
