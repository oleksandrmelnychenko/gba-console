import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getRoleManagementRoles, updateUserRole } from '../api/usersApi'
import { UserRolesPage } from './UserRolesPage'

vi.mock('../../auth/components/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => children,
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}))

vi.mock('../api/usersApi', () => ({
  createUserRole: vi.fn(),
  deleteUserRole: vi.fn(),
  getRoleManagementRoles: vi.fn(),
  updateUserRole: vi.fn(),
}))

vi.mock('../components/EventPermissionsCatalog', async () => {
  const React = await import('react')
  return {
    EventPermissionsCatalog: React.forwardRef(() => (
      <div data-testid="event-permissions-catalog" />
    )),
  }
})

beforeEach(() => {
  vi.mocked(getRoleManagementRoles).mockReset()
  vi.mocked(getRoleManagementRoles).mockResolvedValue([])
})

describe('UserRolesPage canonical permission editor', () => {
  it('shows only event permissions and does not load the legacy page editor', async () => {
    render(
      <MemoryRouter>
        <MantineProvider>
          <I18nProvider>
            <UserRolesPage />
          </I18nProvider>
        </MantineProvider>
      </MemoryRouter>,
    )

    await waitFor(() => expect(getRoleManagementRoles).toHaveBeenCalledTimes(1))

    expect(screen.getByRole('tab', { name: 'Подієві права' })).not.toBeNull()
    expect(screen.queryByRole('tab', { name: 'Права сторінок' })).toBeNull()
    expect(screen.getByTestId('event-permissions-catalog')).not.toBeNull()
  })

  it('shows only the role name field while preserving hidden role data on edit', async () => {
    vi.mocked(getRoleManagementRoles).mockResolvedValue([
      {
        Dashboard: '/sales/ukraine/all',
        Id: 1,
        Name: 'GBA',
        NetUid: 'role-gba',
        UserRoleType: 2,
      },
    ])
    vi.mocked(updateUserRole).mockResolvedValue(null)

    render(
      <MemoryRouter>
        <MantineProvider>
          <I18nProvider>
            <UserRolesPage />
          </I18nProvider>
        </MantineProvider>
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Редагувати' }))

    const nameInput = screen.getByRole('textbox', { name: 'Найменування' })
    expect(nameInput).not.toBeNull()
    expect(screen.queryByText('Dashboard')).toBeNull()
    expect(screen.queryByText('Тип')).toBeNull()

    fireEvent.change(nameInput, { target: { value: 'GBA updated' } })
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Зберегти' }))

    await waitFor(() => {
      expect(updateUserRole).toHaveBeenCalledWith({
        Dashboard: '/sales/ukraine/all',
        Id: 1,
        Name: 'GBA updated',
        NetUid: 'role-gba',
        UserRoleType: 2,
      })
    })
  })
})
