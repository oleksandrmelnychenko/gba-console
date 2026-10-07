import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from './apiClient'
import { clearSession, saveSession } from '../auth/session'

function okResponse() {
  return new Response(JSON.stringify({ Body: { ok: true } }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  })
}

describe('apiRequest mutation dedupe (rapid-click guard)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    clearSession()
    vi.unstubAllGlobals()
  })

  it('shares one network request between identical concurrent POSTs', async () => {
    let releaseResponse: (response: Response) => void = () => undefined
    fetchMock.mockImplementation(
      () => new Promise<Response>((resolve) => {
        releaseResponse = resolve
      }),
    )

    const first = apiRequest('/bank/update', { method: 'POST', body: { Name: 'QA' } })
    const second = apiRequest('/bank/update', { method: 'POST', body: { Name: 'QA' } })

    releaseResponse(okResponse())

    await expect(first).resolves.toEqual({ ok: true })
    await expect(second).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not merge mutations with different bodies', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(okResponse()))

    await Promise.all([
      apiRequest('/bank/update', { method: 'POST', body: { Name: 'A' } }),
      apiRequest('/bank/update', { method: 'POST', body: { Name: 'B' } }),
    ])

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('sends a fresh request once the previous mutation settled', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(okResponse()))

    await apiRequest('/bank/update', { method: 'POST', body: { Name: 'QA' } })
    await apiRequest('/bank/update', { method: 'POST', body: { Name: 'QA' } })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('respects dedupe:false opt-out', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(okResponse()))

    await Promise.all([
      apiRequest('/bank/update', { method: 'POST', body: { Name: 'QA' }, dedupe: false }),
      apiRequest('/bank/update', { method: 'POST', body: { Name: 'QA' }, dedupe: false }),
    ])

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not merge mutating GET requests carrying idempotency keys', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(okResponse()))

    await Promise.all([
      apiRequest('/sales/shipments/document/create/export', {
        headers: { 'Idempotency-Key': '11111111-1111-4111-8111-111111111111' },
      }),
      apiRequest('/sales/shipments/document/create/export', {
        headers: { 'Idempotency-Key': '22222222-2222-4222-8222-222222222222' },
      }),
    ])

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('honors GET dedupe:false across a cancelled old caller and a new caller at the same URL', async () => {
    const releases: ((response: Response) => void)[] = []
    fetchMock.mockImplementation((_url: string, options: RequestInit) => new Promise<Response>((resolve, reject) => {
      releases.push(resolve)
      options.signal?.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true })
    }))
    const oldController = new AbortController(), newController = new AbortController()
    saveSession({ userNetUid: 'caller-a', csrfToken: 'csrf-a' })
    const previous = apiRequest('/report/templates', { cache: 'no-store', dedupe: false, signal: oldController.signal }).catch(error => error)
    oldController.abort(); saveSession({ userNetUid: 'caller-b', csrfToken: 'csrf-b' })
    const current = apiRequest('/report/templates', { cache: 'no-store', dedupe: false, signal: newController.signal })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    releases[1](new Response(JSON.stringify({ Body: { caller: 'caller-b' } }), { headers: { 'Content-Type': 'application/json' } }))
    await expect(current).resolves.toEqual({ caller: 'caller-b' })
    expect(await previous).toMatchObject({ name: 'AbortError' })
    expect(fetchMock.mock.calls[0][1].signal).toBe(oldController.signal)
    expect(fetchMock.mock.calls[1][1].signal).toBe(newController.signal)
  })

  it('keeps normal concurrent GET deduplication when no opt-out is requested', async () => {
    let release!: (response: Response) => void
    fetchMock.mockImplementation(() => new Promise<Response>(resolve => { release = resolve }))
    const first = apiRequest('/ordinary-reference'), second = apiRequest('/ordinary-reference')
    release(okResponse())
    await expect(first).resolves.toEqual({ ok: true }); await expect(second).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('does not join identical caller-scoped writes carrying separate cancellation signals after an account switch', async () => {
    const releases: ((response: Response) => void)[] = []
    fetchMock.mockImplementation((_url: string, options: RequestInit) => new Promise<Response>((resolve, reject) => {
      releases.push(resolve)
      options.signal?.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true })
    }))
    const oldController = new AbortController(), currentController = new AbortController(), body = { Name: 'Імпорт', Id: 'same-import-id', Revision: 0 }
    saveSession({ userNetUid: 'caller-a', csrfToken: 'csrf-a' })
    const previous = apiRequest('/report/templates/save', { method: 'POST', body, signal: oldController.signal }).catch(error => error)
    oldController.abort(); saveSession({ userNetUid: 'caller-b', csrfToken: 'csrf-b' })
    const current = apiRequest('/report/templates/save', { method: 'POST', body, signal: currentController.signal })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][1].body).toBe(fetchMock.mock.calls[1][1].body)
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get('X-CSRF-Token')).toBe('csrf-a')
    expect(new Headers(fetchMock.mock.calls[1][1].headers).get('X-CSRF-Token')).toBe('csrf-b')
    releases[1](okResponse()); await expect(current).resolves.toEqual({ ok: true })
    expect(await previous).toMatchObject({ name: 'AbortError' })
  })
})
