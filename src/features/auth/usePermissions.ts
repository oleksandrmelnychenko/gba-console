import { useCallback } from 'react'
import type { PermissionKey } from '../../shared/auth/permissionKeys'
import { useAuth } from './useAuth'

export function usePermissions() {
  const { hasPermission, isPermissionsLoading = false, permissions = [] } = useAuth()
  const can = useCallback(
    (permission: PermissionKey | string) => hasPermission(permission),
    [hasPermission],
  )
  const cannot = useCallback(
    (permission: PermissionKey | string) => !hasPermission(permission),
    [hasPermission],
  )

  return {
    can,
    cannot,
    isLoading: isPermissionsLoading,
    permissions,
  }
}
