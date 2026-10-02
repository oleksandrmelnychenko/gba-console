import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { clearSession, readSession, saveSession } from '../../../shared/auth/session'
import { createPlannedCashRequest, PLANNED_CASH_FORMS } from '../data/plannedCash'
import { PLANNED_CASH_TEST_CALLER, plannedCashCapability, plannedCashCalendarKinds, plannedCashDdsKinds,
  plannedCashKinds, plannedCashFilters, plannedCashReport } from '../data/plannedCash.test-fixtures'
import { getPlannedCashCapabilities, previewPlannedCash } from './plannedCashApi'
const fetchMock = vi.fn(), session = { userNetUid: PLANNED_CASH_TEST_CALLER, csrfToken: 'planned-cash-csrf' }
const signal = () => new AbortController().signal
function response(body: unknown = plannedCashReport(), overrides: Record<string, string> = {}) {
  return new Response(JSON.stringify({ Body: body }), { headers: { 'Content-Type': 'application/json',
    'Gba-Report-Request-Sha256': plannedCashReport().RequestSha256, 'Gba-Report-Result-Sha256': plannedCashReport().ResultSha256, ...overrides } })
}
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); saveSession(session) })
afterEach(() => { clearSession(); vi.unstubAllGlobals() })
it.each(plannedCashKinds)('reads the actual %s capability from its own authenticated route', async kind => {
  fetchMock.mockResolvedValueOnce(response(plannedCashCapability(kind)))
  expect(await getPlannedCashCapabilities(kind, session.userNetUid, signal())).toEqual(plannedCashCapability(kind))
  expect(new URL(fetchMock.mock.calls[0][0]).pathname).toBe(`/api/v1/uk/report/constructors/planned-cash/${PLANNED_CASH_FORMS[kind].Route}/capabilities`)
})
it.each(plannedCashCalendarKinds)('posts exact %s scope and opaque identity with same-run headers/files and CSRF', async kind => {
  const cap = plannedCashCapability(kind), report = plannedCashReport(kind), controller = new AbortController()
  cap.SourceIdentity.DefinitionSha256 = '0'.repeat(64); report.SourceIdentity = { ...cap.SourceIdentity }
  fetchMock.mockResolvedValueOnce(response(report))
  expect(await previewPlannedCash(cap, plannedCashFilters(), session.userNetUid, controller.signal)).toEqual(report)
  const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
  expect(new URL(url).pathname).toBe(`/api/v1/uk/report/constructors/planned-cash/${PLANNED_CASH_FORMS[kind].Route}/preview`)
  expect(options).toMatchObject({ method: 'POST', credentials: 'include', cache: 'no-store', signal: controller.signal })
  expect(JSON.parse(options.body as string)).toEqual(createPlannedCashRequest(cap, plannedCashFilters()))
  expect(new Headers(options.headers).get('X-CSRF-Token')).toBe(session.csrfToken); expect(fetchMock).toHaveBeenCalledOnce()
})
it.each(plannedCashDdsKinds)('does not POST %s when genuine scenario choices are unavailable', async kind => {
  await expect(previewPlannedCash(plannedCashCapability(kind), plannedCashFilters(), session.userNetUid, signal())).rejects.toThrow('Оберіть сценарій')
  expect(fetchMock).not.toHaveBeenCalled()
})
it('refuses a dirty date, unsupported runtime and different caller before HTTP', async () => {
  await expect(previewPlannedCash(plannedCashCapability(), { ...plannedCashFilters(), From: '2026-02-30' }, session.userNetUid, signal())).rejects.toThrow('межі періоду')
  await expect(previewPlannedCash({ ...plannedCashCapability(), RuntimeImplemented: false }, plannedCashFilters(), session.userNetUid, signal())).rejects.toThrow('Сервер не підтвердив')
  await expect(getPlannedCashCapabilities('CalendarPayouts', 'different-owner', signal())).rejects.toMatchObject({ status: 401 })
  expect(fetchMock).not.toHaveBeenCalled()
})
it.each(['Gba-Report-Request-Sha256', 'Gba-Report-Result-Sha256'])('rejects a mismatched %s header without exposing files or retry', async header => {
  fetchMock.mockResolvedValueOnce(response(plannedCashReport(), { [header]: '0'.repeat(64) }))
  await expect(previewPlannedCash(plannedCashCapability(), plannedCashFilters(), session.userNetUid, signal())).rejects.toThrow('непідтверджений результат')
  expect(fetchMock).toHaveBeenCalledOnce()
})
it.each([403, 409, 503])('does not retry refused or ambiguous %s preview', async status => {
  fetchMock.mockResolvedValueOnce(new Response('', { status }))
  await expect(previewPlannedCash(plannedCashCapability(), plannedCashFilters(), session.userNetUid, signal())).rejects.toMatchObject({ status })
  expect(fetchMock).toHaveBeenCalledOnce()
})
it('allows same-owner 401 refresh preserving exact request bytes', async () => {
  fetchMock.mockResolvedValueOnce(new Response('', { status: 401 })).mockResolvedValueOnce(response({ UserNetUid: session.userNetUid, CsrfToken: 'refreshed' })).mockResolvedValueOnce(response())
  await previewPlannedCash(plannedCashCapability(), plannedCashFilters(), session.userNetUid, signal())
  expect(fetchMock).toHaveBeenCalledTimes(3); expect(fetchMock.mock.calls[2][1].body).toBe(fetchMock.mock.calls[0][1].body)
  expect(new Headers(fetchMock.mock.calls[2][1].headers).get('X-CSRF-Token')).toBe('refreshed')
})
it('captures immutable filter and capability bytes before a fetch caller changes them', async () => {
  let release!: (value: Response) => void; fetchMock.mockReturnValueOnce(new Promise<Response>(resolve => { release = resolve }))
  const cap = plannedCashCapability(), filters = plannedCashFilters(), pending = previewPlannedCash(cap, filters, session.userNetUid, signal())
  cap.SourceIdentity.DefinitionSha256 = '0'.repeat(64); filters.From = '2026-08-01'; release(response())
  expect(await pending).toEqual(plannedCashReport()); expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(createPlannedCashRequest(plannedCashCapability(), plannedCashFilters()))
})
it('rejects a deferred old-owner response while preserving the new login', async () => {
  let release!: (value: Response) => void; fetchMock.mockReturnValueOnce(new Promise<Response>(resolve => { release = resolve }))
  const pending = previewPlannedCash(plannedCashCapability(), plannedCashFilters(), session.userNetUid, signal()).catch(error => error)
  const next = { userNetUid: '22222222-2222-2222-2222-222222222222', csrfToken: 'next' }; saveSession(next); release(response())
  expect(await pending).toMatchObject({ name: 'AbortError' }); expect(readSession()).toEqual(next)
})
it('rejects a new authentication generation during body drain', async () => {
  let body!: ReadableStreamDefaultController<Uint8Array>
  fetchMock.mockResolvedValueOnce(new Response(new ReadableStream<Uint8Array>({ start(value) { body = value } }), { headers: { 'Content-Type': 'application/json',
    'Gba-Report-Request-Sha256': plannedCashReport().RequestSha256, 'Gba-Report-Result-Sha256': plannedCashReport().ResultSha256 } }))
  const pending = previewPlannedCash(plannedCashCapability(), plannedCashFilters(), session.userNetUid, signal())
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce()); saveSession({ ...session, csrfToken: 'new-login' })
  body.enqueue(new TextEncoder().encode(JSON.stringify({ Body: plannedCashReport() }))); body.close()
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
})
it('cancels bounded drain and publishes no partial values or files', async () => {
  const cancel = vi.fn(), controller = new AbortController()
  fetchMock.mockResolvedValueOnce(new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'application/json' } }))
  const pending = previewPlannedCash(plannedCashCapability(), plannedCashFilters(), session.userNetUid, controller.signal)
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce()); controller.abort()
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' }); expect(cancel).toHaveBeenCalledOnce()
})
it.each(['json', 'utf8', 'type'])('refuses malformed %s body without retry', async kind => {
  const bytes = kind === 'utf8' ? new Uint8Array([0xff]) : new TextEncoder().encode('{broken')
  fetchMock.mockResolvedValueOnce(new Response(bytes, { headers: { 'Content-Type': kind === 'type' ? 'text/html' : 'application/json' } }))
  await expect(previewPlannedCash(plannedCashCapability(), plannedCashFilters(), session.userNetUid, signal())).rejects.toThrow('непідтверджений результат')
  expect(fetchMock).toHaveBeenCalledOnce()
})
it('refuses another owner named by refresh instead of replaying the preview for them', async () => {
  fetchMock.mockResolvedValueOnce(new Response('', { status: 401 })).mockResolvedValueOnce(response({ UserNetUid: '22222222-2222-2222-2222-222222222222', CsrfToken: 'another' }))
  await expect(previewPlannedCash(plannedCashCapability(), plannedCashFilters(), session.userNetUid, signal())).rejects.toMatchObject({ status: 401 })
  expect(fetchMock).toHaveBeenCalledTimes(2)
})
