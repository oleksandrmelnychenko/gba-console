import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/apiClient'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createUser, getUser, getUserRolesForCreate, getUserRolesForEdit, updateUser } from '../api/usersApi'
import type { UserProfile, UserRole } from '../types'
import { UserEditPage } from './UserEditPage'
import { UserNewPage } from './UserNewPage'

const navigateSpy = vi.hoisted(() => ({ block: false, calls: 0 }))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => {
      const navigate = actual.useNavigate()
      return (...args: Parameters<typeof navigate>) => {
        navigateSpy.calls += 1
        if (!navigateSpy.block) {
          void navigate(...args)
        }
      }
    },
  }
})

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

// A seeded driver: 12-digit 380 login and no patronymic.
const seededDriver: UserProfile = {
  Email: 'driver@example.com',
  FirstName: 'Іван',
  LastName: 'Водій',
  MiddleName: '',
  NetUid: 'driver-net-id',
  PhoneNumber: '380000000121',
  UserRole: role,
}

vi.mock('../components/UserForm', () => ({
  UserForm: ({
    roles,
    onFieldChange,
    onPasswordChange,
  }: {
    roles: UserRole[]
    onFieldChange: <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => void
    onPasswordChange?: (field: 'password' | 'confirmPassword', value: string) => void
  }) => (
    <button
      type="button"
      onClick={() => {
        onFieldChange('LastName', 'Користувач')
        onFieldChange('FirstName', 'Тест')
        onFieldChange('MiddleName', 'Тестович')
        onFieldChange('Email', 'test-user@example.com')
        onFieldChange('PhoneNumber', '0966666666')
        onFieldChange('UserRole', roles[0])
        onPasswordChange?.('password', 'Test1!')
        onPasswordChange?.('confirmPassword', 'Test1!')
      }}
    >
      Заповнити
    </button>
  ),
}))

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

beforeEach(() => {
  navigateSpy.block = false
  navigateSpy.calls = 0
  vi.mocked(createUser).mockReset()
  vi.mocked(getUser).mockReset()
  vi.mocked(updateUser).mockReset()
  vi.mocked(getUserRolesForCreate).mockResolvedValue([role])
  vi.mocked(getUserRolesForEdit).mockResolvedValue([role])
})

describe('new user', () => {
  it('a click after a successful create (before the sheet unmounts) sends no second POST', async () => {
    navigateSpy.block = true
    vi.mocked(createUser).mockResolvedValue({ Succeeded: true })
    renderAt('/users/new')
    await waitFor(() => expect(getUserRolesForCreate).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'Заповнити' }))

    fireEvent.click(screen.getByRole('button', { name: 'Створити' }))
    await waitFor(() => expect(navigateSpy.calls).toBe(1))
    fireEvent.click(screen.getByRole('button', { name: 'Створити' }))
    fireEvent.click(screen.getByRole('button', { name: 'Створити' }))

    expect(createUser).toHaveBeenCalledTimes(1)
  })

  it("shows the server's duplicate-field message", async () => {
    const message = 'Користувач з таким email уже існує.'
    vi.mocked(createUser).mockRejectedValue(new ApiError(message, 400, { Message: message }))
    renderAt('/users/new')
    await waitFor(() => expect(getUserRolesForCreate).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'Заповнити' }))
    fireEvent.click(screen.getByRole('button', { name: 'Створити' }))

    expect(await screen.findByText(message)).not.toBeNull()
    // Failed create releases the lock so the user can fix the field and retry.
    expect(screen.getByRole('button', { name: 'Створити' }).hasAttribute('data-loading')).toBe(false)
  })

  it('keeps Скасувати enabled while creating and aborts the request', async () => {
    let signal: AbortSignal | undefined
    vi.mocked(createUser).mockImplementation((_user, _password, nextSignal) => {
      signal = nextSignal
      return new Promise(() => {})
    })
    renderAt('/users/new')
    await waitFor(() => expect(getUserRolesForCreate).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'Заповнити' }))
    fireEvent.click(screen.getByRole('button', { name: 'Створити' }))
    await waitFor(() => expect(createUser).toHaveBeenCalledTimes(1))

    const cancel = screen.getByRole('button', { name: 'Скасувати' })
    expect(cancel.hasAttribute('disabled')).toBe(false)
    fireEvent.click(cancel)

    expect(signal?.aborted).toBe(true)
    expect(await screen.findByText('Реєстр користувачів')).not.toBeNull()
  })
})

describe('edit user', () => {
  it('saves a seeded user with a 380 login and no patronymic, sending the phone unchanged', async () => {
    vi.mocked(getUser).mockResolvedValue(seededDriver)
    vi.mocked(updateUser).mockImplementation(async (user) => user)
    renderAt('/users/edit/driver-net-id')

    fireEvent.click(await screen.findByRole('button', { name: 'Зберегти' }))

    await waitFor(() => expect(updateUser).toHaveBeenCalledTimes(1))
    expect(vi.mocked(updateUser).mock.calls[0][0].PhoneNumber).toBe('380000000121')
    expect(screen.queryByText(/Телефон має містити/)).toBeNull()
  })

  it('the password tab has a single primary action (no footer Зберегти bound to the hidden profile form)', async () => {
    vi.mocked(getUser).mockResolvedValue(seededDriver)
    renderAt('/users/edit/driver-net-id')

    await screen.findByRole('button', { name: 'Зберегти' })
    fireEvent.click(screen.getByRole('button', { name: 'Зміна пароля' }))

    expect(screen.queryByRole('button', { name: 'Зберегти' })).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Дозволити зміну пароля?' }))
    expect(screen.getByRole('button', { name: 'Змінити пароль' })).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Загальна інформація' }))
    expect(screen.getByRole('button', { name: 'Зберегти' })).not.toBeNull()
  })

  it('an unknown user shows only the Ukrainian not-found message', async () => {
    vi.mocked(getUser).mockRejectedValue(new ApiError('User not found', 400, { Message: 'User not found' }))
    renderAt('/users/edit/00000000-0000-0000-0000-000000000000')

    expect(await screen.findByText('Користувача не знайдено')).not.toBeNull()
    expect(screen.queryByText('User not found')).toBeNull()
  })

  it('a non-404 load failure still shows its message', async () => {
    vi.mocked(getUser).mockRejectedValue(new ApiError('Сервер недоступний. Спробуйте ще раз пізніше.', 0, null))
    renderAt('/users/edit/driver-net-id')

    expect(await screen.findByText('Сервер недоступний. Спробуйте ще раз пізніше.')).not.toBeNull()
    await act(async () => {})
  })
})
