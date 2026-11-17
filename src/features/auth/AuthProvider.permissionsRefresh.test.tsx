import { act, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { notifyAuthPermissionsChanged } from '../../shared/auth/permissionEvents'
import { PermissionKeys } from '../../shared/auth/permissionKeys'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'

const mocks = vi.hoisted(() => ({
  getCurrentUserProfile: vi.fn(),
  getMyPermissions: vi.fn(),
  getServerSession: vi.fn(),
}))

vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }))
vi.mock('./api/authApi', () => ({
  getCurrentUserProfile: mocks.getCurrentUserProfile,
  getServerSession: mocks.getServerSession,
  signIn: vi.fn(),
  signOut: vi.fn(),
}))
vi.mock('./api/permissionsApi', () => ({ getMyPermissions: mocks.getMyPermissions }))

function Probe() {
  const { hasPermission } = useAuth()
  return <span data-testid="has-sales-view">{String(hasPermission(PermissionKeys.SalesUkraine.Sale.View))}</span>
}

describe('open session follows a role change', () => {
  let intervalCallbacks: Array<{ callback: () => void; delay?: number }> = []

  beforeEach(() => {
    localStorage.clear()
    intervalCallbacks = []
    const realSetInterval = window.setInterval.bind(window)
    vi.spyOn(window, 'setInterval').mockImplementation(((callback: () => void, delay?: number) => {
      intervalCallbacks.push({ callback, delay })
      return realSetInterval(() => undefined, 1_000_000)
    }) as typeof window.setInterval)
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
    mocks.getCurrentUserProfile.mockReset().mockResolvedValue(null)
    mocks.getServerSession.mockReset().mockResolvedValue({ csrfToken: 'csrf-token' })
    mocks.getMyPermissions.mockReset().mockResolvedValue({ catalogVersion: null, permissionKeys: [PermissionKeys.SalesUkraine.Sale.View] })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function renderLoaded() {
    render(<MemoryRouter><AuthProvider><Probe /></AuthProvider></MemoryRouter>)
    await waitFor(() => expect(screen.getByTestId('has-sales-view').textContent).toBe('true'))
  }

  it('re-reads the keys every 30 seconds while the tab is visible', async () => {
    await renderLoaded()
    mocks.getMyPermissions.mockClear().mockResolvedValue({ catalogVersion: null, permissionKeys: [] })

    const tick = intervalCallbacks.find((entry) => entry.delay === 30_000)
    expect(tick).toBeTruthy()
    act(() => tick!.callback())

    await waitFor(() => expect(screen.getByTestId('has-sales-view').textContent).toBe('false'))
    expect(mocks.getMyPermissions).toHaveBeenCalledTimes(1)
  })

  it('a burst of 403 signals refreshes once', async () => {
    await renderLoaded()
    mocks.getMyPermissions.mockClear()

    act(() => {
      notifyAuthPermissionsChanged()
      notifyAuthPermissionsChanged()
      notifyAuthPermissionsChanged()
    })

    await waitFor(() => expect(mocks.getMyPermissions).toHaveBeenCalledTimes(1))
  })
})
