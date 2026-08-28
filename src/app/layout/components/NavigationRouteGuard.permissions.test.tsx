import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PagePermissionBoundary } from '../../../features/auth/components/PagePermissionBoundary'
import { NavigationContext } from '../../../features/navigation/NavigationContext'
import type { NavigationModule } from '../../../features/navigation/types'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { NavigationRouteGuard } from './NavigationRouteGuard'

let rolesPagePermissionGranted = false

vi.mock('../../../features/auth/usePermissions', () => ({
  usePermissions: () => ({
    can: () => rolesPagePermissionGranted,
    isLoading: false,
  }),
}))

const usersOnlyNavigation: NavigationModule[] = [
  {
    Id: 1,
    Module: 'Адміністрування',
    Children: [
      {
        Id: 11,
        Module: 'Всі користувачі',
        Route: '/users',
      },
    ],
  },
]

const rolesNavigation: NavigationModule[] = [
  {
    Id: 1,
    Module: 'Адміністрування',
    Children: [
      {
        Id: 12,
        Module: 'Ролі',
        Route: '/users/roles',
      },
    ],
  },
]

const RolesPage = vi.fn(() => <div>Керування ролями</div>)

function renderRolesRoute(modules: NavigationModule[]) {
  return render(
    <MemoryRouter initialEntries={['/users/roles']}>
      <MantineProvider>
        <I18nProvider>
          <NavigationContext.Provider
            value={{
              error: null,
              getNodePath: (node) => node.Route,
              isLoading: false,
              isNodeActive: () => false,
              modules,
              selectedModule: null,
              selectedNode: null,
              selectModule: () => undefined,
            }}
          >
            <NavigationRouteGuard>
              <PagePermissionBoundary
                permissionKey={PermissionKeys.SystemPages.Roles.View}
              >
                <RolesPage />
              </PagePermissionBoundary>
            </NavigationRouteGuard>
          </NavigationContext.Provider>
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

describe('NavigationRouteGuard page permissions', () => {
  beforeEach(() => {
    rolesPagePermissionGranted = false
    RolesPage.mockClear()
  })

  it('renders no page or access-denied message when /users/roles permission is absent', () => {
    renderRolesRoute(usersOnlyNavigation)

    expect(RolesPage).not.toHaveBeenCalled()
    expect(screen.queryByText('Керування ролями')).toBeNull()
    expect(screen.queryByText('Доступ заборонено')).toBeNull()
    expect(screen.queryByText('Немає доступу')).toBeNull()
  })

  it('renders no page or access-denied message when the route is absent from navigation', () => {
    renderRolesRoute([])

    expect(RolesPage).not.toHaveBeenCalled()
    expect(screen.queryByText('Керування ролями')).toBeNull()
    expect(screen.queryByText('Доступ заборонено')).toBeNull()
    expect(screen.queryByText('Немає доступу')).toBeNull()
  })

  it('renders /users/roles when both navigation and page permission allow it', () => {
    rolesPagePermissionGranted = true

    renderRolesRoute(rolesNavigation)

    expect(screen.getByText('Керування ролями')).not.toBeNull()
    expect(RolesPage).toHaveBeenCalledOnce()
  })
})
