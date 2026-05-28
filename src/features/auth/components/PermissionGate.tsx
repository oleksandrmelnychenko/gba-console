import type { ReactNode } from 'react'
import { useAuth } from '../useAuth'

type PermissionGateProps = {
  children: ReactNode
  fallback?: ReactNode
  permissionKey: string
}

export function PermissionGate({ permissionKey, children, fallback = null }: PermissionGateProps) {
  const { hasPermission } = useAuth()

  return hasPermission(permissionKey) ? children : fallback
}
