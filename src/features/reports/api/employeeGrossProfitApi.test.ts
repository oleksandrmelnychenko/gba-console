import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { clearSession, readSession, saveSession } from '../../../shared/auth/session'
import { createEmployeeGrossProfitRequest } from '../data/employeeGrossProfit'
import { employeeGrossProfitCapability, employeeGrossProfitReport } from '../data/employeeGrossProfit.test-fixtures'
import { getEmployeeGrossProfitCapabilities, previewEmployeeGrossProfit } from './employeeGrossProfitApi'

const EMPLOYEE_GROSS_PROFIT_TEST_CALLER = '11111111-1111-1111-1111-111111111111'
const fetchMock = vi.fn(), session = { userNetUid: EMPLOYEE_GROSS_PROFIT_TEST_CALLER, csrfToken: 'employee-csrf' }
const signal = () => new AbortController().signal
function response(body: unknown = employeeGrossProfitReport(), overrides: Record<string, string> = {}) {
  return new Response(JSON.stringify({ Body: body }), { headers: { 'Content-Type': 'application/json',
    'Gba-Report-Request-Sha256': employeeGrossProfitReport().RequestSha256, 'Gba-Report-Result-Sha256': employeeGrossProfitReport().ResultSha256, ...overrides } })
}
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); saveSession(session) })
afterEach(() => { clearSession(); vi.unstubAllGlobals() })

it('reads genuine capability and exact immutable month preview with cookies/CSRF/hash-bound files', async () => {
  const capability = employeeGrossProfitCapability(), report = employeeGrossProfitReport(), controller = new AbortController()
  fetchMock.mockResolvedValueOnce(response(capability)).mockResolvedValueOnce(response(report))
  expect(await getEmployeeGrossProfitCapabilities(session.userNetUid, controller.signal)).toEqual(capability)
  expect(await previewEmployeeGrossProfit(capability, report.Month, session.userNetUid, controller.signal)).toEqual(report)
  expect(fetchMock).toHaveBeenCalledTimes(2)
  const [url, options] = fetchMock.mock.calls[1] as [string, RequestInit]
  expect(new URL(url).pathname).toBe('/api/v1/uk/report/constructors/employee-gross-profit/preview')
  expect(options).toMatchObject({ method: 'POST', credentials: 'include', cache: 'no-store', signal: controller.signal })
  expect(JSON.parse(options.body as string)).toEqual(createEmployeeGrossProfitRequest(capability, report.Month))
  expect(new Headers(options.headers).get('X-CSRF-Token')).toBe(session.csrfToken)
})
it('refuses invalid scope, unimplemented capability and a different caller before HTTP', async () => {
  const capability = employeeGrossProfitCapability(), report = employeeGrossProfitReport()
  await expect(previewEmployeeGrossProfit({ ...capability, RuntimeImplemented: false }, report.Month, session.userNetUid, signal())).rejects.toThrow('Сервер не підтвердив')
  await expect(previewEmployeeGrossProfit(capability, '2026-Q3', session.userNetUid, signal())).rejects.toThrow('Оберіть допустимий')
  await expect(getEmployeeGrossProfitCapabilities('another-owner', signal())).rejects.toMatchObject({ status: 401 })
  expect(fetchMock).not.toHaveBeenCalled()
})
it.each(['Gba-Report-Request-Sha256', 'Gba-Report-Result-Sha256'])('refuses a mismatched %s header without retry or unbound links', async header => {
  fetchMock.mockResolvedValueOnce(response(employeeGrossProfitReport(), { [header]: 'a'.repeat(64) }))
  await expect(previewEmployeeGrossProfit(employeeGrossProfitCapability(), '2026-09', session.userNetUid, signal())).rejects.toThrow('некоректний результат')
  expect(fetchMock).toHaveBeenCalledOnce()
})
it.each([403, 409, 503])('does not retry a refused or ambiguous %s preview', async status => {
  fetchMock.mockResolvedValueOnce(new Response('', { status }))
  await expect(previewEmployeeGrossProfit(employeeGrossProfitCapability(), '2026-09', session.userNetUid, signal())).rejects.toMatchObject({ status })
  expect(fetchMock).toHaveBeenCalledOnce()
})
it('allows conventional same-owner 401 refresh without changing the declared month bytes', async () => {
  fetchMock.mockResolvedValueOnce(new Response('', { status: 401 }))
    .mockResolvedValueOnce(response({ UserNetUid: session.userNetUid, CsrfToken: 'employee-refreshed' })).mockResolvedValueOnce(response())
  await previewEmployeeGrossProfit(employeeGrossProfitCapability(), '2026-09', session.userNetUid, signal())
  expect(fetchMock).toHaveBeenCalledTimes(3); expect(fetchMock.mock.calls[2][1].body).toBe(fetchMock.mock.calls[0][1].body)
  expect(new Headers(fetchMock.mock.calls[2][1].headers).get('X-CSRF-Token')).toBe('employee-refreshed')
  expect(readSession()?.userNetUid).toBe(session.userNetUid)
})
it('never retries an old month preview after a caller change during 401 refresh or clears the new login', async () => {
  let release!: (value: Response) => void
  fetchMock.mockResolvedValueOnce(new Response('', { status: 401 }))
    .mockReturnValueOnce(new Promise<Response>(resolve => { release = resolve }))
  const pending = previewEmployeeGrossProfit(employeeGrossProfitCapability(), '2026-09', session.userNetUid, signal()).then(() => null, error => error)
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  const next = { userNetUid: '22222222-2222-2222-2222-222222222222', csrfToken: 'new-owner-login' }
  saveSession(next); release(response({ UserNetUid: next.userNetUid, CsrfToken: next.csrfToken }))
  expect(await pending).toMatchObject({ name: 'AbortError' }); expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(readSession()).toEqual(next)
})
it('captures the immutable month command before later capability edits', async () => {
  let release!: (value: Response) => void
  fetchMock.mockReturnValueOnce(new Promise<Response>(resolve => { release = resolve }))
  const capability = employeeGrossProfitCapability(), pending = previewEmployeeGrossProfit(capability, '2026-09', session.userNetUid, signal())
  capability.RuntimeImplemented = false; release(response())
  expect((await pending).Month).toBe('2026-09')
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(createEmployeeGrossProfitRequest(employeeGrossProfitCapability(), '2026-09'))
})
it('rejects a deferred old-owner response without clearing the new session', async () => {
  let release!: (value: Response) => void
  fetchMock.mockReturnValueOnce(new Promise<Response>(resolve => { release = resolve }))
  const pending = previewEmployeeGrossProfit(employeeGrossProfitCapability(), '2026-09', session.userNetUid, signal()).then(() => null, error => error)
  const next = { userNetUid: '22222222-2222-2222-2222-222222222222', csrfToken: 'new-owner' }; saveSession(next); release(response())
  expect(await pending).toMatchObject({ name: 'AbortError' }); expect(readSession()).toEqual(next)
})
it('rejects an authentication generation changed during body drain', async () => {
  let body!: ReadableStreamDefaultController<Uint8Array>
  fetchMock.mockResolvedValueOnce(new Response(new ReadableStream<Uint8Array>({ start(value) { body = value } }), {
    headers: { 'Content-Type': 'application/json', 'Gba-Report-Request-Sha256': employeeGrossProfitReport().RequestSha256, 'Gba-Report-Result-Sha256': employeeGrossProfitReport().ResultSha256 } }))
  const pending = previewEmployeeGrossProfit(employeeGrossProfitCapability(), '2026-09', session.userNetUid, signal())
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce()); saveSession({ ...session, csrfToken: 'new-login' })
  body.enqueue(new TextEncoder().encode(JSON.stringify({ Body: employeeGrossProfitReport() }))); body.close()
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
})
it('cancels the response stream and returns no partial results or files', async () => {
  const cancel = vi.fn(), controller = new AbortController()
  fetchMock.mockResolvedValueOnce(new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'application/json' } }))
  const pending = previewEmployeeGrossProfit(employeeGrossProfitCapability(), '2026-09', session.userNetUid, controller.signal)
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce()); controller.abort()
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' }); expect(cancel).toHaveBeenCalledOnce()
})
