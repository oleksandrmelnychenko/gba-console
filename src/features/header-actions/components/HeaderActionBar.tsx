import { Group } from '@mantine/core'
import { useAuth } from '../../auth/useAuth'
import { AiFleetControl } from '../../ai-fleet/components/AiFleetControl'
import { OneCExportControl } from '../../onec-export/components/OneCExportControl'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { useSystemOfRecordCutover } from '../../../shared/system-of-record/systemOfRecordCutover'
import { ProductWriteOffRulesControl } from './ProductWriteOffRulesControl'
import { ResaleControl } from './ResaleControl'
import { SyncControl } from './SyncControl'

export function HeaderActionBar() {
  const { hasPermission } = useAuth()
  const { isActive: afterCutover } = useSystemOfRecordCutover()
  const canOpenSync = hasPermission(PermissionKeys.OnlineShopSeo.Synchronization.Run)
  const canExportToOneC = hasPermission(PermissionKeys.Operational.OneCExport.Run)
  // The shortcut needs its own header key and access to the Resale screen itself.
  const canOpenResale = hasPermission(PermissionKeys.OnlineShopSeo.Resale.Open)
    && hasPermission(PermissionKeys.Resales.Page.View)
  // The global write-off rules (and their counter badge) need products.assortment.write_off_rules.open.
  const canOpenWriteOffRules = hasPermission(PermissionKeys.ProductsAssortment.WriteOffRules.Open)
  // AI service status has its own key (inherited by every dashboard holder on the server).
  const canSeeAiFleet = hasPermission(PermissionKeys.Operational.AiFleet.View)

  return (
    <Group gap={4} wrap="nowrap" className="console-header-tool-actions">
      {canSeeAiFleet && <AiFleetControl canRunWarmup={canOpenSync} />}
      {canOpenSync && !afterCutover && <SyncControl />}
      {canOpenResale && <ResaleControl />}
      {canExportToOneC && <OneCExportControl />}
      {canOpenWriteOffRules && <ProductWriteOffRulesControl />}
    </Group>
  )
}
