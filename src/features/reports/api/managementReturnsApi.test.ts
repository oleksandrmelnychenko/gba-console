import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { clearSession, readSession, saveSession } from '../../../shared/auth/session'
import { createManagementReturnsRequest } from '../data/managementReturns'
import { MANAGEMENT_RETURNS_TEST_CALLER, managementReturnsCapability, managementReturnsReport } from '../data/managementReturns.test-fixtures'
import { getManagementReturnsCapabilities, previewManagementReturns } from './managementReturnsApi'

const fetchMock = vi.fn(), session = { userNetUid: MANAGEMENT_RETURNS_TEST_CALLER, csrfToken: 'returns-csrf' }
const signal = () => new AbortController().signal
function response(body: unknown = managementReturnsReport(), overrides: Record<string, string> = {}) {
  return new Response(JSON.stringify({ Body: body }), { headers: { 'Content-Type': 'application/json',
    'Gba-Report-Request-Sha256': managementReturnsReport().RequestSha256, 'Gba-Report-Result-Sha256': managementReturnsReport().ResultSha256, ...overrides } })
}
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); saveSession(session) })
afterEach(() => { clearSession(); vi.unstubAllGlobals() })

it('reads genuine capability and exact immutable local-window preview with cookies/CSRF/hash-bound files', async () => {
  const capability = managementReturnsCapability(), report = managementReturnsReport(), controller = new AbortController()
  fetchMock.mockResolvedValueOnce(response(capability)).mockResolvedValueOnce(response(report))
  expect(await getManagementReturnsCapabilities(session.userNetUid, controller.signal)).toEqual(capability)
  expect(await previewManagementReturns(capability, report, session.userNetUid, controller.signal)).toEqual(report)
  expect(fetchMock).toHaveBeenCalledTimes(2)
  const [url, options] = fetchMock.mock.calls[1] as [string, RequestInit]
  expect(new URL(url).pathname).toBe('/api/v1/uk/report/constructors/management-returns/preview')
  expect(options).toMatchObject({ method: 'POST', credentials: 'include', cache: 'no-store', signal: controller.signal })
  expect(JSON.parse(options.body as string)).toEqual(createManagementReturnsRequest(capability, report))
  expect(new Headers(options.headers).get('X-CSRF-Token')).toBe(session.csrfToken)
})
it('refuses invalid scope, unimplemented capability and a different caller before HTTP', async () => {
  const capability = managementReturnsCapability(), report = managementReturnsReport()
  await expect(previewManagementReturns({ ...capability, RuntimeImplemented: false }, report, session.userNetUid, signal())).rejects.toThrow('Сервер не підтвердив')
  await expect(previewManagementReturns(capability, { ...report, CurrentPeriod: { From: '', ThroughExclusive: '' } }, session.userNetUid, signal())).rejects.toThrow('локального періоду')
  await expect(getManagementReturnsCapabilities('another-owner', signal())).rejects.toMatchObject({ status: 401 })
  expect(fetchMock).not.toHaveBeenCalled()
})
it.each(['Gba-Report-Request-Sha256', 'Gba-Report-Result-Sha256'])('refuses a mismatched %s header without retry or unbound links', async header => {
  fetchMock.mockResolvedValueOnce(response(managementReturnsReport(), { [header]: 'a'.repeat(64) }))
  await expect(previewManagementReturns(managementReturnsCapability(), managementReturnsReport(), session.userNetUid, signal())).rejects.toThrow('непідтверджений результат')
  expect(fetchMock).toHaveBeenCalledOnce()
})
it.each([403, 409, 503])('does not retry a refused or ambiguous %s preview', async status => {
  fetchMock.mockResolvedValueOnce(new Response('', { status }))
  await expect(previewManagementReturns(managementReturnsCapability(), managementReturnsReport(), session.userNetUid, signal())).rejects.toMatchObject({ status })
  expect(fetchMock).toHaveBeenCalledOnce()
})
it('allows conventional same-owner 401 refresh without changing the declared window bytes', async () => {
  fetchMock.mockResolvedValueOnce(new Response('', { status: 401 }))
    .mockResolvedValueOnce(response({ UserNetUid: session.userNetUid, CsrfToken: 'returns-refreshed' })).mockResolvedValueOnce(response())
  await previewManagementReturns(managementReturnsCapability(), managementReturnsReport(), session.userNetUid, signal())
  expect(fetchMock).toHaveBeenCalledTimes(3); expect(fetchMock.mock.calls[2][1].body).toBe(fetchMock.mock.calls[0][1].body)
  expect(new Headers(fetchMock.mock.calls[2][1].headers).get('X-CSRF-Token')).toBe('returns-refreshed')
  expect(readSession()?.userNetUid).toBe(session.userNetUid)
})
it('captures local-window command before the caller edits it during fetch', async () => {
  let release!: (value: Response) => void
  fetchMock.mockReturnValueOnce(new Promise<Response>(resolve => { release = resolve }))
  const windows = managementReturnsReport(), pending = previewManagementReturns(managementReturnsCapability(), windows, session.userNetUid, signal())
  windows.CurrentPeriod.From = '2026-09-15T00:00:00.000'; release(response())
  expect((await pending).CurrentPeriod.From).toBe('2026-09-01T00:00:00.000')
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).CurrentPeriod.From).toBe('2026-09-01T00:00:00.000')
})
it('rejects a deferred old-owner response without clearing the new session', async () => {
  let release!: (value: Response) => void
  fetchMock.mockReturnValueOnce(new Promise<Response>(resolve => { release = resolve }))
  const pending = previewManagementReturns(managementReturnsCapability(), managementReturnsReport(), session.userNetUid, signal()).then(() => null, error => error)
  const next = { userNetUid: '22222222-2222-2222-2222-222222222222', csrfToken: 'new-owner' }; saveSession(next); release(response())
  expect(await pending).toMatchObject({ name: 'AbortError' }); expect(readSession()).toEqual(next)
})
it('rejects an authentication generation changed during body drain', async () => {
  let body!: ReadableStreamDefaultController<Uint8Array>
  fetchMock.mockResolvedValueOnce(new Response(new ReadableStream<Uint8Array>({ start(value) { body = value } }), {
    headers: { 'Content-Type': 'application/json', 'Gba-Report-Request-Sha256': managementReturnsReport().RequestSha256, 'Gba-Report-Result-Sha256': managementReturnsReport().ResultSha256 } }))
  const pending = previewManagementReturns(managementReturnsCapability(), managementReturnsReport(), session.userNetUid, signal())
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce()); saveSession({ ...session, csrfToken: 'new-login' })
  body.enqueue(new TextEncoder().encode(JSON.stringify({ Body: managementReturnsReport() }))); body.close()
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
})
it('cancels the response stream and returns no partial results or files', async () => {
  const cancel = vi.fn(), controller = new AbortController()
  fetchMock.mockResolvedValueOnce(new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'application/json' } }))
  const pending = previewManagementReturns(managementReturnsCapability(), managementReturnsReport(), session.userNetUid, controller.signal)
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce()); controller.abort()
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' }); expect(cancel).toHaveBeenCalledOnce()
})
