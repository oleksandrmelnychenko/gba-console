import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createUser, getUserRolesForCreate } from '../api/usersApi'
import type { UserProfile, UserRole } from '../types'
import { UserNewPage } from './UserNewPage'

const role: UserRole = {
  Id: 12,
  Name: 'Аналітик з закупок',
  NetUid: 'purchase-analyst-role',
}

vi.mock('../../auth/components/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => children,
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: (permission: string) => permission === PermissionKeys.Users.User.Create }),
}))

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}))

vi.mock('../api/usersApi', () => ({
  createUser: vi.fn(),
  getUserRolesForCreate: vi.fn(),
}))

vi.mock('../components/UserForm', () => ({
  UserForm: ({
    confirmPassword,
    password,
    roles,
    user,
    onFieldChange,
    onPasswordChange,
  }: {
    confirmPassword: string
    password: string
    roles: UserRole[]
    user: UserProfile
    onFieldChange: <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => void
    onPasswordChange: (field: 'password' | 'confirmPassword', value: string) => void
  }) => (
    <>
      <output aria-label="Поточний email">{user.Email || ''}</output>
      <output aria-label="Поточний пароль">{password}</output>
      <output aria-label="Поточне підтвердження">{confirmPassword}</output>
      <button
        type="button"
        onClick={() => {
          onFieldChange('LastName', 'Користувач')
          onFieldChange('FirstName', 'Тест')
          onFieldChange('MiddleName', 'Тестович')
          onFieldChange('Email', 'test-user@example.com')
          onFieldChange('PhoneNumber', '0966666666')
          onFieldChange('UserRole', roles[0])
          onPasswordChange('password', 'Test1!')
          onPasswordChange('confirmPassword', 'Test1!')
        }}
      >
        Заповнити валідні дані
      </button>
      <button
        type="button"
        onClick={() => {
          onFieldChange('LastName', 'Користувач')
          onFieldChange('FirstName', 'Тест')
          onFieldChange('MiddleName', 'Тестович')
          onFieldChange('Email', 'test-user@example.com')
          onFieldChange('PhoneNumber', '09666666666')
          onFieldChange('UserRole', roles[0])
          onPasswordChange('password', 'Test1!')
          onPasswordChange('confirmPassword', 'Test1!')
        }}
      >
        Заповнити невалідний телефон
      </button>
    </>
  ),
}))

function renderWorkflow() {
  return render(
    <MemoryRouter initialEntries={['/users/new']}>
      <MantineProvider>
        <I18nProvider>
          <Routes>
            <Route path="/users/new" element={<UserNewPage />} />
            <Route
              path="/users"
              element={(
                <>
                  <div>Реєстр користувачів</div>
                  <Link to="/users/new">Відкрити нову форму</Link>
                </>
              )}
            />
          </Routes>
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.mocked(createUser).mockReset()
  vi.mocked(getUserRolesForCreate).mockReset()
  vi.mocked(getUserRolesForCreate).mockResolvedValue([role])
})

describe('new user workflow', () => {
  it('keeps the drawer open and does not call create while validation fails', async () => {
    renderWorkflow()

    await waitFor(() => expect(getUserRolesForCreate).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Заповнити невалідний телефон' }))
    fireEvent.click(screen.getByRole('button', { name: 'Створити' }))

    expect(await screen.findByText('Телефон має містити 9 або 10 цифр')).not.toBeNull()
    expect(createUser).not.toHaveBeenCalled()
    expect(screen.queryByText('Реєстр користувачів')).toBeNull()
  })

  it('submits once, closes only after success, and reopens with fresh state', async () => {
    let resolveCreate!: (value: { Succeeded: boolean }) => void
    vi.mocked(createUser).mockImplementation(() => new Promise((resolve) => {
      resolveCreate = resolve
    }))
    renderWorkflow()

    await waitFor(() => expect(getUserRolesForCreate).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Заповнити валідні дані' }))

    const form = document.getElementById('user-new-form') as HTMLFormElement
    expect(form.getAttribute('autocomplete')).toBe('off')
    fireEvent.click(screen.getByRole('button', { name: 'Створити' }))
    fireEvent.click(screen.getByRole('button', { name: 'Створити' }))

    expect(createUser).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Реєстр користувачів')).toBeNull()

    resolveCreate({ Succeeded: true })
    expect(await screen.findByText('Реєстр користувачів')).not.toBeNull()

    fireEvent.click(screen.getByRole('link', { name: 'Відкрити нову форму' }))

    expect(await screen.findByText('Новий користувач')).not.toBeNull()
    expect(screen.getByLabelText('Поточний email').textContent).toBe('')
    expect(screen.getByLabelText('Поточний пароль').textContent).toBe('')
    expect(screen.getByLabelText('Поточне підтвердження').textContent).toBe('')
  })
})
