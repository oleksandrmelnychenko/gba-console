import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { clearSession, readSession, saveSession } from '../../../shared/auth/session'
import { createDefectProductionRequest } from '../data/defectProduction'
import { DEFECT_PRODUCTION_TEST_CALLER, defectProductionCapability, defectProductionReport } from '../data/defectProduction.test-fixtures'
import { getDefectProductionCapabilities, previewDefectProduction } from './defectProductionApi'

const fetchMock = vi.fn(), session = { userNetUid: DEFECT_PRODUCTION_TEST_CALLER, csrfToken: 'defect-csrf' }
const signal = () => new AbortController().signal
function response(body: unknown = defectProductionReport(), overrides: Record<string, string> = {}) {
  return new Response(JSON.stringify({ Body: body }), { headers: { 'Content-Type': 'application/json',
    'Gba-Report-Request-Sha256': defectProductionReport().RequestSha256, 'Gba-Report-Result-Sha256': defectProductionReport().ResultSha256, ...overrides } })
}
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); saveSession(session) })
afterEach(() => { clearSession(); vi.unstubAllGlobals() })

it('reads genuine capability and exact immutable monthly preview with cookies/CSRF/hash-bound files', async () => {
  const capability = defectProductionCapability(), report = defectProductionReport(), controller = new AbortController()
  fetchMock.mockResolvedValueOnce(response(capability)).mockResolvedValueOnce(response(report))
  expect(await getDefectProductionCapabilities(session.userNetUid, controller.signal)).toEqual(capability)
  expect(await previewDefectProduction(capability, report.Month, session.userNetUid, controller.signal)).toEqual(report)
  expect(fetchMock).toHaveBeenCalledTimes(2)
  const [url, options] = fetchMock.mock.calls[1] as [string, RequestInit]
  expect(new URL(url).pathname).toBe('/api/v1/uk/report/constructors/defect-production/preview')
  expect(options).toMatchObject({ method: 'POST', credentials: 'include', cache: 'no-store', signal: controller.signal })
  expect(JSON.parse(options.body as string)).toEqual(createDefectProductionRequest(capability, report.Month))
  expect(new Headers(options.headers).get('X-CSRF-Token')).toBe(session.csrfToken)
})
it('refuses invalid scope, unimplemented capability and a different caller before HTTP', async () => {
  const capability = defectProductionCapability(), report = defectProductionReport()
  await expect(previewDefectProduction({ ...capability, RuntimeImplemented: false }, report.Month, session.userNetUid, signal())).rejects.toThrow('Сервер не підтвердив')
  await expect(previewDefectProduction(capability, '2026-9', session.userNetUid, signal())).rejects.toThrow('місяць')
  await expect(getDefectProductionCapabilities('another-owner', signal())).rejects.toMatchObject({ status: 401 })
  expect(fetchMock).not.toHaveBeenCalled()
})
it.each(['Gba-Report-Request-Sha256', 'Gba-Report-Result-Sha256'])('refuses a mismatched %s header without retry or unbound links', async header => {
  fetchMock.mockResolvedValueOnce(response(defectProductionReport(), { [header]: 'a'.repeat(64) }))
  await expect(previewDefectProduction(defectProductionCapability(), defectProductionReport().Month, session.userNetUid, signal())).rejects.toThrow('непідтверджений результат')
  expect(fetchMock).toHaveBeenCalledOnce()
})
it.each([403, 409, 503])('does not retry a refused or ambiguous %s preview', async status => {
  fetchMock.mockResolvedValueOnce(new Response('', { status }))
  await expect(previewDefectProduction(defectProductionCapability(), defectProductionReport().Month, session.userNetUid, signal())).rejects.toMatchObject({ status })
  expect(fetchMock).toHaveBeenCalledOnce()
})
it('allows conventional same-owner 401 refresh without changing the declared month bytes', async () => {
  fetchMock.mockResolvedValueOnce(new Response('', { status: 401 }))
    .mockResolvedValueOnce(response({ UserNetUid: session.userNetUid, CsrfToken: 'defect-refreshed' })).mockResolvedValueOnce(response())
  await previewDefectProduction(defectProductionCapability(), defectProductionReport().Month, session.userNetUid, signal())
  expect(fetchMock).toHaveBeenCalledTimes(3); expect(fetchMock.mock.calls[2][1].body).toBe(fetchMock.mock.calls[0][1].body)
  expect(new Headers(fetchMock.mock.calls[2][1].headers).get('X-CSRF-Token')).toBe('defect-refreshed')
  expect(readSession()?.userNetUid).toBe(session.userNetUid)
})
it('captures immutable month and original identity before a caller mutates the capability during fetch',async()=>{
  let release!:(value:Response)=>void;fetchMock.mockReturnValueOnce(new Promise<Response>(resolve=>{release=resolve}))
  const capability=defectProductionCapability(),pending=previewDefectProduction(capability,'2026-09',session.userNetUid,signal())
  Reflect.set(capability.SourceIdentity,'DefinitionSha256','later-edited');release(response())
  expect((await pending).Month).toBe('2026-09');expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(createDefectProductionRequest(defectProductionCapability(),'2026-09'))
})
it('rejects a deferred old-owner response without clearing the new session', async () => {
  let release!: (value: Response) => void
  fetchMock.mockReturnValueOnce(new Promise<Response>(resolve => { release = resolve }))
  const pending = previewDefectProduction(defectProductionCapability(), defectProductionReport().Month, session.userNetUid, signal()).then(() => null, error => error)
  const next = { userNetUid: '22222222-2222-2222-2222-222222222222', csrfToken: 'new-owner' }; saveSession(next); release(response())
  expect(await pending).toMatchObject({ name: 'AbortError' }); expect(readSession()).toEqual(next)
})
it('rejects an authentication generation changed during body drain', async () => {
  let body!: ReadableStreamDefaultController<Uint8Array>
  fetchMock.mockResolvedValueOnce(new Response(new ReadableStream<Uint8Array>({ start(value) { body = value } }), {
    headers: { 'Content-Type': 'application/json', 'Gba-Report-Request-Sha256': defectProductionReport().RequestSha256, 'Gba-Report-Result-Sha256': defectProductionReport().ResultSha256 } }))
  const pending = previewDefectProduction(defectProductionCapability(), defectProductionReport().Month, session.userNetUid, signal())
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce()); saveSession({ ...session, csrfToken: 'new-login' })
  body.enqueue(new TextEncoder().encode(JSON.stringify({ Body: defectProductionReport() }))); body.close()
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
})
it('cancels the response stream and returns no partial results or files', async () => {
  const cancel = vi.fn(), controller = new AbortController()
  fetchMock.mockResolvedValueOnce(new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'application/json' } }))
  const pending = previewDefectProduction(defectProductionCapability(), defectProductionReport().Month, session.userNetUid, controller.signal)
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce()); controller.abort()
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' }); expect(cancel).toHaveBeenCalledOnce()
})

it.each(['json','utf8','type','cap'])('refuses malformed or oversized %s body while cancelling the bounded stream',async kind=>{
  const bytes=kind==='utf8'?new Uint8Array([0xff]):kind==='cap'?new Uint8Array(1024*1024+1):new TextEncoder().encode('{broken')
  const headers={'Content-Type':kind==='type'?'text/html':'application/json'}
  fetchMock.mockResolvedValueOnce(new Response(bytes,{headers}))
  await expect(previewDefectProduction(defectProductionCapability(),'2026-09',session.userNetUid,signal())).rejects.toThrow('непідтверджений результат')
  expect(fetchMock).toHaveBeenCalledOnce()
})
it('does not reuse a cancelled owner request when a second owner sends the identical month command',async()=>{
  let release!:(value:Response)=>void;fetchMock.mockReturnValueOnce(new Promise<Response>(resolve=>{release=resolve})).mockResolvedValueOnce(response())
  const old=new AbortController(),first=previewDefectProduction(defectProductionCapability(),'2026-09',session.userNetUid,old.signal).catch(error=>error)
  old.abort();const next={userNetUid:'22222222-2222-2222-2222-222222222222',csrfToken:'new-owner'};saveSession(next)
  expect(await previewDefectProduction(defectProductionCapability(),'2026-09',next.userNetUid,signal())).toEqual(defectProductionReport())
  release(response());expect(await first).toMatchObject({name:'AbortError'});expect(fetchMock).toHaveBeenCalledTimes(2)
})
