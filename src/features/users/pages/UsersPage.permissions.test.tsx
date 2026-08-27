import { MantineProvider } from '@mantine/core'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getUsers } from '../api/usersApi'
import type { UserProfile } from '../types'
import { UsersPage } from './UsersPage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/components/PermissionGate', () => ({
  PermissionGate: ({
    children,
    fallback = null,
    permissionKey,
  }: {
    children: ReactNode
    fallback?: ReactNode
    permissionKey: string
  }) => allowedPermissions.has(permissionKey) ? children : fallback,
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (permission: string) => allowedPermissions.has(permission),
  }),
}))

vi.mock('../api/usersApi', () => ({
  getUsers: vi.fn(),
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({
    data,
    onRowClick,
  }: {
    data: UserProfile[]
    onRowClick?: (user: UserProfile) => void
  }) => (
    <button
      data-can-open={String(Boolean(onRowClick))}
      disabled={!onRowClick || data.length === 0}
      type="button"
      onClick={() => data[0] && onRowClick?.(data[0])}
    >
      Користувач у таблиці
    </button>
  ),
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/users']}>
      <MantineProvider>
        <I18nProvider>
          <UsersPage />
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  allowedPermissions.clear()
  vi.mocked(getUsers).mockReset()
  vi.mocked(getUsers).mockResolvedValue([
    { FirstName: 'Олена', LastName: 'Коваль', NetUid: 'user-net-id' },
  ])
})

describe('UsersPage permissions', () => {
  it('does not mount the registry without page access', () => {
    renderPage()

    expect(screen.getByText('Недостатньо прав для перегляду користувачів')).not.toBeNull()
    expect(getUsers).not.toHaveBeenCalled()
  })

  it('keeps page-only access read-only', async () => {
    allowedPermissions.add(PermissionKeys.SystemPages.Users.View)
    renderPage()

    await waitFor(() => expect(getUsers).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('button', { name: 'Новий користувач' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Ролі' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Користувач у таблиці' }).getAttribute('data-can-open')).toBe('false')
  })

  it('exposes create, roles and row-open controls only with their own rights', async () => {
    allowedPermissions.add(PermissionKeys.SystemPages.Users.View)
    allowedPermissions.add(PermissionKeys.SystemPages.Roles.View)
    allowedPermissions.add(PermissionKeys.Users.User.Create)
    allowedPermissions.add(PermissionKeys.Users.User.OpenDetails)
    renderPage()

    await waitFor(() => expect(getUsers).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: 'Новий користувач' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Ролі' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Користувач у таблиці' }).getAttribute('data-can-open')).toBe('true')
  })
})
