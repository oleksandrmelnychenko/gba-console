import { apiRequest } from '../../../shared/api/apiClient'

export type EventPermissionRisk = 'low' | 'medium' | 'high'

export type EventPermissionDefinition = {
  active: boolean
  backendPolicy?: string
  controlType: string
  description?: string
  groupId: string
  groupLabel: string
  key: string
  name: string
  pageId: string
  pageLabel: string
  risk: EventPermissionRisk
  route?: string
  sectionId: string
  sectionLabel: string
}

export type EventPermissionCatalog = {
  catalogVersion: string
  permissions: EventPermissionDefinition[]
}

export type RoleEventPermissions = {
  catalogVersion: string
  inheritedPermissionKeys?: string[]
  permissionKeys: string[]
  roleNetUid: string
  updatedAt?: string
  updatedBy?: string
  version: number
}

export async function getEventPermissionCatalog(
  signal?: AbortSignal,
): Promise<EventPermissionCatalog> {
  const result = await apiRequest<unknown>('/permissions/catalog', {
    query: { kind: 'event' },
    ...(signal ? { signal } : {}),
  })

  return normalizeCatalog(result)
}

export async function getRoleEventPermissions(
  roleNetUid: string,
  signal?: AbortSignal,
): Promise<RoleEventPermissions> {
  const result = await apiRequest<unknown>(
    `/usermanagement/profiles/roles/${encodeURIComponent(roleNetUid)}/event-permissions`,
    signal ? { signal } : undefined,
  )

  return normalizeRoleEventPermissions(result, roleNetUid)
}

export async function updateRoleEventPermissions(
  roleNetUid: string,
  expectedVersion: number,
  permissionKeys: string[],
): Promise<RoleEventPermissions> {
  const result = await apiRequest<unknown>(
    `/usermanagement/profiles/roles/${encodeURIComponent(roleNetUid)}/event-permissions`,
    {
      method: 'PUT',
      body: {
        expectedVersion,
        permissionKeys,
      },
    },
  )

  return normalizeRoleEventPermissions(result, roleNetUid)
}

function normalizeCatalog(result: unknown): EventPermissionCatalog {
  const record = asRecord(result)
  const rawPermissions = readArray(record, 'permissions', 'Permissions')

  return {
    catalogVersion: readString(record, 'catalogVersion', 'CatalogVersion'),
    permissions: rawPermissions
      .map(normalizePermissionDefinition)
      .filter((permission): permission is EventPermissionDefinition => Boolean(permission)),
  }
}

function normalizePermissionDefinition(value: unknown): EventPermissionDefinition | null {
  const record = asRecord(value)
  const key = readString(record, 'key', 'Key')
  const name = readString(record, 'name', 'Name')

  if (!key || !name) {
    return null
  }

  return {
    active: readBoolean(record, true, 'active', 'Active'),
    backendPolicy: readOptionalString(record, 'backendPolicy', 'BackendPolicy'),
    controlType: readString(record, 'controlType', 'ControlType') || 'event',
    description: readOptionalString(record, 'description', 'Description'),
    groupId: readString(record, 'groupId', 'GroupId') || 'actions',
    groupLabel: readString(record, 'groupLabel', 'GroupLabel') || 'Дії',
    key,
    name,
    pageId: readString(record, 'pageId', 'PageId') || 'shared',
    pageLabel: readString(record, 'pageLabel', 'PageLabel') || 'Спільні дії',
    risk: normalizeRisk(readString(record, 'risk', 'Risk')),
    route: readOptionalString(record, 'route', 'Route'),
    sectionId: readString(record, 'sectionId', 'SectionId') || 'shared',
    sectionLabel: readString(record, 'sectionLabel', 'SectionLabel') || 'Спільні дії',
  }
}

function normalizeRoleEventPermissions(
  result: unknown,
  fallbackRoleNetUid: string,
): RoleEventPermissions {
  const record = asRecord(result)

  return {
    catalogVersion: readString(record, 'catalogVersion', 'CatalogVersion'),
    inheritedPermissionKeys: readArray(
      record,
      'inheritedPermissionKeys',
      'InheritedPermissionKeys',
    ).filter((value): value is string => typeof value === 'string' && Boolean(value)),
    permissionKeys: readArray(record, 'permissionKeys', 'PermissionKeys').filter(
      (value): value is string => typeof value === 'string' && Boolean(value),
    ),
    roleNetUid:
      readString(record, 'roleNetUid', 'RoleNetUid', 'userRoleNetUid', 'UserRoleNetUid') ||
      fallbackRoleNetUid,
    updatedAt: readOptionalString(record, 'updatedAt', 'UpdatedAt'),
    updatedBy: readOptionalString(record, 'updatedBy', 'UpdatedBy'),
    version: readNumber(record, 'version', 'Version'),
  }
}

function normalizeRisk(value: string): EventPermissionRisk {
  const risk = value.toLocaleLowerCase()
  return risk === 'high' || risk === 'medium' ? risk : 'low'
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function readArray(record: Record<string, unknown>, ...keys: string[]): unknown[] {
  for (const key of keys) {
    if (Array.isArray(record[key])) {
      return record[key]
    }
  }

  return []
}

function readString(record: Record<string, unknown>, ...keys: string[]): string {
  return readOptionalString(record, ...keys) || ''
}

function readOptionalString(
  record: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = record[key]

    if (typeof value === 'string' && value) {
      return value
    }
  }

  return undefined
}

function readNumber(record: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const value = record[key]

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }

  return 0
}

function readBoolean(
  record: Record<string, unknown>,
  fallback: boolean,
  ...keys: string[]
): boolean {
  for (const key of keys) {
    const value = record[key]

    if (typeof value === 'boolean') {
      return value
    }
  }

  return fallback
}
