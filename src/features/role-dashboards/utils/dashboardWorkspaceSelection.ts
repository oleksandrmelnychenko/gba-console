import type { DashboardWorkspaceCatalog, DashboardWorkspaceKey } from '../types'

export function resolveDashboardWorkspace(
  catalog: DashboardWorkspaceCatalog,
  requestedWorkspace: string | null | undefined,
): DashboardWorkspaceKey {
  if (
    catalog.canSwitchWorkspace
    && requestedWorkspace
    && catalog.workspaces.some((workspace) => workspace.key === requestedWorkspace)
  ) {
    return requestedWorkspace as DashboardWorkspaceKey
  }

  return catalog.defaultWorkspace
}
