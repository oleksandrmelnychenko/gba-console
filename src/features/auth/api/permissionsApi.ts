import { apiRequest } from '../../../shared/api/apiClient'

type MyPermissionsResponse = {
  catalogVersion?: string
  permissionKeys?: unknown
  PermissionKeys?: unknown
}

export type MyPermissions = {
  catalogVersion: string | null
  permissionKeys: string[]
}

export async function getMyPermissions(): Promise<MyPermissions> {
  const response = await apiRequest<MyPermissionsResponse>('/permissions/me')
  const rawKeys = response.permissionKeys ?? response.PermissionKeys
  const permissionKeys = Array.isArray(rawKeys)
    ? [...new Set(rawKeys.filter((key): key is string => typeof key === 'string' && Boolean(key.trim())).map((key) => key.trim()))]
    : []

  return {
    catalogVersion: typeof response.catalogVersion === 'string' ? response.catalogVersion : null,
    permissionKeys,
  }
}
