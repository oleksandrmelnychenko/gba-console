import { MantineProvider } from '@mantine/core'
import { act, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../../features/auth/AuthProvider'
import { getServerSession } from '../../../features/auth/api/authApi'
import { getMyPermissions } from '../../../features/auth/api/permissionsApi'
import { NavigationProvider } from '../../../features/navigation/NavigationProvider'
import { getNavigation } from '../../../features/navigation/api/navigationApi'
import type { NavigationModule } from '../../../features/navigation/types'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { notifyAuthPermissionsChanged } from '../../../shared/auth/permissionEvents'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { SalesDashboardShell } from '../../../shared/ui/SalesDashboardShell'
import { NavigationRouteGuard } from './NavigationRouteGuard'

vi.mock('../../../features/auth/api/authApi', () => ({
  getCurrentUserProfile: vi.fn(async () => ({
    FirstName: 'QA',
    NetUid: 'user-1',
    UserRole: { Name: 'QA' },
  })),
  getServerSession: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('../../../features/auth/api/permissionsApi', () => ({
  getMyPermissions: vi.fn(),
}))

vi.mock('../../../features/navigation/api/navigationApi', () => ({
  getNavigation: vi.fn(),
}))

const salesNavigation: NavigationModule[] = [
  {
    Children: [
      {
        Id: 2,
        Module: 'Продажі',
        Route: '/sales/ukraine/all',
      },
    ],
    Id: 1,
    Module: 'Продажі',
  },
]

function renderSalesRoute() {
  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={['/sales/ukraine/all']}>
        <I18nProvider>
          <AuthProvider>
            <NavigationProvider>
              <NavigationRouteGuard>
                <SalesDashboardShell>
                  <div data-testid="sales-registry">Реєстр продажів</div>
                </SalesDashboardShell>
              </NavigationRouteGuard>
            </NavigationProvider>
          </AuthProvider>
        </I18nProvider>
      </MemoryRouter>
    </MantineProvider>,
  )
}

describe('sales route permission refresh', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(getServerSession).mockReset().mockResolvedValue({
      csrfToken: 'csrf-1',
      userNetUid: 'user-1',
    })
    vi.mocked(getMyPermissions).mockReset()
    vi.mocked(getNavigation).mockReset()
  })

  it('opens /sales/ukraine/all after the active role receives every sales action', async () => {
    vi.mocked(getMyPermissions)
      .mockResolvedValueOnce({ catalogVersion: '1', permissionKeys: [] })
      .mockResolvedValueOnce({
        catalogVersion: '2',
        permissionKeys: Object.values(PermissionKeys.SalesUkraine.Sale),
      })
    vi.mocked(getNavigation)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(salesNavigation)

    renderSalesRoute()

    await waitFor(() => expect(getNavigation).toHaveBeenCalledTimes(1))
    expect(screen.queryByTestId('sales-registry')).toBeNull()
    expect(screen.queryByText('Немає доступу')).toBeNull()
    expect(screen.queryByText('Доступ заборонено')).toBeNull()

    act(() => notifyAuthPermissionsChanged())

    await waitFor(() => expect(getMyPermissions).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(getNavigation).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('button', { name: 'Продажі' })).not.toBeNull()
    expect(screen.getByTestId('sales-registry')).not.toBeNull()
  })

  it('keeps the sales route denied when a focus refresh still lacks page view', async () => {
    vi.mocked(getMyPermissions).mockResolvedValue({
      catalogVersion: '1',
      permissionKeys: [PermissionKeys.SalesUkraine.Sale.Edit],
    })
    vi.mocked(getNavigation).mockResolvedValue([])

    renderSalesRoute()

    await waitFor(() => expect(getNavigation).toHaveBeenCalledTimes(1))
    expect(screen.queryByTestId('sales-registry')).toBeNull()
    expect(screen.queryByText('Немає доступу')).toBeNull()
    expect(screen.queryByText('Доступ заборонено')).toBeNull()

    act(() => window.dispatchEvent(new Event('focus')))

    await waitFor(() => expect(getMyPermissions).toHaveBeenCalledTimes(2))
    expect(screen.queryByTestId('sales-registry')).toBeNull()
    expect(screen.queryByText('Немає доступу')).toBeNull()
    expect(screen.queryByText('Доступ заборонено')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Продажі' })).toBeNull()
  })
})
