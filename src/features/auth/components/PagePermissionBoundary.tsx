import { Alert, Center, Loader } from '@mantine/core'
import { CircleAlert } from 'lucide-react'
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
    return (
      <Alert
        color="red"
        icon={<CircleAlert size={18} />}
        title="Доступ заборонено"
        variant="light"
      >
        У вашої ролі немає права переглядати цю сторінку.
      </Alert>
    )
  }

  return children
}
