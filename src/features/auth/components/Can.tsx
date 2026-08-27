import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import type { PermissionKey } from '../../../shared/auth/permissionKeys'
import { usePermissions } from '../usePermissions'

type CanProps = {
  children: ReactNode
  deniedReason?: string
  fallback?: ReactNode
  mode?: 'disable' | 'hide'
  permission: PermissionKey | string
}

export function Can({
  children,
  deniedReason = 'Недостатньо прав для цієї дії',
  fallback = null,
  mode = 'hide',
  permission,
}: CanProps) {
  const { can } = usePermissions()

  if (can(permission)) {
    return children
  }

  if (mode === 'hide') {
    return fallback
  }

  if (!isValidElement(children)) {
    return fallback
  }

  const child = children as ReactElement<Record<string, unknown>>

  return cloneElement(child, {
    'aria-disabled': true,
    disabled: true,
    title: deniedReason,
  })
}
