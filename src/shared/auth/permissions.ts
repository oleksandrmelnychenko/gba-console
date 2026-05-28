import { UserRoleType, type AuthUser } from './types'

export function hasPermission(user: AuthUser | undefined | null, permissionKey: string): boolean {
  if (!permissionKey) {
    return false
  }

  if (isPrivilegedRole(user)) {
    return true
  }

  return Boolean(user?.UserRole?.Permissions?.some((permission) => permission.ControlId === permissionKey))
}

function isPrivilegedRole(user: AuthUser | undefined | null): boolean {
  const roleType = user?.UserRole?.UserRoleType

  return roleType === UserRoleType.Administrator || roleType === UserRoleType.GBA
}
