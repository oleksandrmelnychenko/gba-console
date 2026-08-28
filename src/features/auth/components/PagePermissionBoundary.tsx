import { Center, Loader } from '@mantine/core'
import type { ReactNode } from 'react'
import type { PermissionKey } from '../../../shared/auth/permissionKeys'
import { usePermissions } from '../usePermissions'

type PagePermissionBoundaryProps = {
  children: ReactNode
  permissionKey: PermissionKey
}

export function PagePermissionBoundary({
  children,
  permissionKey,
}: PagePermissionBoundaryProps) {
  const { can, isLoading } = usePermissions()

  if (isLoading) {
    return (
      <Center mih={160}>
        <Loader aria-label="Завантаження прав доступу" size="sm" />
      </Center>
    )
  }

  if (!can(permissionKey)) {
    return null
  }

  return children
}
