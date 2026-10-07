import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { clearSession, readSession, saveSession } from '../../../shared/auth/session'
import { createManagementBalanceRequest, type ManagementBalanceKind } from '../data/managementBalance'
import { MANAGEMENT_BALANCE_TEST_CALLER, managementBalanceCapability, managementBalanceReport } from '../data/managementBalance.test-fixtures'
import { getManagementBalanceCapabilities, previewManagementBalance } from './managementBalanceApi'
const fetchMock = vi.fn(), session = { userNetUid: MANAGEMENT_BALANCE_TEST_CALLER, csrfToken: 'balance-csrf' }
const signal = () => new AbortController().signal
function response(body: unknown = managementBalanceReport(), overrides: Record<string, string> = {}) {
  return new Response(JSON.stringify({ Body: body }), { headers: { 'Content-Type': 'application/json',
    'Gba-Report-Request-Sha256': managementBalanceReport().RequestSha256, 'Gba-Report-Result-Sha256': managementBalanceReport().ResultSha256, ...overrides } })
}
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); saveSession(session) })
afterEach(() => { clearSession(); vi.unstubAllGlobals() })
it.each(['monthlyReceivables', 'quarterlyManagementPayables'] as ManagementBalanceKind[])('streams %s exact period command with cookies/CSRF and same-run bound files', async kind => {
  const capability = managementBalanceCapability(kind), report = managementBalanceReport(kind), controller = new AbortController()
  fetchMock.mockResolvedValueOnce(response(capability)).mockResolvedValueOnce(response(report))
  expect(await getManagementBalanceCapabilities(kind, session.userNetUid, controller.signal)).toEqual(capability)
  expect(await previewManagementBalance(capability, report.Period, session.userNetUid, controller.signal)).toEqual(report)
  const [url, options] = fetchMock.mock.calls[1] as [string, RequestInit]
  expect(new URL(url).pathname).toBe(`/api/v1/uk/report/constructors/${kind === 'monthlyReceivables' ? 'management-receivables' : 'management-payables'}/preview`)
  expect(options).toMatchObject({ method: 'POST', credentials: 'include', cache: 'no-store', signal: controller.signal })
  expect(JSON.parse(options.body as string)).toEqual(createManagementBalanceRequest(capability, report.Period))
  expect(new Headers(options.headers).get('X-CSRF-Token')).toBe(session.csrfToken)
})
it('refuses invalid period, disabled runtime and different caller before HTTP', async () => {
  const capability = managementBalanceCapability()
  await expect(previewManagementBalance({ ...capability, RuntimeImplemented: false }, '2026-09', session.userNetUid, signal())).rejects.toThrow('Сервер не підтвердив')
  await expect(previewManagementBalance(capability, '2026-Q3', session.userNetUid, signal())).rejects.toThrow('допустимий місяць')
  await expect(getManagementBalanceCapabilities('monthlyReceivables', 'another-owner', signal())).rejects.toMatchObject({ status: 401 })
  expect(fetchMock).not.toHaveBeenCalled()
})
it('rejects a cross-original capability even if the other endpoint is implemented', async () => {
  fetchMock.mockResolvedValueOnce(response(managementBalanceCapability('quarterlyManagementPayables')))
  await expect(getManagementBalanceCapabilities('monthlyReceivables', session.userNetUid, signal())).rejects.toThrow('непідтверджений результат')
})
it.each(['Gba-Report-Request-Sha256', 'Gba-Report-Result-Sha256'])('rejects %s mismatch without returning files or retrying', async header => {
  fetchMock.mockResolvedValueOnce(response(managementBalanceReport(), { [header]: 'a'.repeat(64) }))
  await expect(previewManagementBalance(managementBalanceCapability(), '2026-09', session.userNetUid, signal())).rejects.toThrow('непідтверджений результат')
  expect(fetchMock).toHaveBeenCalledOnce()
})
it.each([403, 409, 503])('does not retry refused/ambiguous %s command', async status => {
  fetchMock.mockResolvedValueOnce(new Response('', { status }))
  await expect(previewManagementBalance(managementBalanceCapability(), '2026-09', session.userNetUid, signal())).rejects.toMatchObject({ status })
  expect(fetchMock).toHaveBeenCalledOnce()
})
it('allows conventional same-owner 401 refresh without changing command bytes', async () => {
  fetchMock.mockResolvedValueOnce(new Response('', { status: 401 }))
    .mockResolvedValueOnce(response({ UserNetUid: session.userNetUid, CsrfToken: 'balance-refreshed' })).mockResolvedValueOnce(response())
  await previewManagementBalance(managementBalanceCapability(), '2026-09', session.userNetUid, signal())
  expect(fetchMock).toHaveBeenCalledTimes(3); expect(fetchMock.mock.calls[2][1].body).toBe(fetchMock.mock.calls[0][1].body)
  expect(new Headers(fetchMock.mock.calls[2][1].headers).get('X-CSRF-Token')).toBe('balance-refreshed'); expect(readSession()?.userNetUid).toBe(session.userNetUid)
})
it('rejects a deferred old-owner response without clearing the new session', async () => {
  let release!: (value: Response) => void; fetchMock.mockReturnValueOnce(new Promise<Response>(resolve => { release = resolve }))
  const pending = previewManagementBalance(managementBalanceCapability(), '2026-09', session.userNetUid, signal()).then(() => null, error => error)
  const next = { userNetUid: '22222222-2222-2222-2222-222222222222', csrfToken: 'new-owner' }; saveSession(next); release(response())
  expect(await pending).toMatchObject({ name: 'AbortError' }); expect(readSession()).toEqual(next)
})
it('rejects switch-away-and-back generation while the body is still draining', async () => {
  let body!: ReadableStreamDefaultController<Uint8Array>
  fetchMock.mockResolvedValueOnce(new Response(new ReadableStream<Uint8Array>({ start(value) { body = value } }), {
    headers: { 'Content-Type': 'application/json', 'Gba-Report-Request-Sha256': managementBalanceReport().RequestSha256, 'Gba-Report-Result-Sha256': managementBalanceReport().ResultSha256 } }))
  const pending = previewManagementBalance(managementBalanceCapability(), '2026-09', session.userNetUid, signal())
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
  saveSession({ userNetUid: '22222222-2222-2222-2222-222222222222', csrfToken: 'other-owner' }); saveSession({ ...session, csrfToken: 'new-login' })
  body.enqueue(new TextEncoder().encode(JSON.stringify({ Body: managementBalanceReport() }))); body.close()
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
})
it('cancels bounded stream on abort without accepting partial values', async () => {
  const cancel = vi.fn(), controller = new AbortController()
  fetchMock.mockResolvedValueOnce(new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'application/json' } }))
  const pending = previewManagementBalance(managementBalanceCapability(), '2026-09', session.userNetUid, controller.signal)
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce()); controller.abort()
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' }); expect(cancel).toHaveBeenCalledOnce()
})
it.each(['malformed', 'utf8', 'oversized', 'type'])('refuses %s payload and drains/cancels it', async kind => {
  const body = kind === 'utf8' ? new Uint8Array([0xc3, 0x28]) : kind === 'oversized' ? new Uint8Array(16 * 1024 * 1024 + 1) : '{not-json'
  fetchMock.mockResolvedValueOnce(new Response(body, { headers: { 'Content-Type': kind === 'type' ? 'text/html' : 'application/json' } }))
  await expect(getManagementBalanceCapabilities('monthlyReceivables', session.userNetUid, signal())).rejects.toThrow('непідтверджений результат')
  expect(fetchMock).toHaveBeenCalledOnce()
})
