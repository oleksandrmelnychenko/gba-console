import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { clearSession, saveSession } from '../../../shared/auth/session'
import { getReportTemplateOrderState, orderReportTemplates } from './reportTemplateOrderApi'

const fetchMock = vi.fn(), session = { userNetUid: 'caller-a', csrfToken: 'csrf-a' }
const id = '11111111-1111-1111-1111-111111111111'
const state = (revision = 9) => ({ ListRevision: revision, Items: [{ Id: id, Name: 'Мій шаблон', Revision: 3, DisplayOrder: 1 }] })
const context = (signal = new AbortController().signal) => ({ session, signal })
const response = (body = JSON.stringify({ Body: state() })) => new Response(body, { headers: { 'Content-Type': 'application/json' } })
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); saveSession(session) })
afterEach(() => { clearSession(); vi.unstubAllGlobals() })

it('reads an uncached bounded authoritative list with the captured caller', async () => {
  fetchMock.mockResolvedValueOnce(response())
  expect(await getReportTemplateOrderState(context())).toEqual(state())
  const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
  expect(new URL(url).pathname).toBe('/api/v1/uk/report/templates/order-state')
  expect(options).toMatchObject({ method: 'GET', cache: 'no-store', credentials: 'include', redirect: 'error' })
  expect(options.body).toBeUndefined()
})

it('posts a command exactly once and accepts the server increment for an accepted no-op', async () => {
  fetchMock.mockResolvedValueOnce(response(JSON.stringify({ Body: state(10) })))
  expect(await orderReportTemplates({ Operation: 'move_up', Id: id }, 9, context())).toEqual(state(10))
  const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
  expect(new URL(url).pathname).toBe('/api/v1/uk/report/templates/order')
  expect(JSON.parse(options.body as string)).toEqual({ Operation: 'move_up', Id: id, Position: null, ExpectedListRevision: 9 })
  expect(new Headers(options.headers).get('X-CSRF-Token')).toBe(session.csrfToken)
  expect(fetchMock).toHaveBeenCalledOnce()
})

it('accepts an empty sort response only at the next server list revision', async () => {
  fetchMock.mockResolvedValueOnce(response('{"Body":{"ListRevision":1,"Items":[]}}'))
  expect(await orderReportTemplates({ Operation: 'sort_name_desc' }, 0, context())).toEqual({ ListRevision: 1, Items: [] })
})

it.each([9, 11])('rejects an accepted response with the wrong list revision %s without retrying the mutation', async revision => {
  fetchMock.mockResolvedValueOnce(response(JSON.stringify({ Body: state(revision) })))
  await expect(orderReportTemplates({ Operation: 'sort_name_asc' }, 9, context())).rejects.toThrow(/Оновіть/)
  expect(fetchMock).toHaveBeenCalledOnce()
})

it('refuses an unsafe next revision before fetching', async () => {
  await expect(orderReportTemplates({ Operation: 'sort_name_asc' }, Number.MAX_SAFE_INTEGER, context())).rejects.toThrow(/Оновіть/)
  expect(fetchMock).not.toHaveBeenCalled()
})

it.each([
  '{"ListRevision":9007199254740992,"Items":[]}',
  '{"ListRevision":1.00000000000000001,"Items":[]}',
  '{"ListRevision":1e0,"Items":[]}',
  '{"ListRevision":0,"ListRevision":1,"Items":[]}',
  '{"ListRevision":0,"Items":[]}\u00a0',
  '{"ListRevision":0,"Items":[],}',
  '{"ListRevision":0,"Items":[],"Name":"\\uZZZZ"}',
  '{"Body":{"ListRevision":0,"Items":[]},"Body":{"ListRevision":1,"Items":[]}}',
])('rejects malformed, duplicate, non-JSON or rounding-prone metadata %# with a plain recovery message', async text => {
  fetchMock.mockResolvedValueOnce(response(text))
  await expect(getReportTemplateOrderState(context())).rejects.toThrow(/^Список шаблонів/)
})

it('rejects invalid UTF-8 with the same plain recovery message', async () => {
  fetchMock.mockResolvedValueOnce(new Response(new Uint8Array([0xc3, 0x28]), { headers: { 'Content-Type': 'application/json' } }))
  await expect(getReportTemplateOrderState(context())).rejects.toThrow(/^Список шаблонів/)
})

it('accepts 200 distinct maximum-length Unicode names without truncation', async () => {
  const Items = Array.from({ length: 200 }, (_, index) => ({ Id: `${(index + 1).toString(16).padStart(8, '0')}-1111-1111-1111-111111111111`,
    Name: 'я'.repeat(120), Revision: 1, DisplayOrder: index + 1 }))
  fetchMock.mockResolvedValueOnce(response(JSON.stringify({ Body: { ListRevision: 0, Items } })))
  expect((await getReportTemplateOrderState(context())).Items).toEqual(Items)
})

it('caps streamed metadata bytes and cancels the body', async () => {
  const cancel = vi.fn()
  fetchMock.mockResolvedValueOnce(new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(256 * 1024 + 1)) }, cancel }), { headers: { 'Content-Type': 'application/json' } }))
  await expect(getReportTemplateOrderState(context())).rejects.toThrow(/^Список шаблонів/)
  expect(cancel).toHaveBeenCalledOnce()
})

it('keeps a conflict as one POST without an automatic write retry', async () => {
  fetchMock.mockResolvedValueOnce(new Response('', { status: 409 }))
  await expect(orderReportTemplates({ Operation: 'sort_name_asc' }, 9, context())).rejects.toMatchObject({ status: 409 })
  expect(fetchMock).toHaveBeenCalledOnce()
})

it('preserves the command and revision through a legitimate same-owner 401 session refresh', async () => {
  fetchMock.mockResolvedValueOnce(new Response('', { status: 401 }))
    .mockResolvedValueOnce(response(JSON.stringify({ Body: { UserNetUid: session.userNetUid, CsrfToken: 'refreshed' } })))
    .mockResolvedValueOnce(response(JSON.stringify({ Body: state(10) })))
  expect(await orderReportTemplates({ Operation: 'sort_name_asc' }, 9, context())).toEqual(state(10))
  const orderCalls = fetchMock.mock.calls.filter(([url]) => new URL(url).pathname.endsWith('/report/templates/order'))
  expect(orderCalls).toHaveLength(2)
  expect(orderCalls[0][1].body).toBe(orderCalls[1][1].body)
  expect(new Headers(orderCalls[1][1].headers).get('X-CSRF-Token')).toBe('refreshed')
  expect(fetchMock).toHaveBeenCalledTimes(3)
})

it('does not join identical mutations across callers and rejects the previous caller response', async () => {
  const releases: ((value: Response) => void)[] = []
  fetchMock.mockImplementation(() => new Promise<Response>(resolve => { releases.push(resolve) }))
  const old = orderReportTemplates({ Operation: 'sort_name_asc' }, 9, context()).then(() => 'unexpected', error => error)
  const nextSession = { userNetUid: 'caller-b', csrfToken: 'csrf-b' }
  saveSession(nextSession)
  const next = orderReportTemplates({ Operation: 'sort_name_asc' }, 9, { session: nextSession, signal: new AbortController().signal })
  releases[1](response(JSON.stringify({ Body: state(10) }))); expect(await next).toEqual(state(10))
  releases[0](response(JSON.stringify({ Body: state(10) }))); expect(await old).toMatchObject({ name: 'AbortError' })
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it('rejects a changed session during body reads without exposing stale metadata', async () => {
  let stream!: ReadableStreamDefaultController<Uint8Array>
  fetchMock.mockResolvedValueOnce(new Response(new ReadableStream<Uint8Array>({ start(controller) { stream = controller } }), { headers: { 'Content-Type': 'application/json' } }))
  const pending = getReportTemplateOrderState(context())
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
  saveSession({ ...session, csrfToken: 'new-login' })
  stream.enqueue(new TextEncoder().encode(JSON.stringify({ Body: state() }))); stream.close()
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
})

it('cancels a pending metadata stream when permission or caller cancellation aborts it', async () => {
  const abort = new AbortController(), cancel = vi.fn()
  fetchMock.mockResolvedValueOnce(new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'application/json' } }))
  const pending = getReportTemplateOrderState(context(abort.signal))
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce()); abort.abort()
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' }); expect(cancel).toHaveBeenCalledOnce()
})
