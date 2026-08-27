import { describe, expect, it } from 'vitest'
import type { EventPermissionDefinition } from './api/eventPermissionsApi'
import {
  buildEventPermissionTree,
  filterEventPermissions,
  getSelectionState,
  haveSamePermissionKeys,
  togglePermissionKeys,
} from './eventPermissionsTree'

function permission(
  key: string,
  overrides: Partial<EventPermissionDefinition> = {},
): EventPermissionDefinition {
  return {
    active: true,
    controlType: 'mutation',
    groupId: 'sale-actions',
    groupLabel: 'Дії з продажем',
    key,
    name: key,
    pageId: 'sales.ukraine.all',
    pageLabel: 'Усі продажі України',
    risk: 'high',
    route: '/sales/ukraine/all',
    sectionId: 'sales',
    sectionLabel: 'Продажі',
    ...overrides,
  }
}

describe('eventPermissionsTree', () => {
  it('builds section -> page -> group -> permission and removes duplicate keys', () => {
    const tree = buildEventPermissionTree([
      permission('sales.ukraine.sale.edit', { name: 'Редагувати продаж' }),
      permission('sales.ukraine.sale.edit', { name: 'Дублікат' }),
      permission('sales.ukraine.sale.delete', { name: 'Видалити продаж' }),
      permission('inactive', { active: false }),
    ])

    expect(tree).toHaveLength(1)
    expect(tree[0].pages).toHaveLength(1)
    expect(tree[0].pages[0].groups).toHaveLength(1)
    expect(tree[0].pages[0].groups[0].permissions.map((item) => item.key)).toEqual([
      'sales.ukraine.sale.delete',
      'sales.ukraine.sale.edit',
    ])
  })

  it('calculates checked and indeterminate branch state', () => {
    expect(getSelectionState(['a', 'b'], new Set())).toEqual({
      checked: false,
      indeterminate: false,
    })
    expect(getSelectionState(['a', 'b'], new Set(['a']))).toEqual({
      checked: false,
      indeterminate: true,
    })
    expect(getSelectionState(['a', 'b'], new Set(['a', 'b']))).toEqual({
      checked: true,
      indeterminate: false,
    })
  })

  it('selects a partial branch and clears a fully selected branch', () => {
    expect(togglePermissionKeys(new Set(['a']), ['a', 'b'])).toEqual(
      new Set(['a', 'b']),
    )
    expect(togglePermissionKeys(new Set(['a', 'b', 'other']), ['a', 'b'])).toEqual(
      new Set(['other']),
    )
  })

  it('filters by human text, risk and selected state', () => {
    const permissions = [
      permission('sales.ukraine.sale.edit', {
        name: 'Редагувати продаж',
        risk: 'high',
      }),
      permission('sales.ukraine.sale.view', {
        name: 'Перегляд продажів',
        risk: 'low',
      }),
    ]

    expect(
      filterEventPermissions(
        permissions,
        { query: 'редагувати', risk: 'high', state: 'selected' },
        new Set(['sales.ukraine.sale.edit']),
      ).map((item) => item.key),
    ).toEqual(['sales.ukraine.sale.edit'])
  })

  it('compares permission sets without depending on insertion order', () => {
    expect(haveSamePermissionKeys(new Set(['a', 'b']), new Set(['b', 'a']))).toBe(true)
    expect(haveSamePermissionKeys(new Set(['a']), new Set(['a', 'b']))).toBe(false)
  })
})
