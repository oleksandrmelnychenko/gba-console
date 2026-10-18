import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { theme } from '../../shared/theme/theme'
import { LoginPage } from './LoginPage'

const auth = vi.hoisted(() => ({ isAuthenticated: false, isLoading: false, login: vi.fn() }))
vi.mock('../../features/auth/useAuth', () => ({ useAuth: () => auth }))
vi.mock('../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

beforeEach(() => {
  auth.isAuthenticated = false
  auth.isLoading = false
  auth.login.mockReset()
})

function renderLogin() {
  return render(<MemoryRouter initialEntries={['/login']}><MantineProvider theme={theme}>
    <Routes><Route path="/login" element={<LoginPage />} /><Route path="/dashboard" element={<div>Dashboard</div>} /></Routes>
  </MantineProvider></MemoryRouter>)
}

describe('login form', () => {
  it('validates empty credentials before contacting the server', () => {
    renderLogin()
    fireEvent.submit(screen.getByRole('form', { name: 'Вхід у систему' }))
    expect(screen.getByText('Вкажіть логін')).not.toBeNull()
    expect(screen.getByText('Вкажіть пароль')).not.toBeNull()
    expect(auth.login).not.toHaveBeenCalled()
  })

  it('preserves the password and displays a failed sign-in without clearing the username', async () => {
    auth.login.mockRejectedValue(new Error('Неправильний логін або пароль'))
    renderLogin()
    fireEvent.change(screen.getByLabelText('Логін'), { target: { value: '  qa-user  ' } })
    fireEvent.change(screen.getByLabelText('Пароль', { exact: true }), { target: { value: ' test password ' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Вхід у систему' }))
    expect(await screen.findByRole('alert')).not.toBeNull()
    expect(screen.getByText('Неправильний логін або пароль')).not.toBeNull()
    expect(auth.login).toHaveBeenCalledExactlyOnceWith('qa-user', ' test password ')
    expect((screen.getByLabelText('Логін') as HTMLInputElement).value).toBe('  qa-user  ')
  })

  it('offers an accessible password visibility toggle', async () => {
    const user = userEvent.setup()
    renderLogin()
    expect((screen.getByLabelText('Пароль', { exact: true }) as HTMLInputElement).type).toBe('password')
    await user.click(screen.getByRole('button', { name: 'Показати пароль' }))
    expect((screen.getByLabelText('Пароль', { exact: true }) as HTMLInputElement).type).toBe('text')
    await user.click(screen.getByRole('button', { name: 'Приховати пароль' }))
    expect((screen.getByLabelText('Пароль', { exact: true }) as HTMLInputElement).type).toBe('password')
  })

  it('redirects an authenticated user to the dashboard', () => {
    auth.isAuthenticated = true
    renderLogin()
    expect(screen.getByText('Dashboard')).not.toBeNull()
    expect(screen.queryByRole('form')).toBeNull()
  })
})
