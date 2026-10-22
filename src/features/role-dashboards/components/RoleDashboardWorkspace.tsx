import { Stack } from '@mantine/core'
import { SalesCockpitPage, HeadDashboardPage } from '../../sales-cockpit'
import { ProcureDashboardTab } from '../../basket-supply-ukraine-order'
import type { DashboardWorkspaceKey, DashboardWorkspacePeriod } from '../types'
import { BuyerWorkspace } from '../../basket-supply-ukraine-order/components/BuyerWorkspace'
import { useWorkspaceSummary } from '../hooks/useWorkspaceSummary'
import { OperationsWorkspace } from './OperationsWorkspace'
import { SystemWorkspace } from './SystemWorkspace'
import { WorkspaceSummary } from './WorkspaceSummary'
import '../../basket-supply-ukraine-order/pages/basketSupplyUkraineOrder.css'

type WorkspaceProps = {
  period: DashboardWorkspacePeriod
  toolbarTarget?: HTMLElement | null
  workspaceKey: DashboardWorkspaceKey
}

export function RoleDashboardWorkspace(props: WorkspaceProps) {
  switch (props.workspaceKey) {
    case 'sales-manager':
      return <SalesCockpitPage />
    case 'sales-head':
      return <HeadDashboardPage />
    case 'buyer':
      return <BuyerWorkspace />
    case 'buyer-head':
      return <ProcureDashboardTab />
    default:
      return <SummaryWorkspace {...props} />
  }
}

function SummaryWorkspace({ period, toolbarTarget, workspaceKey }: WorkspaceProps) {
  const state = useWorkspaceSummary(workspaceKey, period)
  const summary = <WorkspaceSummary state={state} toolbarTarget={toolbarTarget} />

  if (workspaceKey === 'gba') {
    return <Stack className="role-dashboard-gba-workspace" gap={6}>{summary}<SystemWorkspace showDirectory /></Stack>
  }

  if (workspaceKey === 'system') {
    return <Stack gap={6}>{summary}<SystemWorkspace /></Stack>
  }

  return <Stack gap={6}>{summary}<OperationsWorkspace error={state.error} summary={state.summary} workspaceKey={workspaceKey} /></Stack>
}
