import { Stack } from '@mantine/core'
import { SalesCockpitPage, HeadDashboardPage } from '../../sales-cockpit'
import { BuyerCockpitTab, ProcureDashboardTab } from '../../basket-supply-ukraine-order'
import type { DashboardWorkspaceKey, DashboardWorkspacePeriod } from '../types'
import { OperationsWorkspace } from './OperationsWorkspace'
import { SystemWorkspace } from './SystemWorkspace'
import { WorkspaceSummary } from './WorkspaceSummary'
import '../../basket-supply-ukraine-order/pages/basketSupplyUkraineOrder.css'

export function RoleDashboardWorkspace({
  period,
  workspaceKey,
}: {
  period: DashboardWorkspacePeriod
  workspaceKey: DashboardWorkspaceKey
}) {
  switch (workspaceKey) {
    case 'sales-manager':
      return <SalesCockpitPage />
    case 'sales-head':
      return <HeadDashboardPage />
    case 'buyer':
      return <BuyerCockpitTab />
    case 'buyer-head':
      return <ProcureDashboardTab />
    case 'gba':
      return <Stack gap="md"><WorkspaceSummary period={period} workspaceKey={workspaceKey} /><SystemWorkspace showDirectory /></Stack>
    case 'system':
      return <Stack gap="md"><WorkspaceSummary period={period} workspaceKey={workspaceKey} /><SystemWorkspace /></Stack>
    default:
      return <Stack gap="md"><WorkspaceSummary period={period} workspaceKey={workspaceKey} /><OperationsWorkspace workspaceKey={workspaceKey} /></Stack>
  }
}
