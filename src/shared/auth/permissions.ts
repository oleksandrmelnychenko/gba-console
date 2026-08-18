import { UserRoleType, type AuthUser } from './types'
import { isEventPermissionKey, PermissionAliases } from './permissionKeys'

export type RuntimePermissionKeys = readonly string[] | null

export function getProfilePermissionKeys(user: AuthUser | undefined | null): string[] {
  return (user?.UserRole?.Permissions ?? []).flatMap((permission) => {
    const key = permission.ControlId?.trim()

    return key ? [key] : []
  })
}

export function getEffectivePermissionKeys(
  user: AuthUser | undefined | null,
  runtimePermissionKeys: RuntimePermissionKeys = null,
): string[] {
  const keys = new Set([
    ...getProfilePermissionKeys(user),
    ...(runtimePermissionKeys ?? []),
  ])

  for (const [canonicalKey, aliases] of Object.entries(PermissionAliases)) {
    if (aliases?.some((alias) => keys.has(alias))) {
      keys.add(canonicalKey)
    }
  }

  return [...keys]
}

export function hasPermission(
  user: AuthUser | undefined | null,
  permissionKey: string,
  runtimePermissionKeys: RuntimePermissionKeys = null,
): boolean {
  if (!permissionKey) {
    return false
  }

  if (isPrivilegedRole(user)) {
    return true
  }

  const effectiveKeys = new Set(getEffectivePermissionKeys(user, runtimePermissionKeys))

  if (effectiveKeys.has(permissionKey)) {
    return true
  }

  if (!isEventPermissionKey(permissionKey)) {
    return false
  }

  const aliases = PermissionAliases[permissionKey] ?? []

  if (aliases.some((alias) => effectiveKeys.has(alias))) {
    return true
  }

  // `null` means that the new endpoint is not deployed/reachable yet. Preserve
  // formerly unguarded presentation events in that compatibility state. Once
  // `/permissions/me` responds (including with []), canonical checks are strict.
  return runtimePermissionKeys === null && aliases.length === 0
}

export function isPrivilegedRole(user: AuthUser | undefined | null): boolean {
  const roleType = user?.UserRole?.UserRoleType

  return roleType === UserRoleType.Administrator || roleType === UserRoleType.GBA
}
