import type { ReactNode } from 'react'
import { Can } from './Can'

type PermissionGateProps = {
  children: ReactNode
  fallback?: ReactNode
  permissionKey: string
}

export function PermissionGate({ permissionKey, children, fallback = null }: PermissionGateProps) {
  return (
    <Can fallback={fallback} permission={permissionKey}>
      {children}
    </Can>
  )
}
