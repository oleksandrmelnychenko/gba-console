import { describe, expect, it } from 'vitest'
import type { DashboardWorkspaceCatalog } from '../types'
import { resolveDashboardWorkspace } from './dashboardWorkspaceSelection'

const gbaCatalog: DashboardWorkspaceCatalog = {
  canSwitchWorkspace: true,
  defaultWorkspace: 'gba',
  workspaces: [
    { group: 'Система', isAi: true, key: 'gba', name: 'Огляд GBA' },
    { group: 'Продажі', isAi: true, key: 'sales-head', name: 'Відділ продажів' },
  ],
}

describe('resolveDashboardWorkspace', () => {
  it('allows GBA to select an entitled dashboard', () => {
    expect(resolveDashboardWorkspace(gbaCatalog, 'sales-head')).toBe('sales-head')
  })

  it('rejects unknown dashboard keys', () => {
    expect(resolveDashboardWorkspace(gbaCatalog, 'polish-logistics')).toBe('gba')
  })

  it('ignores URL overrides for an ordinary role', () => {
    expect(resolveDashboardWorkspace({
      canSwitchWorkspace: false,
      defaultWorkspace: 'accounting',
      workspaces: [{ group: 'Фінанси', isAi: false, key: 'accounting', name: 'Бухгалтерія' }],
    }, 'sales-head')).toBe('accounting')
  })
})
