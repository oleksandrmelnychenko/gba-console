import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { clearSession, readSession, saveSession } from '../../../shared/auth/session'
import { createCurrentLiquidityRequest } from '../data/currentLiquidity'
import { CURRENT_LIQUIDITY_TEST_CALLER, currentLiquidityCapability, currentLiquidityReport } from '../data/currentLiquidity.test-fixtures'
import { getCurrentLiquidityCapabilities, previewCurrentLiquidity } from './currentLiquidityApi'

const fetchMock = vi.fn(), session = { userNetUid: CURRENT_LIQUIDITY_TEST_CALLER, csrfToken: 'liquidity-csrf' }
const signal = () => new AbortController().signal
function response(body: unknown = currentLiquidityReport(), overrides: Record<string, string> = {}) {
  return new Response(JSON.stringify({ Body: body }), { headers: { 'Content-Type': 'application/json',
    'Gba-Report-Request-Sha256': currentLiquidityReport().RequestSha256, 'Gba-Report-Result-Sha256': currentLiquidityReport().ResultSha256, ...overrides } })
}
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); saveSession(session) })
afterEach(() => { clearSession(); vi.unstubAllGlobals() })

it('reads genuine capability and exact immutable endpoint preview with cookies/CSRF/hash-bound files', async () => {
  const capability = currentLiquidityCapability(), report = currentLiquidityReport(), controller = new AbortController()
  fetchMock.mockResolvedValueOnce(response(capability)).mockResolvedValueOnce(response(report))
  expect(await getCurrentLiquidityCapabilities(session.userNetUid, controller.signal)).toEqual(capability)
  expect(await previewCurrentLiquidity(capability, report.CurrentEndpoint, report.PreviousEndpoint, session.userNetUid, controller.signal)).toEqual(report)
  expect(fetchMock).toHaveBeenCalledTimes(2)
  const [url, options] = fetchMock.mock.calls[1] as [string, RequestInit]
  expect(new URL(url).pathname).toBe('/api/v1/uk/report/constructors/current-liquidity/preview')
  expect(options).toMatchObject({ method: 'POST', credentials: 'include', cache: 'no-store', signal: controller.signal })
  expect(JSON.parse(options.body as string)).toEqual(createCurrentLiquidityRequest(capability, report.CurrentEndpoint, report.PreviousEndpoint))
  expect(new Headers(options.headers).get('X-CSRF-Token')).toBe(session.csrfToken)
})
it('refuses invalid scope, unimplemented capability and a different caller before HTTP', async () => {
  const capability = currentLiquidityCapability(), report = currentLiquidityReport()
  await expect(previewCurrentLiquidity({ ...capability, RuntimeImplemented: false }, report.CurrentEndpoint, report.PreviousEndpoint, session.userNetUid, signal())).rejects.toThrow('Сервер не підтвердив')
  await expect(previewCurrentLiquidity(capability, '2026-10-02', '2026-09-01', session.userNetUid, signal())).rejects.toThrow('першого дня місяця')
  await expect(getCurrentLiquidityCapabilities('another-owner', signal())).rejects.toMatchObject({ status: 401 })
  expect(fetchMock).not.toHaveBeenCalled()
})
it.each(['Gba-Report-Request-Sha256', 'Gba-Report-Result-Sha256'])('refuses a mismatched %s header without retry or unbound links', async header => {
  fetchMock.mockResolvedValueOnce(response(currentLiquidityReport(), { [header]: 'a'.repeat(64) }))
  await expect(previewCurrentLiquidity(currentLiquidityCapability(), currentLiquidityReport().CurrentEndpoint, currentLiquidityReport().PreviousEndpoint, session.userNetUid, signal())).rejects.toThrow('непідтверджений результат')
  expect(fetchMock).toHaveBeenCalledOnce()
})
it.each([403, 409, 503])('does not retry a refused or ambiguous %s preview', async status => {
  fetchMock.mockResolvedValueOnce(new Response('', { status }))
  await expect(previewCurrentLiquidity(currentLiquidityCapability(), currentLiquidityReport().CurrentEndpoint, currentLiquidityReport().PreviousEndpoint, session.userNetUid, signal())).rejects.toMatchObject({ status })
  expect(fetchMock).toHaveBeenCalledOnce()
})
it('allows conventional same-owner 401 refresh without changing the declared endpoints bytes', async () => {
  fetchMock.mockResolvedValueOnce(new Response('', { status: 401 }))
    .mockResolvedValueOnce(response({ UserNetUid: session.userNetUid, CsrfToken: 'liquidity-refreshed' })).mockResolvedValueOnce(response())
  await previewCurrentLiquidity(currentLiquidityCapability(), currentLiquidityReport().CurrentEndpoint, currentLiquidityReport().PreviousEndpoint, session.userNetUid, signal())
  expect(fetchMock).toHaveBeenCalledTimes(3); expect(fetchMock.mock.calls[2][1].body).toBe(fetchMock.mock.calls[0][1].body)
  expect(new Headers(fetchMock.mock.calls[2][1].headers).get('X-CSRF-Token')).toBe('liquidity-refreshed')
  expect(readSession()?.userNetUid).toBe(session.userNetUid)
})
it('captures immutable endpoints and original identity before a caller mutates the capability during fetch',async()=>{
  let release!:(value:Response)=>void;fetchMock.mockReturnValueOnce(new Promise<Response>(resolve=>{release=resolve}))
  const capability=currentLiquidityCapability(),pending=previewCurrentLiquidity(capability,'2026-10-01','2026-09-01',session.userNetUid,signal())
  Reflect.set(capability.SourceIdentity,'DefinitionSha256','later-edited');release(response())
  expect((await pending).CurrentEndpoint).toBe('2026-10-01');expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(createCurrentLiquidityRequest(currentLiquidityCapability(),'2026-10-01','2026-09-01'))
})
it('sends the opaque identity actually returned by capabilities and binds the response to that same version and definition', async () => {
  const capability = currentLiquidityCapability(), report = currentLiquidityReport()
  capability.SourceIdentity.DefinitionSha256 = 'e'.repeat(64); report.SourceIdentity = { ...capability.SourceIdentity }
  fetchMock.mockResolvedValueOnce(response(capability)).mockResolvedValueOnce(response(report))
  const received = await getCurrentLiquidityCapabilities(session.userNetUid, signal())
  expect(await previewCurrentLiquidity(received, report.CurrentEndpoint, report.PreviousEndpoint, session.userNetUid, signal())).toEqual(report)
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ Version: received.Version, SourceIdentity: received.SourceIdentity, CurrentEndpoint: report.CurrentEndpoint, PreviousEndpoint: report.PreviousEndpoint })
})
it('rejects a deferred old-owner response without clearing the new session', async () => {
  let release!: (value: Response) => void
  fetchMock.mockReturnValueOnce(new Promise<Response>(resolve => { release = resolve }))
  const pending = previewCurrentLiquidity(currentLiquidityCapability(), currentLiquidityReport().CurrentEndpoint, currentLiquidityReport().PreviousEndpoint, session.userNetUid, signal()).then(() => null, error => error)
  const next = { userNetUid: '22222222-2222-2222-2222-222222222222', csrfToken: 'new-owner' }; saveSession(next); release(response())
  expect(await pending).toMatchObject({ name: 'AbortError' }); expect(readSession()).toEqual(next)
})
it('rejects an authentication generation changed during body drain', async () => {
  let body!: ReadableStreamDefaultController<Uint8Array>
  fetchMock.mockResolvedValueOnce(new Response(new ReadableStream<Uint8Array>({ start(value) { body = value } }), {
    headers: { 'Content-Type': 'application/json', 'Gba-Report-Request-Sha256': currentLiquidityReport().RequestSha256, 'Gba-Report-Result-Sha256': currentLiquidityReport().ResultSha256 } }))
  const pending = previewCurrentLiquidity(currentLiquidityCapability(), currentLiquidityReport().CurrentEndpoint, currentLiquidityReport().PreviousEndpoint, session.userNetUid, signal())
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce()); saveSession({ ...session, csrfToken: 'new-login' })
  body.enqueue(new TextEncoder().encode(JSON.stringify({ Body: currentLiquidityReport() }))); body.close()
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
})
it('cancels the response stream and returns no partial results or files', async () => {
  const cancel = vi.fn(), controller = new AbortController()
  fetchMock.mockResolvedValueOnce(new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'application/json' } }))
  const pending = previewCurrentLiquidity(currentLiquidityCapability(), currentLiquidityReport().CurrentEndpoint, currentLiquidityReport().PreviousEndpoint, session.userNetUid, controller.signal)
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce()); controller.abort()
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' }); expect(cancel).toHaveBeenCalledOnce()
})

it.each(['json','utf8','type','cap'])('refuses malformed or oversized %s body while cancelling the bounded stream',async kind=>{
  const bytes=kind==='utf8'?new Uint8Array([0xff]):kind==='cap'?new Uint8Array(1024*1024+1):new TextEncoder().encode('{broken')
  const headers={'Content-Type':kind==='type'?'text/html':'application/json'}
  fetchMock.mockResolvedValueOnce(new Response(bytes,{headers}))
  await expect(previewCurrentLiquidity(currentLiquidityCapability(),'2026-10-01','2026-09-01',session.userNetUid,signal())).rejects.toThrow('непідтверджений результат')
  expect(fetchMock).toHaveBeenCalledOnce()
})
it('does not reuse a cancelled owner request when a second owner sends the identical endpoints command',async()=>{
  let release!:(value:Response)=>void;fetchMock.mockReturnValueOnce(new Promise<Response>(resolve=>{release=resolve})).mockResolvedValueOnce(response())
  const old=new AbortController(),first=previewCurrentLiquidity(currentLiquidityCapability(),'2026-10-01','2026-09-01',session.userNetUid,old.signal).catch(error=>error)
  old.abort();const next={userNetUid:'22222222-2222-2222-2222-222222222222',csrfToken:'new-owner'};saveSession(next)
  expect(await previewCurrentLiquidity(currentLiquidityCapability(),'2026-10-01','2026-09-01',next.userNetUid,signal())).toEqual(currentLiquidityReport())
  release(response());expect(await first).toMatchObject({name:'AbortError'});expect(fetchMock).toHaveBeenCalledTimes(2)
})

it('refuses a 401 refresh naming another caller instead of replaying the financial preview for it', async () => {
  fetchMock.mockResolvedValueOnce(new Response('', { status: 401 }))
    .mockResolvedValueOnce(response({ UserNetUid: '22222222-2222-2222-2222-222222222222', CsrfToken: 'another-caller' }))
  await expect(previewCurrentLiquidity(currentLiquidityCapability(),'2026-10-01','2026-09-01',session.userNetUid,signal())).rejects.toMatchObject({status:401})
  expect(fetchMock).toHaveBeenCalledTimes(2); expect(readSession()).toBeNull()
})
it('preserves the new login when the old caller changes during a deferred 401 refresh', async () => {
  let release!:(value:Response)=>void
  fetchMock.mockResolvedValueOnce(new Response('',{status:401})).mockReturnValueOnce(new Promise<Response>(resolve=>{release=resolve}))
  const pending=previewCurrentLiquidity(currentLiquidityCapability(),'2026-10-01','2026-09-01',session.userNetUid,signal()).catch(error=>error)
  await vi.waitFor(()=>expect(fetchMock).toHaveBeenCalledTimes(2))
  const next={userNetUid:'22222222-2222-2222-2222-222222222222',csrfToken:'new-login'};saveSession(next)
  release(response({UserNetUid:session.userNetUid,CsrfToken:'old-refresh'}))
  expect(await pending).toMatchObject({name:'AbortError'});expect(readSession()).toEqual(next);expect(fetchMock).toHaveBeenCalledTimes(2)
})
