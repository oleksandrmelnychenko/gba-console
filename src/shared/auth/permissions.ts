import { isEventPermissionKey } from './permissionKeys'

export type RuntimePermissionKeys = readonly string[] | null

export function getEffectivePermissionKeys(
  runtimePermissionKeys: RuntimePermissionKeys = null,
): string[] {
  if (runtimePermissionKeys === null) {
    return []
  }

  return [...new Set(runtimePermissionKeys.filter(isEventPermissionKey))]
}

export function hasPermission(
  permissionKey: string,
  runtimePermissionKeys: RuntimePermissionKeys = null,
): boolean {
  return isEventPermissionKey(permissionKey)
    && getEffectivePermissionKeys(runtimePermissionKeys).includes(permissionKey)
}
