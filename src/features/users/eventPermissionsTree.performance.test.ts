import { describe, expect, it } from 'vitest'
import type { EventPermissionDefinition } from './api/eventPermissionsApi'
import {
  buildEventPermissionTree,
  filterEventPermissions,
} from './eventPermissionsTree'

describe('eventPermissionsTree large-catalog regression', () => {
  it('builds and searches a 2400-permission catalog in linear-scale time', () => {
    const permissions = createCatalog(2_400)

    const buildStartedAt = performance.now()
    const tree = buildEventPermissionTree(permissions)
    const buildMs = performance.now() - buildStartedAt

    const filterStartedAt = performance.now()
    const filtered = filterEventPermissions(
      permissions,
      { query: 'Дія 2399', risk: 'all', state: 'all' },
      new Set(),
    )
    const filterMs = performance.now() - filterStartedAt

    expect(tree).toHaveLength(24)
    expect(tree.flatMap((section) => section.pages)).toHaveLength(240)
    expect(filtered.map((permission) => permission.key)).toEqual([
      'section23.page9.group4.action9',
    ])
    expect(buildMs).toBeLessThan(1_000)
    expect(filterMs).toBeLessThan(500)

    console.info(
      `[event-permissions-tree-perf] build ${permissions.length}: ${buildMs.toFixed(1)}ms; search: ${filterMs.toFixed(1)}ms`,
    )
  })
})

function createCatalog(count: number): EventPermissionDefinition[] {
  return Array.from({ length: count }, (_, index) => {
    const section = Math.floor(index / 100)
    const page = Math.floor((index % 100) / 10)
    const group = Math.floor((index % 10) / 2)
    const action = index % 10

    return {
      active: true,
      controlType: action % 2 === 0 ? 'mutation' : 'navigation',
      description: `Опис дії ${index}`,
      groupId: `group-${group}`,
      groupLabel: `Група ${group}`,
      key: `section${section}.page${page}.group${group}.action${action}`,
      name: `Дія ${index}`,
      pageId: `page-${section}-${page}`,
      pageLabel: `Сторінка ${section}-${page}`,
      risk: action % 3 === 0 ? 'high' : action % 3 === 1 ? 'medium' : 'low',
      route: `/section-${section}/page-${page}`,
      sectionId: `section-${section}`,
      sectionLabel: `Розділ ${section}`,
    }
  })
}
