import { Center, Loader } from '@mantine/core'
import type { ReactNode } from 'react'
import type { PermissionKey } from '../../../shared/auth/permissionKeys'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AccessState } from '../../../shared/ui/access-state/AccessState'
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
  const { t } = useI18n()

  if (isLoading) {
    return (
      <Center mih={160}>
        <Loader aria-label="Завантаження прав доступу" size="sm" />
      </Center>
    )
  }

  if (!can(permissionKey)) {
    return (
      <AccessState
        description={t('Ця сторінка недоступна для вашого облікового запису.')}
        title={t('Доступ заборонено')}
      />
    )
  }

  return children
}
