import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { refreshAuthSession } from '../../../shared/api/apiClient'
import { readSession, saveSession } from '../../../shared/auth/session'
import { signOut } from './authApi'

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

describe('explicit logout', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    saveSession({
      csrfToken: 'csrf-1',
      userNetUid: 'user-1',
      accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    })
  })

  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('preserves the local session when server revocation fails', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(503, { Message: 'retry' }))

    await expect(signOut()).rejects.toMatchObject({ status: 503 })

    expect(readSession()?.csrfToken).toBe('csrf-1')
    const [, init] = fetchMock.mock.calls[0]
    expect(new Headers(init?.headers).get('X-CSRF-Token')).toBe('csrf-1')
  })

  it('waits for an in-flight refresh, revokes the rotated session, then clears local state', async () => {
    let resolveRefresh!: (response: Response) => void
    const pendingRefresh = new Promise<Response>((resolve) => {
      resolveRefresh = resolve
    })
    fetchMock
      .mockImplementationOnce(() => pendingRefresh)
      .mockResolvedValueOnce(jsonResponse(200, { Body: null }))

    const refresh = refreshAuthSession(readSession()?.accessTokenExpiresAt)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const logout = signOut()
    await Promise.resolve()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    resolveRefresh(jsonResponse(200, {
      Body: { UserNetUid: 'user-1', CsrfToken: 'csrf-1', AccessTokenExpiresIn: 3600 },
    }))
    await refresh

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(String(fetchMock.mock.calls[1][0])).toContain('/usermanagement/token/logout')
    await logout

    expect(readSession()).toBeNull()
  })

  it('does not refresh when the browser cannot serialize auth work across tabs', async () => {
    vi.stubGlobal('navigator', { locks: undefined })

    await expect(
      refreshAuthSession(readSession()?.accessTokenExpiresAt),
    ).resolves.toBeNull()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(readSession()).toBeNull()
  })
})
