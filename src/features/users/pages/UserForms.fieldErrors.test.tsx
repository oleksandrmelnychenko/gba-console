import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/apiClient'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createUser, getUser, getUserRolesForCreate, getUserRolesForEdit, updateUser } from '../api/usersApi'
import type { UserProfile, UserRole } from '../types'
import { UserEditPage } from './UserEditPage'
import { UserNewPage } from './UserNewPage'

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
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  getUser: vi.fn(),
  getUserRolesForCreate: vi.fn(),
  getUserRolesForEdit: vi.fn(),
  resetUserPassword: vi.fn(),
  updateUser: vi.fn(),
}))

const role: UserRole = { Id: 12, Name: 'Водій', NetUid: 'driver-role' }
const existing: UserProfile = {
  Email: 'driver@example.com',
  FirstName: 'Іван',
  LastName: 'Водій',
  MiddleName: '',
  NetUid: 'driver-net-id',
  PhoneNumber: '380000000121',
  UserRole: role,
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MantineProvider>
        <I18nProvider>
          <Routes>
            <Route path="/users/new" element={<UserNewPage />} />
            <Route path="/users/edit/:netid" element={<UserEditPage />} />
            <Route path="/users" element={<div>Реєстр користувачів</div>} />
          </Routes>
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

function type(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

beforeEach(() => {
  vi.mocked(createUser).mockReset()
  vi.mocked(updateUser).mockReset()
  vi.mocked(getUserRolesForCreate).mockResolvedValue([role])
  vi.mocked(getUserRolesForEdit).mockResolvedValue([role])
  vi.mocked(getUser).mockResolvedValue(existing)
})

describe('user forms validate in the page, not with browser tooltips', () => {
  it('creates a user with an empty По батькові (optional, as on edit)', async () => {
    vi.mocked(createUser).mockResolvedValue({ Succeeded: true })
    renderAt('/users/new')
    await waitFor(() => expect(getUserRolesForCreate).toHaveBeenCalled())

    const middleName = screen.getByLabelText(/По батькові/) as HTMLInputElement
    expect(middleName.required).toBe(false)
    expect((middleName.closest('form') as HTMLFormElement).noValidate).toBe(true)

    type(/Прізвище/, 'Користувач')
    type(/Ім'я/, 'Тест')
    type(/Email/, 'qa-new@example.com')
    type(/Телефон/, '0966666666')
    type(/^Пароль/, 'Test1!')
    type(/Підтвердження пароля/, 'Test1!')
    // The role select: pick the only option.
    const roleInput = screen.getAllByLabelText(/Роль/).find((element) => element.tagName === 'INPUT') as HTMLInputElement
    await waitFor(() => expect(roleInput.disabled).toBe(false))
    fireEvent.click(roleInput)
    fireEvent.click(await screen.findByRole('option', { name: 'Водій', hidden: true }))

    fireEvent.click(screen.getByRole('button', { name: 'Створити' }))

    await waitFor(() => expect(createUser).toHaveBeenCalledTimes(1))
    expect(vi.mocked(createUser).mock.calls[0][0].MiddleName || '').toBe('')
  })

  it('shows the create error under the field it is about and sends nothing', async () => {
    renderAt('/users/new')
    await waitFor(() => expect(getUserRolesForCreate).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: 'Створити' }))

    const lastName = screen.getByLabelText(/Прізвище/)
    expect(await screen.findByText('Вкажіть прізвище')).not.toBeNull()
    expect(lastName.getAttribute('aria-invalid')).toBe('true')
    expect(createUser).not.toHaveBeenCalled()

    // Typing into the field clears its message.
    type(/Прізвище/, 'Користувач')
    expect(screen.queryByText('Вкажіть прізвище')).toBeNull()
  })

  it('sends the loaded version back, keeps the saved one for the next save, and shows a two-tab conflict', async () => {
    vi.mocked(getUser).mockResolvedValue({ ...existing, Updated: '2026-11-17T12:00:00.1233333' })
    vi.mocked(updateUser)
      .mockImplementationOnce(async (user) => ({ ...user, Updated: '2026-11-17T12:05:00.4566667' }))
      .mockRejectedValueOnce(new ApiError('Запис змінено в іншій вкладці — оновіть сторінку.', 409, {
        Message: 'Запис змінено в іншій вкладці — оновіть сторінку.',
        StatusCode: 409,
      }))
    renderAt('/users/edit/driver-net-id')
    await screen.findByRole('button', { name: 'Зберегти' })

    type(/Ім'я/, 'ТестA')
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
    await waitFor(() => expect(updateUser).toHaveBeenCalledTimes(1))
    expect(vi.mocked(updateUser).mock.calls[0][0].Updated).toBe('2026-11-17T12:00:00.1233333')

    type(/Ім'я/, 'ТестB')
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
    await waitFor(() => expect(updateUser).toHaveBeenCalledTimes(2))
    expect(vi.mocked(updateUser).mock.calls[1][0].Updated).toBe('2026-11-17T12:05:00.4566667')
    expect(await screen.findByText('Запис змінено в іншій вкладці — оновіть сторінку.')).not.toBeNull()
  })

  it('shows the edit error under the field (no top alert, no request)', async () => {
    renderAt('/users/edit/driver-net-id')
    await screen.findByRole('button', { name: 'Зберегти' })

    type(/Email/, 'not-an-email')
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    expect(await screen.findByText('Вкажіть коректний email')).not.toBeNull()
    expect(screen.getByLabelText(/Email/).getAttribute('aria-invalid')).toBe('true')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(updateUser).not.toHaveBeenCalled()
  })
})
