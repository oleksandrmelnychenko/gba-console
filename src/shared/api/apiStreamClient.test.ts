import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequestStream, assertApiStreamCurrent } from './apiStreamClient'
import { AUTH_UNAUTHORIZED_EVENT, readSession, saveSession } from '../auth/session'

const session = { userNetUid: '11111111-1111-1111-1111-111111111111', csrfToken: 'test-csrf-original' }
const response = (status: number, value: unknown = {}) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
const context = (signal = new AbortController().signal) => ({ session: { ...session }, signal })

describe('opt-in session-bound raw API response', () => {
  const fetchMock = vi.fn(), unauthorized = vi.fn()
  beforeEach(() => { fetchMock.mockReset(); unauthorized.mockReset(); vi.stubGlobal('fetch', fetchMock); saveSession(session); window.addEventListener(AUTH_UNAUTHORIZED_EVENT, unauthorized) })
  afterEach(() => { window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, unauthorized); localStorage.clear(); vi.unstubAllGlobals() })
  it('sends immutable raw bytes with cookies/CSRF/no-store and leaves the body untouched', async () => {
    const returned = response(200), text = vi.spyOn(returned, 'text'), json = vi.spyOn(returned, 'json'), arrayBuffer = vi.spyOn(returned, 'arrayBuffer')
    fetchMock.mockResolvedValue(returned)
    const controller = new AbortController(), options = { ...context(controller.signal), method: 'POST' as const, body: '{"exact":"9007199254740993"}' }
    const result = await apiRequestStream('/report/generalized/publications/x/statement', options)
    expect(result).toBe(returned); expect(text).not.toHaveBeenCalled(); expect(json).not.toHaveBeenCalled(); expect(arrayBuffer).not.toHaveBeenCalled()
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init).toMatchObject({ credentials: 'include', cache: 'no-store', redirect: 'error', method: 'POST', body: options.body, signal: controller.signal })
    expect(new Headers(init.headers).get('X-CSRF-Token')).toBe(session.csrfToken)
    expect(() => assertApiStreamCurrent(result, controller.signal)).not.toThrow()
  })
  it('rejects missing owner before any request and never joins a GET result across callers', async () => {
    await expect(apiRequestStream('/x', { ...context(), session: { userNetUid: '', csrfToken: 'only-cookie-context' } })).rejects.toMatchObject({ status: 401 })
    expect(fetchMock).not.toHaveBeenCalled()
    fetchMock.mockImplementation(() => Promise.resolve(response(200)))
    await Promise.all([apiRequestStream('/x', context()), apiRequestStream('/x', context())])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it.each([403, 404, 413, 503])('cancels unread %s body and preserves session', async status => {
    const cancel = vi.fn(), read = vi.fn()
    fetchMock.mockResolvedValue(new Response(new ReadableStream({ pull: read, cancel }, { highWaterMark: 0 }), { status }))
    await expect(apiRequestStream('/x', context())).rejects.toMatchObject({ status, payload: null })
    expect(cancel).toHaveBeenCalledOnce(); expect(read).not.toHaveBeenCalled(); expect(readSession()).toEqual(session); expect(unauthorized).not.toHaveBeenCalled()
  })
  it('refreshes once and retries original body with the new CSRF token', async () => {
    const first = deferred<Response>()
    fetchMock.mockReturnValueOnce(first.promise).mockResolvedValueOnce(response(200, { Body: { UserNetUid: session.userNetUid, CsrfToken: 'test-csrf-refreshed' } })).mockResolvedValueOnce(response(200))
    const options = { ...context(), method: 'POST' as const, body: '{"frozen":"A"}' }
    const pending = apiRequestStream('/x', options)
    options.body = '{"mutated":"B"}'; options.session.csrfToken = 'caller-mutated'
    first.resolve(response(401))
    const result = await pending
    expect(fetchMock.mock.calls[2][1]).toMatchObject({ body: '{"frozen":"A"}' })
    expect(new Headers(fetchMock.mock.calls[2][1].headers).get('X-CSRF-Token')).toBe('test-csrf-refreshed')
    expect(readSession()?.csrfToken).toBe('test-csrf-refreshed'); expect(() => assertApiStreamCurrent(result, options.signal)).not.toThrow()
  })
  it.each(['different-user', 'same-user-fresh-login'])('late refresh cannot save or clear a %s generation', async kind => {
    const refresh = deferred<Response>()
    fetchMock.mockResolvedValueOnce(response(401)).mockReturnValueOnce(refresh.promise)
    const pending = apiRequestStream('/x', context())
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const newer = { userNetUid: kind === 'different-user' ? '22222222-2222-2222-2222-222222222222' : session.userNetUid, csrfToken: 'test-fresh-login' }
    saveSession(newer)
    refresh.resolve(response(200, { UserNetUid: session.userNetUid, CsrfToken: 'test-old-response' }))
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(readSession()).toEqual(newer); expect(unauthorized).not.toHaveBeenCalled(); expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it('checks generation again after response headers and before bounded body consumers return', async () => {
    fetchMock.mockResolvedValue(response(200))
    const signal = new AbortController().signal, result = await apiRequestStream('/x', context(signal))
    saveSession({ ...session, csrfToken: 'test-new-login' })
    expect(() => assertApiStreamCurrent(result, signal)).toThrow(/Authentication changed/)
  })
  it('failed refresh clears only its own current generation', async () => {
    fetchMock.mockResolvedValueOnce(response(401)).mockResolvedValueOnce(response(401))
    await expect(apiRequestStream('/x', context())).rejects.toMatchObject({ status: 401 })
    expect(readSession()).toBeNull(); expect(unauthorized).toHaveBeenCalledOnce()
  })
  it('does not write storage when cancellation lands after the final refresh body is decoded but before its awaiting continuation', async () => {
    const controller = new AbortController(), payload = JSON.stringify({ UserNetUid: session.userNetUid, CsrfToken: 'test-final-body-token' })
    const stream = new ReadableStream<Uint8Array>({ start(body) { body.enqueue(new TextEncoder().encode(payload)); body.close() } })
    fetchMock.mockResolvedValueOnce(response(401)).mockResolvedValueOnce(new Response(stream, { headers: { 'Content-Type': 'application/json' } }))
    const originalDecode = TextDecoder.prototype.decode
    const decode = vi.spyOn(TextDecoder.prototype, 'decode').mockImplementation(function (this: TextDecoder, input, options) {
      const text = originalDecode.call(this, input, options)
      if (text === payload) queueMicrotask(() => controller.abort())
      return text
    })
    try {
      await expect(apiRequestStream('/x', context(controller.signal))).rejects.toMatchObject({ name: 'AbortError' })
      expect(controller.signal.aborted).toBe(true); expect(readSession()).toEqual(session); expect(unauthorized).not.toHaveBeenCalled()
      expect(fetchMock).toHaveBeenCalledTimes(2)
    } finally { decode.mockRestore() }
  })
  it('aborted old refresh cleanup cannot remove the replacement promise for the same generation', async () => {
    const old = deferred<Response>(), current = deferred<Response>()
    let refreshCount = 0, initialCount = 0
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/usermanagement/token/refresh')) return ++refreshCount === 1 ? old.promise : current.promise
      return Promise.resolve(response(++initialCount <= 3 ? 401 : 200))
    })
    const oldController = new AbortController(), oldPending = apiRequestStream('/x', context(oldController.signal))
    // Attach rejection handling before intentionally aborting a pending caller.
    const oldFailure = expect(oldPending).rejects.toMatchObject({ name: 'AbortError' })
    await vi.waitFor(() => expect(refreshCount).toBe(1)); oldController.abort()
    const nextPending = apiRequestStream('/x', context())
    await vi.waitFor(() => expect(refreshCount).toBe(2))
    old.resolve(response(200, { CsrfToken: 'ignored-old' })); await oldFailure
    const joined = apiRequestStream('/x', context())
    await vi.waitFor(() => expect(initialCount).toBe(3)); expect(refreshCount).toBe(2)
    current.resolve(response(200, { UserNetUid: session.userNetUid, CsrfToken: 'test-current-refresh' }))
    await Promise.all([nextPending, joined]); expect(refreshCount).toBe(2); expect(readSession()?.csrfToken).toBe('test-current-refresh')
  })
})
