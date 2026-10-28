import { describe, expect, it } from 'vitest'
import type { CounterpartyGroupNode } from './api/counterpartyGroupsApi'
import {
  BUYERS_GROUP_KEY,
  buildCounterpartyGroupForest,
  canHaveSubgroups,
  counterpartyGroupDescendants,
  counterpartyGroupParentChoices,
  counterpartyGroupPath,
  filterCounterpartyGroupForest,
  OUTSIDE_GROUP_KEY,
  UNGROUPED_GROUP_KEY,
} from './counterpartyGroupTree'

const id = (value: number) => `00000000-0000-0000-0000-${String(value).padStart(12, '0')}`

function group(value: number, name: string, parent: number | null, overrides: Partial<CounterpartyGroupNode> = {}): CounterpartyGroupNode {
  return {
    NetUid: id(value),
    ParentNetUid: parent === null ? null : id(parent),
    Key: String(value).padStart(32, '0'),
    Name: name,
    Code: null,
    RegionCode: null,
    IsSystem: false,
    IsUngrouped: false,
    IsFromOneC: true,
    IsManuallyEdited: false,
    ClientCount: 0,
    ...overrides,
  }
}

const groups = [
  group(1, 'Покупці', null, { IsSystem: true, Key: BUYERS_GROUP_KEY }),
  group(2, 'Без групи (клієнти AMG і GBA)', 1, { IsSystem: true, IsUngrouped: true, Key: UNGROUPED_GROUP_KEY }),
  group(3, 'Харків', 1, { RegionCode: 'KH00' }),
  group(4, 'Харків - Скляр', 3),
  group(5, 'Апостолове', 1),
  group(6, 'Поза групами', null, { IsSystem: true, Key: OUTSIDE_GROUP_KEY }),
  group(7, 'Постачальники', null),
]

describe('counterparty group tree', () => {
  it('nests groups under their parents with system groups first and names in Ukrainian order', () => {
    const forest = buildCounterpartyGroupForest(groups)
    expect(forest.map((branch) => branch.group.Name)).toEqual(['Покупці', 'Поза групами', 'Постачальники'])
    expect(forest[0].children.map((branch) => branch.group.Name))
      .toEqual(['Без групи (клієнти AMG і GBA)', 'Апостолове', 'Харків'])
    expect(forest[0].children[2].children.map((branch) => branch.group.Name)).toEqual(['Харків - Скляр'])
  })

  it('keeps the ancestors of matching groups when filtering by name or region code', () => {
    const forest = buildCounterpartyGroupForest(groups)
    const byName = filterCounterpartyGroupForest(forest, 'скляр')
    expect(byName.map((branch) => branch.group.Name)).toEqual(['Покупці'])
    expect(byName[0].children.map((branch) => branch.group.Name)).toEqual(['Харків'])
    expect(filterCounterpartyGroupForest(forest, 'kh00')[0].children.map((branch) => branch.group.Name)).toEqual(['Харків'])
    expect(filterCounterpartyGroupForest(forest, '')).toHaveLength(3)
  })

  it('treats a parent cycle or a missing parent as a root instead of looping', () => {
    const cyclic = [group(10, 'А', 11), group(11, 'Б', 10), group(12, 'В', 99)]
    const forest = buildCounterpartyGroupForest(cyclic)
    expect(forest.map((branch) => branch.group.Name)).toEqual(['В'])
  })

  it('builds the path and refuses moving a group into its own subtree', () => {
    expect(counterpartyGroupPath(groups, id(4))).toBe('Покупці / Харків / Харків - Скляр')
    expect([...counterpartyGroupDescendants(groups, id(3))].sort()).toEqual([id(3), id(4)])
    const choices = counterpartyGroupParentChoices(groups, id(3)).map((choice) => choice.value)
    expect(choices).not.toContain(id(3))
    expect(choices).not.toContain(id(4))
    expect(choices).not.toContain(id(2))
    expect(choices).not.toContain(id(6))
    expect(choices).toContain(id(1))
  })

  it('allows subgroups everywhere except «Без групи» and «Поза групами»', () => {
    expect(canHaveSubgroups(groups[0])).toBe(true)
    expect(canHaveSubgroups(groups[1])).toBe(false)
    expect(canHaveSubgroups(groups[5])).toBe(false)
    expect(canHaveSubgroups(groups[6])).toBe(true)
  })
})
