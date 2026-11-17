import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTH_PERMISSIONS_CHANGED_EVENT } from '../auth/permissionEvents'
import { apiRequest } from './apiClient'

const STORAGE_KEY = 'gba_console_session'

describe('apiRequest 403 asks the session to re-read its keys', () => {
  const fetchMock = vi.fn()
  let events = 0
  const onChanged = () => {
    events += 1
  }

  beforeEach(() => {
    fetchMock.mockReset()
    events = 0
    vi.stubGlobal('fetch', fetchMock)
    window.addEventListener(AUTH_PERMISSIONS_CHANGED_EVENT, onChanged)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ csrfToken: 'csrf', userNetUid: 'user-1' }))
  })

  afterEach(() => {
    window.removeEventListener(AUTH_PERMISSIONS_CHANGED_EVENT, onChanged)
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('signals a permissions change on a 403', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ Message: 'Недостатньо прав' }), { status: 403 }))

    await expect(apiRequest('/online-shop/cities/new', { method: 'POST', body: {} })).rejects.toMatchObject({ status: 403 })

    expect(events).toBe(1)
  })

  it('does not loop on a 403 of the permissions request itself', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 403 }))

    await expect(apiRequest('/permissions/me')).rejects.toMatchObject({ status: 403 })

    expect(events).toBe(0)
  })
})
