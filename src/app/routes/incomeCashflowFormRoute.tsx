import type { ReactElement } from 'react'
import { PagePermissionBoundary } from '../../features/auth/components/PagePermissionBoundary'
import { PermissionKeys } from '../../shared/auth/permissionKeys'
import { lazyRoute } from './lazyRoute'

/**
 * Income cash-flow create forms need the «Прибуткові статті» page itself, in
 * addition to the create key their route or form already checks.
 */
export function incomeCashflowFormRoute(page: ReactElement) {
  return (
    <PagePermissionBoundary permissionKey={PermissionKeys.SystemPages.IncomeCashflows.View}>
      {lazyRoute(page)}
    </PagePermissionBoundary>
  )
}
