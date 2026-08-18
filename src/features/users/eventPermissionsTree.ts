import type {
  EventPermissionDefinition,
  EventPermissionRisk,
} from './api/eventPermissionsApi'

export type EventPermissionGroup = {
  id: string
  label: string
  permissions: EventPermissionDefinition[]
}

export type EventPermissionPage = {
  groups: EventPermissionGroup[]
  id: string
  label: string
  route?: string
}

export type EventPermissionSection = {
  id: string
  label: string
  pages: EventPermissionPage[]
}

export type EventPermissionStateFilter = 'all' | 'selected' | 'unselected'
export type EventPermissionRiskFilter = 'all' | EventPermissionRisk

export type EventPermissionFilters = {
  query: string
  risk: EventPermissionRiskFilter
  state: EventPermissionStateFilter
}

export type SelectionState = {
  checked: boolean
  indeterminate: boolean
}

export function buildEventPermissionTree(
  permissions: EventPermissionDefinition[],
): EventPermissionSection[] {
  const uniquePermissions = new Map<string, EventPermissionDefinition>()

  permissions.forEach((permission) => {
    if (permission.active && !uniquePermissions.has(permission.key)) {
      uniquePermissions.set(permission.key, permission)
    }
  })

  const sections = new Map<
    string,
    {
      label: string
      pages: Map<
        string,
        {
          groups: Map<string, EventPermissionGroup>
          label: string
          route?: string
        }
      >
    }
  >()

  uniquePermissions.forEach((permission) => {
    const section = getOrCreate(sections, permission.sectionId, () => ({
      label: permission.sectionLabel,
      pages: new Map(),
    }))
    const page = getOrCreate(section.pages, permission.pageId, () => ({
      groups: new Map(),
      label: permission.pageLabel,
      route: permission.route,
    }))
    const group = getOrCreate(page.groups, permission.groupId, () => ({
      id: permission.groupId,
      label: permission.groupLabel,
      permissions: [] as EventPermissionDefinition[],
    }))

    group.permissions.push(permission)
  })

  return Array.from(sections, ([id, section]) => ({
    id,
    label: section.label,
    pages: Array.from(section.pages, ([pageId, page]) => ({
      groups: Array.from(page.groups.values())
        .map((group) => ({
          ...group,
          permissions: [...group.permissions].sort(comparePermission),
        }))
        .sort((left, right) => compareLabel(left.label, right.label)),
      id: pageId,
      label: page.label,
      route: page.route,
    })).sort((left, right) => compareLabel(left.label, right.label)),
  })).sort((left, right) => compareLabel(left.label, right.label))
}

export function filterEventPermissions(
  permissions: EventPermissionDefinition[],
  filters: EventPermissionFilters,
  selectedKeys: ReadonlySet<string>,
): EventPermissionDefinition[] {
  const query = filters.query.trim().toLocaleLowerCase('uk')

  return permissions.filter((permission) => {
    if (!permission.active) {
      return false
    }

    if (filters.risk !== 'all' && permission.risk !== filters.risk) {
      return false
    }

    const selected = selectedKeys.has(permission.key)
    if (filters.state === 'selected' && !selected) {
      return false
    }
    if (filters.state === 'unselected' && selected) {
      return false
    }

    if (!query) {
      return true
    }

    return [
      permission.name,
      permission.description,
      permission.key,
      permission.sectionLabel,
      permission.pageLabel,
      permission.route,
      permission.groupLabel,
      permission.controlType,
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('uk')
      .includes(query)
  })
}

export function getTreePermissionKeys(
  section: EventPermissionSection,
): string[] {
  return section.pages.flatMap(getPagePermissionKeys)
}

export function getPagePermissionKeys(page: EventPermissionPage): string[] {
  return page.groups.flatMap(getGroupPermissionKeys)
}

export function getGroupPermissionKeys(group: EventPermissionGroup): string[] {
  return group.permissions.map((permission) => permission.key)
}

export function getSelectionState(
  keys: readonly string[],
  selectedKeys: ReadonlySet<string>,
): SelectionState {
  const selectedCount = keys.reduce(
    (count, key) => count + (selectedKeys.has(key) ? 1 : 0),
    0,
  )

  return {
    checked: keys.length > 0 && selectedCount === keys.length,
    indeterminate: selectedCount > 0 && selectedCount < keys.length,
  }
}

export function togglePermissionKeys(
  selectedKeys: ReadonlySet<string>,
  keys: readonly string[],
): Set<string> {
  const next = new Set(selectedKeys)
  const shouldSelect = keys.some((key) => !next.has(key))

  keys.forEach((key) => {
    if (shouldSelect) {
      next.add(key)
    } else {
      next.delete(key)
    }
  })

  return next
}

export function haveSamePermissionKeys(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>,
): boolean {
  return left.size === right.size && Array.from(left).every((key) => right.has(key))
}

function getOrCreate<Key, Value>(
  map: Map<Key, Value>,
  key: Key,
  create: () => Value,
): Value {
  const existing = map.get(key)

  if (existing) {
    return existing
  }

  const value = create()
  map.set(key, value)
  return value
}

function comparePermission(
  left: EventPermissionDefinition,
  right: EventPermissionDefinition,
): number {
  return compareLabel(left.name, right.name) || compareLabel(left.key, right.key)
}

function compareLabel(left: string, right: string): number {
  return left.localeCompare(right, 'uk', { sensitivity: 'base' })
}
