import type { CounterpartyGroupNode } from './api/counterpartyGroupsApi'

export type CounterpartyGroupBranch = {
  group: CounterpartyGroupNode
  children: CounterpartyGroupBranch[]
}

const collator = new Intl.Collator('uk', { sensitivity: 'base', numeric: true })

function groupRank(group: CounterpartyGroupNode): number {
  if (group.Key.toUpperCase() === BUYERS_GROUP_KEY) return 0
  return group.IsSystem ? 1 : 2
}

function compareGroups(left: CounterpartyGroupNode, right: CounterpartyGroupNode): number {
  return groupRank(left) - groupRank(right) || collator.compare(left.Name, right.Name) || left.NetUid.localeCompare(right.NetUid)
}

export function buildCounterpartyGroupForest(groups: readonly CounterpartyGroupNode[]): CounterpartyGroupBranch[] {
  const byNetUid = new Map(groups.map((group) => [group.NetUid, group]))
  const children = new Map<string, CounterpartyGroupNode[]>()
  const roots: CounterpartyGroupNode[] = []
  for (const group of groups) {
    const parent = group.ParentNetUid && group.ParentNetUid !== group.NetUid ? byNetUid.get(group.ParentNetUid) : undefined
    if (!parent) {
      roots.push(group)
      continue
    }
    const siblings = children.get(parent.NetUid) ?? []
    siblings.push(group)
    children.set(parent.NetUid, siblings)
  }
  const visited = new Set<string>()
  const build = (group: CounterpartyGroupNode): CounterpartyGroupBranch => {
    visited.add(group.NetUid)
    return {
      group,
      children: [...(children.get(group.NetUid) ?? [])].sort(compareGroups)
        .filter((child) => !visited.has(child.NetUid)).map(build),
    }
  }
  return [...roots].sort(compareGroups).map(build)
}

export function filterCounterpartyGroupForest(forest: readonly CounterpartyGroupBranch[], query: string): CounterpartyGroupBranch[] {
  const needle = query.trim().toLocaleLowerCase('uk')
  if (!needle) return [...forest]
  const keep = (branch: CounterpartyGroupBranch): CounterpartyGroupBranch | null => {
    const children = branch.children.map(keep).filter((child): child is CounterpartyGroupBranch => child !== null)
    const matches = branch.group.Name.toLocaleLowerCase('uk').includes(needle)
      || (branch.group.RegionCode ?? '').toLocaleLowerCase('uk').includes(needle)
    return matches || children.length > 0 ? { group: branch.group, children } : null
  }
  return forest.map(keep).filter((branch): branch is CounterpartyGroupBranch => branch !== null)
}

export function counterpartyGroupDescendants(groups: readonly CounterpartyGroupNode[], netUid: string): Set<string> {
  const result = new Set<string>([netUid])
  let added = true
  while (added) {
    added = false
    for (const group of groups) {
      if (group.ParentNetUid && result.has(group.ParentNetUid) && !result.has(group.NetUid)) {
        result.add(group.NetUid)
        added = true
      }
    }
  }
  return result
}

export function counterpartyGroupPath(groups: readonly CounterpartyGroupNode[], netUid: string): string {
  const byNetUid = new Map(groups.map((group) => [group.NetUid, group]))
  const names: string[] = []
  const visited = new Set<string>()
  let current = byNetUid.get(netUid)
  while (current && !visited.has(current.NetUid)) {
    visited.add(current.NetUid)
    names.unshift(current.Name)
    current = current.ParentNetUid ? byNetUid.get(current.ParentNetUid) : undefined
  }
  return names.join(' / ')
}

export const BUYERS_GROUP_KEY = '8AB2005056C0000811DEFC4535BB4D40'
export const UNGROUPED_GROUP_KEY = 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF1'
export const OUTSIDE_GROUP_KEY = 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF2'

export function canHaveSubgroups(group: CounterpartyGroupNode): boolean {
  const key = group.Key.toUpperCase()
  return key !== UNGROUPED_GROUP_KEY && key !== OUTSIDE_GROUP_KEY
}

export function counterpartyGroupParentChoices(groups: readonly CounterpartyGroupNode[], editedNetUid?: string | null) {
  const excluded = editedNetUid ? counterpartyGroupDescendants(groups, editedNetUid) : new Set<string>()
  return groups.filter((group) => !excluded.has(group.NetUid) && canHaveSubgroups(group))
    .map((group) => ({ value: group.NetUid, label: counterpartyGroupPath(groups, group.NetUid) }))
    .sort((left, right) => collator.compare(left.label, right.label))
}
