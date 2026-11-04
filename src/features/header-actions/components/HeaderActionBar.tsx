import { Group } from '@mantine/core'
import { useAuth } from '../../auth/useAuth'
import { AiFleetControl } from '../../ai-fleet/components/AiFleetControl'
import { OneCExportControl } from '../../onec-export/components/OneCExportControl'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { useSystemOfRecordCutover } from '../../../shared/system-of-record/systemOfRecordCutover'
import { ProductWriteOffRulesControl } from './ProductWriteOffRulesControl'
import { SyncControl } from './SyncControl'

export function HeaderActionBar() {
  const { hasPermission } = useAuth()
  const { isActive: afterCutover } = useSystemOfRecordCutover()
  const canOpenSync = hasPermission(PermissionKeys.OnlineShopSeo.Synchronization.Run)
  const canExportToOneC = hasPermission(PermissionKeys.Operational.OneCExport.Run)

  return (
    <Group gap={4} wrap="nowrap" className="console-header-tool-actions">
      <AiFleetControl canRunWarmup={canOpenSync} />
      {canOpenSync && !afterCutover && <SyncControl />}
      {canExportToOneC && <OneCExportControl />}
      <ProductWriteOffRulesControl />
    </Group>
  )
}
