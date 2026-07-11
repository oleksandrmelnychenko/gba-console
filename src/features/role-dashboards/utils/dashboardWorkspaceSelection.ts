import type { DashboardWorkspaceCatalog, DashboardWorkspaceKey } from '../types'

export type DashboardWorkspaceSelectGroup = {
  group: string
  items: Array<{ label: string; value: DashboardWorkspaceKey }>
}

export function groupDashboardWorkspaceOptions(
  catalog: DashboardWorkspaceCatalog,
  translate: (value: string) => string,
): DashboardWorkspaceSelectGroup[] {
  const groups = new Map<string, DashboardWorkspaceSelectGroup>()

  catalog.workspaces.forEach((workspace) => {
    const translatedGroup = translate(workspace.group)
    const group = groups.get(translatedGroup) ?? { group: translatedGroup, items: [] }

    group.items.push({ label: translate(workspace.name), value: workspace.key })
    groups.set(translatedGroup, group)
  })

  return Array.from(groups.values())
}

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
