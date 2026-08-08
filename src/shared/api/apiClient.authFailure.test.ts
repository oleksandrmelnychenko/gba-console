import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTH_UNAUTHORIZED_EVENT } from '../auth/session'
import { apiRequest } from './apiClient'

const STORAGE_KEY = 'gba_console_session'

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

describe('apiRequest auth failure handling', () => {
  const fetchMock = vi.fn()
  let unauthorizedEvents = 0
  const onUnauthorized = () => {
    unauthorizedEvents += 1
  }

  beforeEach(() => {
    fetchMock.mockReset()
    unauthorizedEvents = 0
    vi.stubGlobal('fetch', fetchMock)
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ csrfToken: 'csrf', userNetUid: 'user-1' }))
  })

  afterEach(() => {
    window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized)
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('keeps the session and surfaces the server message on 403', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, { Message: 'Дана операція недоступна для Вашої ролі в системі' }),
    )

    await expect(apiRequest('/orders/items/shift/current', { method: 'POST', body: {} })).rejects.toMatchObject({
      message: 'Дана операція недоступна для Вашої ролі в системі',
      status: 403,
    })

    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
    expect(unauthorizedEvents).toBe(0)
  })

  it('localizes a known server validation message', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, {
        Message: 'Region identity is required and child codes must be updated separately.',
      }),
    )

    await expect(apiRequest('/regions/update', { method: 'PUT', body: {} })).rejects.toMatchObject({
      message: 'Необхідно вказати ідентифікатор регіону, а дочірні коди потрібно оновлювати окремо.',
      status: 400,
    })
  })

  it('clears the session on 401 after a failed refresh', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(401, {}))

    await expect(apiRequest('/sales/get/shifted', { query: { netId: 'x' } })).rejects.toMatchObject({
      status: 401,
    })

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(unauthorizedEvents).toBeGreaterThan(0)
  })
})
