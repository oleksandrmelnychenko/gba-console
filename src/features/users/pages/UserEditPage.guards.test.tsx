import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getUser, getUserRolesForEdit, resetUserPassword } from '../api/usersApi'
import type { UserProfile, UserRole } from '../types'
import { UserEditPage } from './UserEditPage'

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
  deleteUser: vi.fn(),
  getUser: vi.fn(),
  getUserRolesForEdit: vi.fn(),
  resetUserPassword: vi.fn(),
  updateUser: vi.fn(),
}))

vi.mock('../components/UserForm', () => ({
  UserForm: ({ onFieldChange }: { onFieldChange: <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => void }) => (
    <button type="button" onClick={() => onFieldChange('FirstName', 'Змінене')}>
      Змінити ім'я
    </button>
  ),
}))

const role: UserRole = { Id: 12, Name: 'Водій', NetUid: 'driver-role' }
const user: UserProfile = {
  Email: 'driver@example.com',
  FirstName: 'Іван',
  LastName: 'Водій',
  MiddleName: '',
  NetUid: 'driver-net-id',
  PhoneNumber: '0990000601',
  UserRole: role,
}

function renderEdit() {
  return render(
    <MemoryRouter initialEntries={['/users/edit/driver-net-id']}>
      <MantineProvider>
        <I18nProvider>
          <Routes>
            <Route path="/users/edit/:netid" element={<UserEditPage />} />
            <Route path="/users" element={<div>Реєстр користувачів</div>} />
          </Routes>
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.mocked(getUser).mockResolvedValue(user)
  vi.mocked(getUserRolesForEdit).mockResolvedValue([role])
  vi.mocked(resetUserPassword).mockReset()
})

describe('user edit sheet guards', () => {
  it('Escape in the delete confirmation closes only the confirmation', async () => {
    renderEdit()
    fireEvent.click(await screen.findByRole('button', { name: 'Видалити' }))
    const confirm = await screen.findByRole('dialog', { name: 'Видалити користувача' })

    fireEvent.keyDown(within(confirm).getByRole('button', { name: 'Скасувати' }), { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Видалити користувача' })).toBeNull())
    expect(screen.queryByText('Реєстр користувачів')).toBeNull()
    expect(screen.getByRole('button', { name: 'Зберегти' })).not.toBeNull()
  })

  it('closes at once when nothing was changed', async () => {
    renderEdit()
    await screen.findByRole('button', { name: 'Зберегти' })

    fireEvent.click(screen.getAllByRole('button', { name: 'Скасувати' })[0])

    expect(await screen.findByText('Реєстр користувачів')).not.toBeNull()
  })

  it('asks before dropping a changed field, on Скасувати and on Escape', async () => {
    renderEdit()
    fireEvent.click(await screen.findByRole('button', { name: "Змінити ім'я" }))

    fireEvent.click(screen.getAllByRole('button', { name: 'Скасувати' })[0])
    expect(await screen.findByText('Є незбережені зміни')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Залишитися' }))
    await waitFor(() => expect(screen.queryByText('Є незбережені зміни')).toBeNull())
    expect(screen.queryByText('Реєстр користувачів')).toBeNull()

    fireEvent.keyDown(screen.getByRole('button', { name: "Змінити ім'я" }), { key: 'Escape' })
    fireEvent.click(await screen.findByRole('button', { name: 'Закрити без збереження' }))

    expect(await screen.findByText('Реєстр користувачів')).not.toBeNull()
  })

  it('attaches a password validation message to the field', async () => {
    renderEdit()
    await screen.findByRole('button', { name: 'Зберегти' })
    fireEvent.click(screen.getByRole('button', { name: 'Зміна пароля' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Дозволити зміну пароля?' }))
    fireEvent.change(screen.getByLabelText(/Новий пароль/), { target: { value: 'Test1!' } })
    fireEvent.change(screen.getByLabelText(/Підтвердження пароля/), { target: { value: 'Test2!' } })

    fireEvent.click(screen.getByRole('button', { name: 'Змінити пароль' }))

    const confirmInput = screen.getByLabelText(/Підтвердження пароля/)
    await waitFor(() => expect(confirmInput.getAttribute('aria-invalid')).toBe('true'))
    expect(screen.getByText('Паролі не збігаються')).not.toBeNull()
    expect(screen.getByLabelText(/Новий пароль/).getAttribute('aria-invalid')).not.toBe('true')
    expect(resetUserPassword).not.toHaveBeenCalled()

    fireEvent.change(confirmInput, { target: { value: 'Test1!' } })
    expect(confirmInput.getAttribute('aria-invalid')).not.toBe('true')
  })
})
