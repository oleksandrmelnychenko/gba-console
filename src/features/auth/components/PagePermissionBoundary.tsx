import { Alert, Center, Loader } from '@mantine/core'
import { TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import type { PermissionKey } from '../../../shared/auth/permissionKeys'
import { useI18n } from '../../../shared/i18n/useI18n'
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
      <Alert color="yellow" icon={<TriangleAlert size={20} />} title={t('Доступ заборонено')} variant="light">
        {t('Ця сторінка недоступна для вашого облікового запису.')}
      </Alert>
    )
  }

  return children
}
