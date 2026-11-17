import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTH_UNAUTHORIZED_EVENT } from '../auth/session'
import { isDefinitiveRefreshFailure, refreshAuthSession } from './apiClient'

const STORAGE_KEY = 'gba_console_session'

describe('session refresh failures', () => {
  const fetchMock = vi.fn()
  let unauthorizedEvents = 0
  const onUnauthorized = () => {
    unauthorizedEvents += 1
  }

  beforeEach(() => {
    fetchMock.mockReset()
    unauthorizedEvents = 0
    vi.stubGlobal('fetch', fetchMock)
    // jsdom has no Web Locks; the refresh path requires them.
    vi.stubGlobal('navigator', { ...navigator, locks: { request: (_name: string, work: () => Promise<unknown>) => work() } })
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ csrfToken: 'csrf', userNetUid: 'user-1' }))
  })

  afterEach(() => {
    window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized)
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('signs out when the server rejects the refresh token ("Refresh token invalid")', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ Message: 'Refresh token invalid', StatusCode: 400 }), { status: 400 }))

    await expect(refreshAuthSession()).resolves.toBeNull()

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(unauthorizedEvents).toBe(1)
  })

  it('keeps the session when the refresh endpoint is temporarily unavailable', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 502 }))

    await expect(refreshAuthSession()).rejects.toMatchObject({ status: 502 })

    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
    expect(unauthorizedEvents).toBe(0)
  })

  it('treats only 400/401/403 as definitive', () => {
    expect([400, 401, 403].every(isDefinitiveRefreshFailure)).toBe(true)
    expect([0, 429, 500, 502, 503].some(isDefinitiveRefreshFailure)).toBe(false)
  })
})
