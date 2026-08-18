import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  createUser,
  deleteUser,
  getUser,
  getUserRoles,
  resetUserPassword,
  updateUser,
} from '../api/usersApi'
import type { UserProfile } from '../types'
import { UserEditPage } from './UserEditPage'
import { UserNewPage } from './UserNewPage'

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

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}))

vi.mock('../api/usersApi', () => ({
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  getUser: vi.fn(),
  getUserRoles: vi.fn(),
  resetUserPassword: vi.fn(),
  updateUser: vi.fn(),
}))

vi.mock('../components/UserForm', () => ({
  UserForm: ({ disabled }: { disabled?: boolean }) => (
    <input aria-label="Профіль користувача" disabled={disabled} />
  ),
}))

const user = {
  FirstName: 'Олена',
  LastName: 'Коваль',
  NetUid: 'user-net-id',
} as UserProfile

function renderRoute(path: string, element: ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MantineProvider>
        <I18nProvider>
          <Routes>
            <Route path={path.startsWith('/users/edit/') ? '/users/edit/:netid' : path} element={element} />
          </Routes>
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  allowedPermissions.clear()
  vi.mocked(createUser).mockReset()
  vi.mocked(deleteUser).mockReset()
  vi.mocked(getUser).mockReset()
  vi.mocked(getUserRoles).mockReset()
  vi.mocked(resetUserPassword).mockReset()
  vi.mocked(updateUser).mockReset()
  vi.mocked(getUser).mockResolvedValue(user)
  vi.mocked(getUserRoles).mockResolvedValue([])
})

describe('user page permissions', () => {
  it('does not mount create data without both page and create rights', async () => {
    renderRoute('/users/new', <UserNewPage />)

    expect(screen.getByText('Недостатньо прав для перегляду користувачів')).not.toBeNull()
    expect(getUserRoles).not.toHaveBeenCalled()

    allowedPermissions.add(PermissionKeys.SystemPages.Users.View)
    renderRoute('/users/new', <UserNewPage />)

    expect(screen.getByText('Недостатньо прав для створення користувача')).not.toBeNull()
    expect(getUserRoles).not.toHaveBeenCalled()
  })

  it('rechecks create permission on final submit after the drawer mounted', async () => {
    allowedPermissions.add(PermissionKeys.SystemPages.Users.View)
    allowedPermissions.add(PermissionKeys.Users.User.Create)
    renderRoute('/users/new', <UserNewPage />)

    await waitFor(() => expect(getUserRoles).toHaveBeenCalledTimes(1))
    allowedPermissions.delete(PermissionKeys.Users.User.Create)
    fireEvent.submit(document.getElementById('user-new-form')!)

    expect(await screen.findByText('Недостатньо прав для створення користувача')).not.toBeNull()
    expect(createUser).not.toHaveBeenCalled()
  })

  it('does not load an existing user without page and open-details rights', () => {
    allowedPermissions.add(PermissionKeys.SystemPages.Users.View)
    renderRoute('/users/edit/user-net-id', <UserEditPage />)

    expect(screen.getByText('Недостатньо прав для відкриття користувача')).not.toBeNull()
    expect(getUser).not.toHaveBeenCalled()
    expect(getUserRoles).not.toHaveBeenCalled()
  })

  it('keeps open-details read-only and exposes each mutation independently', async () => {
    allowedPermissions.add(PermissionKeys.SystemPages.Users.View)
    allowedPermissions.add(PermissionKeys.Users.User.OpenDetails)
    const view = renderRoute('/users/edit/user-net-id', <UserEditPage />)

    const profile = await screen.findByRole('textbox', { name: 'Профіль користувача' })
    expect((profile as HTMLInputElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Зберегти' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Видалити' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Зміна пароля' })).toBeNull()

    view.unmount()
    allowedPermissions.add(PermissionKeys.Users.User.Edit)
    allowedPermissions.add(PermissionKeys.Users.User.Delete)
    allowedPermissions.add(PermissionKeys.Users.User.ResetPassword)
    renderRoute('/users/edit/user-net-id', <UserEditPage />)

    expect((await screen.findByRole('textbox', { name: 'Профіль користувача' }) as HTMLInputElement).disabled).toBe(false)
    expect(screen.getByRole('button', { name: 'Зберегти' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Видалити' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Зміна пароля' })).not.toBeNull()
  })
})
