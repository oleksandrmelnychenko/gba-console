import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../shared/auth/permissionKeys'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'

const mocks = vi.hoisted(() => ({
  getCurrentUserProfile: vi.fn(),
  getMyPermissions: vi.fn(),
  getServerSession: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  notificationsShow: vi.fn(),
}))

vi.mock('@mantine/notifications', () => ({
  notifications: { show: mocks.notificationsShow },
}))

vi.mock('./api/authApi', () => ({
  getCurrentUserProfile: mocks.getCurrentUserProfile,
  getServerSession: mocks.getServerSession,
  signIn: mocks.signIn,
  signOut: mocks.signOut,
}))

vi.mock('./api/permissionsApi', () => ({
  getMyPermissions: mocks.getMyPermissions,
}))

function AuthStateProbe() {
  const { hasPermission, isPermissionsLoading } = useAuth()

  return (
    <>
      <span data-testid="permissions-loading">{String(isPermissionsLoading)}</span>
      <span data-testid="has-sales-view">{String(hasPermission(PermissionKeys.SalesUkraine.Sale.View))}</span>
    </>
  )
}

function AuthLifecycleProbe() {
  const { isAuthenticated, logout } = useAuth()
  const location = useLocation()

  return (
    <>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="location">{location.pathname}</span>
      <button type="button" onClick={() => void logout()}>logout</button>
    </>
  )
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })

  return { promise, resolve }
}

describe('AuthProvider permission refresh', () => {
  beforeEach(() => {
    localStorage.clear()
    mocks.getCurrentUserProfile.mockReset().mockResolvedValue(null)
    mocks.getMyPermissions.mockReset()
    mocks.getServerSession.mockReset().mockResolvedValue({ csrfToken: 'csrf-token' })
    mocks.signIn.mockReset()
    mocks.signOut.mockReset().mockResolvedValue(undefined)
    mocks.notificationsShow.mockReset()
  })

  it('keeps background permission refresh non-blocking after window regains focus', async () => {
    const refreshedPermissions = deferred<{ catalogVersion: null; permissionKeys: string[] }>()
    mocks.getMyPermissions.mockResolvedValue({
      catalogVersion: null,
      permissionKeys: [PermissionKeys.SalesUkraine.Sale.View],
    })

    render(
      <MemoryRouter>
        <AuthProvider>
          <AuthStateProbe />
        </AuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('permissions-loading').textContent).toBe('false')
      expect(screen.getByTestId('has-sales-view').textContent).toBe('true')
    })

    mocks.getMyPermissions.mockClear()
    mocks.getMyPermissions.mockImplementation(() => refreshedPermissions.promise)
    act(() => window.dispatchEvent(new Event('focus')))

    await waitFor(() => expect(mocks.getMyPermissions).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId('permissions-loading').textContent).toBe('false')
    expect(screen.getByTestId('has-sales-view').textContent).toBe('true')

    await act(async () => {
      refreshedPermissions.resolve({ catalogVersion: null, permissionKeys: [] })
      await refreshedPermissions.promise
    })

    await waitFor(() => expect(screen.getByTestId('has-sales-view').textContent).toBe('false'))
  })

  it('keeps the session when explicit logout is not confirmed by the server', async () => {
    mocks.getMyPermissions.mockResolvedValue({ catalogVersion: null, permissionKeys: [] })
    mocks.signOut.mockRejectedValueOnce(new Error('Сервер авторизації недоступний'))

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <AuthLifecycleProbe />
        </AuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByTestId('authenticated').textContent).toBe('true'))
    fireEvent.click(screen.getByRole('button', { name: 'logout' }))

    await waitFor(() => expect(mocks.notificationsShow).toHaveBeenCalledOnce())
    expect(screen.getByTestId('authenticated').textContent).toBe('true')
    expect(screen.getByTestId('location').textContent).toBe('/dashboard')
    expect(localStorage.getItem('gba_console_session')).not.toBeNull()
  })

  it('does not clear or redirect until explicit logout is confirmed', async () => {
    const pendingLogout = deferred<void>()
    mocks.getMyPermissions.mockResolvedValue({ catalogVersion: null, permissionKeys: [] })
    mocks.signOut.mockReturnValueOnce(pendingLogout.promise)

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <AuthLifecycleProbe />
        </AuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByTestId('authenticated').textContent).toBe('true'))
    fireEvent.click(screen.getByRole('button', { name: 'logout' }))
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledOnce())

    expect(screen.getByTestId('authenticated').textContent).toBe('true')
    expect(screen.getByTestId('location').textContent).toBe('/dashboard')

    await act(async () => {
      pendingLogout.resolve(undefined)
      await pendingLogout.promise
    })

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('false')
      expect(screen.getByTestId('location').textContent).toBe('/login')
    })
    expect(localStorage.getItem('gba_console_session')).toBeNull()
  })
it('follows a sign-out made in another tab', async () => {
    mocks.getMyPermissions.mockResolvedValue({ catalogVersion: null, permissionKeys: [] })

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <AuthLifecycleProbe />
        </AuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByTestId('authenticated').textContent).toBe('true'))

    act(() => {
      localStorage.removeItem('gba_console_session')
      window.dispatchEvent(new StorageEvent('storage', { key: 'gba_console_session', newValue: null }))
    })

    await waitFor(() => expect(screen.getByTestId('authenticated').textContent).toBe('false'))
  })
})

describe('return path after sign-out', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    mocks.getCurrentUserProfile.mockReset().mockResolvedValue(null)
    mocks.getMyPermissions.mockReset().mockResolvedValue({ catalogVersion: null, permissionKeys: [] })
    mocks.getServerSession.mockReset().mockResolvedValue({ csrfToken: 'csrf-token' })
    mocks.signOut.mockReset().mockResolvedValue(undefined)
  })

  function renderAt(path: string) {
    render(
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <AuthLifecycleProbe />
        </AuthProvider>
      </MemoryRouter>,
    )
  }

  it('remembers the page when the session is revoked', async () => {
    renderAt('/users')
    await waitFor(() => expect(screen.getByTestId('authenticated').textContent).toBe('true'))

    act(() => {
      window.dispatchEvent(new CustomEvent('gba-console-auth-unauthorized'))
    })

    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/login'))
    expect(sessionStorage.getItem('gba:auth:return-path')).toBe('/users')
  })

  it('does not leave a return path behind when a late 401 arrives during an explicit logout', async () => {
    const pendingLogout = deferred<void>()
    mocks.signOut.mockReturnValueOnce(pendingLogout.promise)
    renderAt('/users')
    await waitFor(() => expect(screen.getByTestId('authenticated').textContent).toBe('true'))

    fireEvent.click(screen.getByRole('button', { name: 'logout' }))
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledOnce())
    act(() => {
      window.dispatchEvent(new CustomEvent('gba-console-auth-unauthorized'))
    })
    expect(sessionStorage.getItem('gba:auth:return-path')).toBeNull()
    await act(async () => {
      pendingLogout.resolve(undefined)
      await pendingLogout.promise
    })

    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/login'))
    act(() => {
      window.dispatchEvent(new CustomEvent('gba-console-auth-unauthorized'))
    })
    expect(sessionStorage.getItem('gba:auth:return-path')).toBeNull()
  })
})
