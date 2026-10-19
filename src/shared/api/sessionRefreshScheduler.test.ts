import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTH_UNAUTHORIZED_EVENT, readSession, saveSession } from '../auth/session'
import { apiRequest } from './apiClient'
import { nextRefreshDelay, startSessionRefreshScheduler } from './sessionRefreshScheduler'

const STORAGE_KEY = 'gba_console_session'
const MINUTE = 60_000

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

function refreshCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([url]) => String(url).includes('/usermanagement/token/refresh'))
}

describe('session refresh timing', () => {
  it('refreshes two minutes before a one-hour token expires', () => {
    const now = Date.parse('2026-10-19T10:00:00Z')

    expect(nextRefreshDelay(new Date(now + 60 * MINUTE).toISOString(), now)).toBe(58 * MINUTE)
  })

  it('keeps a proportional lead for short tokens and refreshes overdue tokens at once', () => {
    const now = Date.parse('2026-10-19T10:00:00Z')

    expect(nextRefreshDelay(new Date(now + 2 * MINUTE).toISOString(), now)).toBe(90_000)
    expect(nextRefreshDelay(new Date(now - MINUTE).toISOString(), now)).toBe(1_000)
    expect(nextRefreshDelay('not-a-date', now)).toBeNull()
  })
})

describe('session refresh scheduler', () => {
  const fetchMock = vi.fn()
  let unauthorizedEvents = 0
  const onUnauthorized = () => {
    unauthorizedEvents += 1
  }
  let stop: (() => void) | null = null

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    vi.setSystemTime(new Date('2026-10-19T10:00:00Z'))
    fetchMock.mockReset()
    unauthorizedEvents = 0
    vi.stubGlobal('fetch', fetchMock)
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized)
  })

  afterEach(() => {
    stop?.()
    stop = null
    window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized)
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('refreshes silently before the access token expires and keeps the session', async () => {
    saveSession({
      csrfToken: 'csrf-1',
      userNetUid: 'user-1',
      accessTokenExpiresAt: new Date(Date.now() + 60 * MINUTE).toISOString(),
      user: { NetUid: 'user-1' },
    })
    fetchMock.mockResolvedValue(jsonResponse(200, {
      Body: { UserNetUid: 'user-1', CsrfToken: 'csrf-1', AccessTokenExpiresIn: 3600 },
    }))
    stop = startSessionRefreshScheduler()

    await vi.advanceTimersByTimeAsync(57 * MINUTE)
    expect(refreshCalls(fetchMock)).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(MINUTE + 1_000)
    expect(refreshCalls(fetchMock)).toHaveLength(1)
    const [, init] = refreshCalls(fetchMock)[0]
    expect(new Headers(init?.headers).get('X-CSRF-Token')).toBe('csrf-1')
    expect(init?.method).toBe('POST')

    const session = readSession()
    expect(session?.user?.NetUid).toBe('user-1')
    const renewedExpiry = Date.parse(session!.accessTokenExpiresAt!)
    expect(renewedExpiry).toBeGreaterThan(Date.now() + 3590 * 1000)
    expect(renewedExpiry).toBeLessThanOrEqual(Date.now() + 3600 * 1000)
    expect(unauthorizedEvents).toBe(0)

    await vi.advanceTimersByTimeAsync(58 * MINUTE + 1_000)
    expect(refreshCalls(fetchMock)).toHaveLength(2)
  })

  it('does not refresh again when another tab already renewed the session', async () => {
    const original = new Date(Date.now() + 10 * MINUTE).toISOString()
    saveSession({ csrfToken: 'csrf-1', userNetUid: 'user-1', accessTokenExpiresAt: original })
    stop = startSessionRefreshScheduler()

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      csrfToken: 'csrf-1',
      userNetUid: 'user-1',
      accessTokenExpiresAt: new Date(Date.now() + 70 * MINUTE).toISOString(),
    }))

    await vi.advanceTimersByTimeAsync(9 * MINUTE)
    expect(refreshCalls(fetchMock)).toHaveLength(0)
  })

  it('retries after a network failure instead of signing the user out', async () => {
    saveSession({
      csrfToken: 'csrf-1',
      userNetUid: 'user-1',
      accessTokenExpiresAt: new Date(Date.now() + 2 * MINUTE).toISOString(),
    })
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonResponse(200, {
        Body: { UserNetUid: 'user-1', CsrfToken: 'csrf-1', AccessTokenExpiresIn: 120 },
      }))
    stop = startSessionRefreshScheduler()

    await vi.advanceTimersByTimeAsync(91_000)
    expect(refreshCalls(fetchMock)).toHaveLength(1)
    expect(readSession()?.csrfToken).toBe('csrf-1')
    expect(unauthorizedEvents).toBe(0)

    await vi.advanceTimersByTimeAsync(30_000)
    expect(refreshCalls(fetchMock)).toHaveLength(2)
    expect(unauthorizedEvents).toBe(0)
  })

  it('signs out when the server refuses the refresh token', async () => {
    saveSession({
      csrfToken: 'csrf-1',
      userNetUid: 'user-1',
      accessTokenExpiresAt: new Date(Date.now() + 2 * MINUTE).toISOString(),
    })
    fetchMock.mockResolvedValueOnce(jsonResponse(400, { Message: 'Refresh token invalid' }))
    stop = startSessionRefreshScheduler()

    await vi.advanceTimersByTimeAsync(91_000)

    expect(readSession()).toBeNull()
    expect(unauthorizedEvents).toBeGreaterThan(0)
  })
})

describe('apiRequest after the access token expired', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('refreshes once on 401, retries the request and records the new expiry', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ csrfToken: 'csrf-1', userNetUid: 'user-1' }))
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(200, {
        Body: { UserNetUid: 'user-1', CsrfToken: 'csrf-1', AccessTokenExpiresIn: 3600 },
      }))
      .mockResolvedValueOnce(jsonResponse(200, { Body: { ok: true } }))

    await expect(apiRequest<{ ok: boolean }>('/exchangerates/get/current')).resolves.toEqual({ ok: true })

    expect(refreshCalls(fetchMock)).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(readSession()?.accessTokenExpiresAt).toBeTruthy()
  })

  it('skips its own refresh when another tab refreshed while the request was in flight', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      csrfToken: 'csrf-1',
      userNetUid: 'user-1',
      accessTokenExpiresAt: new Date(Date.now() - 1_000).toISOString(),
    }))
    fetchMock
      .mockImplementationOnce(async () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          csrfToken: 'csrf-1',
          userNetUid: 'user-1',
          accessTokenExpiresAt: new Date(Date.now() + 60 * MINUTE).toISOString(),
        }))
        return jsonResponse(401, {})
      })
      .mockResolvedValueOnce(jsonResponse(200, { Body: { ok: true } }))

    await expect(apiRequest<{ ok: boolean }>('/organizations/all')).resolves.toEqual({ ok: true })

    expect(refreshCalls(fetchMock)).toHaveLength(0)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
