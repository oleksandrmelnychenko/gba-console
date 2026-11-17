import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createUserRole, deleteUserRole, getRoleManagementRoles, updateUserRole } from '../api/usersApi'
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
    EventPermissionsCatalog: React.forwardRef(({ role }: { role: { Name?: string } | null }) => (
      <div data-testid="event-permissions-catalog">{role?.Name ?? 'no-role'}</div>
    )),
  }
})

const ROLES = [
  { Dashboard: '/dashboard', Id: 1, Name: 'Завсклад', NetUid: 'role-warehouse', UserRoleType: 0 },
  { Dashboard: '/dashboard', Id: 39, Name: 'QA Тимчасова', NetUid: 'role-temp', UserRoleType: 13 },
]

function renderPage() {
  return render(
    <MemoryRouter>
      <MantineProvider>
        <I18nProvider>
          <UserRolesPage />
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

async function openEditDialog(index: number) {
  const editButtons = await screen.findAllByRole('button', { name: 'Редагувати' })
  fireEvent.click(editButtons[index])
  return screen.getByRole('dialog')
}

beforeEach(() => {
  vi.mocked(getRoleManagementRoles).mockReset()
  vi.mocked(getRoleManagementRoles).mockResolvedValue(ROLES)
  vi.mocked(updateUserRole).mockReset()
  vi.mocked(createUserRole).mockReset()
  vi.mocked(deleteUserRole).mockReset()
})

describe('UserRolesPage role form', () => {
  it('rejects renaming a role to the name of another role, ignoring case and spaces', async () => {
    renderPage()
    const dialog = await openEditDialog(1)

    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Найменування' }), {
      target: { value: '  завсклад ' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }))

    expect(await within(dialog).findByText('Роль з такою назвою вже існує')).not.toBeNull()
    expect(updateUserRole).not.toHaveBeenCalled()
  })

  it('allows saving a role under its own name', async () => {
    vi.mocked(updateUserRole).mockResolvedValue(null)
    renderPage()
    const dialog = await openEditDialog(1)

    fireEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }))

    await waitFor(() => expect(updateUserRole).toHaveBeenCalledTimes(1))
  })

  it('shows a server error inside the dialog instead of behind it', async () => {
    vi.mocked(createUserRole).mockRejectedValue(new Error('Сервер відхилив назву'))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Створити' }))
    const dialog = screen.getByRole('dialog')

    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Найменування' }), {
      target: { value: 'Нова роль QA' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }))

    expect(await within(dialog).findByText('Сервер відхилив назву')).not.toBeNull()
  })

  it('closes the edit dialog when asking to delete, so the confirmation is the only dialog', async () => {
    vi.mocked(deleteUserRole).mockResolvedValue(undefined)
    renderPage()
    const dialog = await openEditDialog(1)

    fireEvent.click(within(dialog).getByRole('button', { name: 'Видалити' }))

    await waitFor(() => expect(screen.queryByText('Редагування ролі')).toBeNull())
    const confirm = screen.getByRole('dialog')
    expect(within(confirm).getByText(/QA Тимчасова/)).not.toBeNull()

    fireEvent.click(within(confirm).getByRole('button', { name: 'Так' }))
    await waitFor(() => expect(deleteUserRole).toHaveBeenCalledWith('role-temp', expect.any(AbortSignal)))
  })

  it('selects a newly created role after it is saved', async () => {
    vi.mocked(createUserRole).mockResolvedValue(null)
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Створити' }))
    const dialog = screen.getByRole('dialog')

    vi.mocked(getRoleManagementRoles).mockResolvedValue([
      ...ROLES,
      { Dashboard: '/dashboard', Id: 40, Name: 'Нова роль QA', NetUid: 'role-new', UserRoleType: 13 },
    ])
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Найменування' }), {
      target: { value: 'Нова роль QA' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }))

    await waitFor(() =>
      expect(screen.getByTestId('event-permissions-catalog').textContent).toBe('Нова роль QA'),
    )
  })

  it('keeps the selected role in the list while searching for other roles', async () => {
    renderPage()
    await screen.findAllByRole('button', { name: 'Редагувати' })

    fireEvent.change(screen.getByRole('textbox', { name: 'Пошук ролі' }), {
      target: { value: 'QA' },
    })

    const list = screen.getByRole('navigation', { name: 'Ролі' })
    expect(within(list).getByText('Завсклад')).not.toBeNull()
    expect(within(list).getByText('QA Тимчасова')).not.toBeNull()
  })
})
