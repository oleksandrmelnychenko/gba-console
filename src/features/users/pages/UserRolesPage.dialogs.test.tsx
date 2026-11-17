import { MantineProvider } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/apiClient'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createUserRole, deleteUserRole, getRoleManagementRoles } from '../api/usersApi'
import { UserRolesPage } from './UserRolesPage'

const resetFilters = vi.hoisted(() => vi.fn())

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
    EventPermissionsCatalog: React.forwardRef((_props: unknown, ref) => {
      React.useImperativeHandle(ref, () => ({
        cancel: vi.fn(),
        hasUnsavedChanges: () => false,
        isSaving: () => false,
        reload: vi.fn(),
        resetFilters,
        save: vi.fn(),
      }))
      return <div data-testid="event-permissions-catalog" />
    }),
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

async function openCreateDialog() {
  fireEvent.click(await screen.findByRole('button', { name: 'Створити' }))
  return screen.getByRole('dialog')
}

beforeEach(() => {
  vi.mocked(getRoleManagementRoles).mockReset()
  vi.mocked(getRoleManagementRoles).mockResolvedValue(ROLES)
  vi.mocked(createUserRole).mockReset()
  vi.mocked(deleteUserRole).mockReset()
  vi.mocked(notifications.show).mockReset()
  resetFilters.mockReset()
})

describe('UserRolesPage dialogs', () => {
  it('limits the role name to 40 characters (UserRole.Name is nvarchar(40))', async () => {
    renderPage()
    const dialog = await openCreateDialog()
    const input = within(dialog).getByRole('textbox', { name: 'Найменування' })

    expect(input.getAttribute('maxlength')).toBe('40')

    fireEvent.change(input, { target: { value: 'Q'.repeat(41) } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }))

    expect(await within(dialog).findByText('Назва ролі має містити не більше 40 символів')).not.toBeNull()
    expect(createUserRole).not.toHaveBeenCalled()
  })

  it('keeps Скасувати enabled while saving; cancelling aborts the request and closes the dialog', async () => {
    let signal: AbortSignal | undefined
    vi.mocked(createUserRole).mockImplementation((_role, nextSignal) => {
      signal = nextSignal
      return new Promise(() => {})
    })
    renderPage()
    const dialog = await openCreateDialog()

    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Найменування' }), {
      target: { value: 'Нова роль QA' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }))
    await waitFor(() => expect(createUserRole).toHaveBeenCalledTimes(1))

    const cancel = within(dialog).getByRole('button', { name: 'Скасувати' })
    expect(cancel.hasAttribute('disabled')).toBe(false)
    fireEvent.click(cancel)

    expect(signal?.aborted).toBe(true)
    await waitFor(() => expect(screen.queryByText('Нова роль')).toBeNull())
  })

  it('ends a failed save with an error toast', async () => {
    vi.mocked(createUserRole).mockRejectedValue(new Error('Сервер не відповів'))
    renderPage()
    const dialog = await openCreateDialog()

    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Найменування' }), {
      target: { value: 'Нова роль QA' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }))

    await waitFor(() => expect(notifications.show).toHaveBeenCalledWith({ color: 'red', message: 'Сервер не відповів' }))
    expect(within(dialog).getByRole('button', { name: 'Зберегти' })).not.toBeNull()
  })

  it('shows the server reason when a role with users cannot be deleted (409)', async () => {
    const message = 'Роль не можна видалити: до неї призначено користувачів (1).'
    vi.mocked(deleteUserRole).mockRejectedValue(new ApiError(message, 409, { Message: message, StatusCode: 409 }))
    renderPage()
    const editButtons = await screen.findAllByRole('button', { name: 'Редагувати' })
    fireEvent.click(editButtons[1])
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Видалити' }))
    await waitFor(() => expect(screen.queryByText('Редагування ролі')).toBeNull())
    const confirm = screen.getByRole('dialog')

    fireEvent.click(within(confirm).getByRole('button', { name: 'Так' }))

    expect(await within(confirm).findByText(message)).not.toBeNull()
    expect(within(confirm).getByRole('button', { name: 'Ні' }).hasAttribute('disabled')).toBe(false)
  })

  it('Скинути also resets the permission tree filters (risk and selection)', async () => {
    renderPage()
    await screen.findAllByRole('button', { name: 'Редагувати' })

    fireEvent.change(screen.getByRole('textbox', { name: 'Пошук ролі' }), { target: { value: 'QA' } })
    fireEvent.click(screen.getByRole('button', { name: 'Скинути' }))

    expect(resetFilters).toHaveBeenCalledTimes(1)
    expect((screen.getByRole('textbox', { name: 'Пошук ролі' }) as HTMLInputElement).value).toBe('')
  })
})
