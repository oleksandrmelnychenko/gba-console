import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { clearSession, readSession, saveSession } from '../../../shared/auth/session'
import { CASH_MOVEMENT_DEFINITIONS, createCashMovementRequest } from '../data/cashMovement'
import { createCashMovementArticleChoicesRequest } from '../data/cashMovementArticleChoices'
import { CASH_MOVEMENT_TEST_ARTICLE, CASH_MOVEMENT_TEST_CALLER, cashMovementArticleChoices, cashMovementCapability, cashMovementFilteredReport } from '../data/cashMovement.test-fixtures'
import { getCashMovementArticleChoices, previewCashMovement } from './cashMovementApi'
const fetchMock = vi.fn(), session = { userNetUid: CASH_MOVEMENT_TEST_CALLER, csrfToken: 'article-csrf' }
const signal = () => new AbortController().signal
const response = (body: unknown = cashMovementArticleChoices(), headers: Record<string, string> = {}) => new Response(JSON.stringify({ Body: body }), { headers: { 'Content-Type': 'application/json', ...headers } })
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); saveSession(session) })
afterEach(() => { clearSession(); vi.unstubAllGlobals() })
it.each(['receipts', 'payouts'] as const)('posts exact %s article choices and CSRF without generated report hash headers', async kind => {
  const page = cashMovementArticleChoices(kind); fetchMock.mockResolvedValueOnce(response(page))
  expect(await getCashMovementArticleChoices(cashMovementCapability(kind), page.Period, session.userNetUid, signal())).toEqual(page)
  const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
  expect(new URL(url).pathname).toBe(`/api/v1/uk${CASH_MOVEMENT_DEFINITIONS[kind].Route}/article-choices`)
  expect(options).toMatchObject({ method: 'POST', credentials: 'include', cache: 'no-store' })
  expect(JSON.parse(options.body as string)).toEqual(createCashMovementArticleChoicesRequest(cashMovementCapability(kind), page.Period))
  expect(new Headers(options.headers).get('X-CSRF-Token')).toBe(session.csrfToken); expect(fetchMock).toHaveBeenCalledOnce()
})
it.each(['receipts', 'payouts'] as const)('posts %s selected preview with only its opaque key and binds both same-run headers', async kind => {
  const report = cashMovementFilteredReport(kind)
  fetchMock.mockResolvedValueOnce(response(report, { 'Gba-Report-Request-Sha256': report.RequestSha256, 'Gba-Report-Result-Sha256': report.ResultSha256 }))
  expect(await previewCashMovement(cashMovementCapability(kind), report.Period, session.userNetUid, signal(), CASH_MOVEMENT_TEST_ARTICLE)).toEqual(report)
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(createCashMovementRequest(cashMovementCapability(kind), report.Period, CASH_MOVEMENT_TEST_ARTICLE))
  expect(Object.keys(JSON.parse(fetchMock.mock.calls[0][1].body))).toEqual(['Version', 'SourceIdentity', 'Period', 'ArticleChoiceKey'])
})
it('uses only a genuine continuation and retains empty-page pagination', async () => {
  const page = { ...cashMovementArticleChoices(), Choices: [], ContinuationKey: 'protected-next' }; fetchMock.mockResolvedValueOnce(response(page))
  expect((await getCashMovementArticleChoices(cashMovementCapability(), page.Period, session.userNetUid, signal(), 'protected-prior')).ContinuationKey).toBe('protected-next')
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).ContinuationKey).toBe('protected-prior')
})
it.each([403, 409, 503])('does not retry a refused %s list', async status => {
  fetchMock.mockResolvedValueOnce(new Response('', { status }))
  await expect(getCashMovementArticleChoices(cashMovementCapability(), '2026-Q3', session.userNetUid, signal())).rejects.toMatchObject({ status })
  expect(fetchMock).toHaveBeenCalledOnce()
})
it.each([409, 503])('does not retry refused or ambiguous %s filtered preview', async status => {
  fetchMock.mockResolvedValueOnce(new Response('', { status }))
  await expect(previewCashMovement(cashMovementCapability(), '2026-Q3', session.userNetUid, signal(), CASH_MOVEMENT_TEST_ARTICLE)).rejects.toMatchObject({ status })
  expect(fetchMock).toHaveBeenCalledOnce()
})
it.each(['Gba-Report-Request-Sha256', 'Gba-Report-Result-Sha256'])('refuses mismatched %s before returning files', async header => {
  const report = cashMovementFilteredReport()
  fetchMock.mockResolvedValueOnce(response(report, { 'Gba-Report-Request-Sha256': report.RequestSha256, 'Gba-Report-Result-Sha256': report.ResultSha256, [header]: '0'.repeat(64) }))
  await expect(previewCashMovement(cashMovementCapability(), report.Period, session.userNetUid, signal(), CASH_MOVEMENT_TEST_ARTICLE)).rejects.toThrow('непідтверджений список')
})
it('captures immutable request identity before caller code changes the capability', async () => {
  let finish!: (value: Response) => void; fetchMock.mockReturnValueOnce(new Promise<Response>(done => { finish = done }))
  const capability = cashMovementCapability(), pending = getCashMovementArticleChoices(capability, '2026-Q3', session.userNetUid, signal())
  Object.assign(capability.SourceIdentity, { DefinitionSha256: '0'.repeat(64) }); finish(response())
  expect(await pending).toEqual(cashMovementArticleChoices())
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(createCashMovementArticleChoicesRequest(cashMovementCapability(), '2026-Q3'))
})
it('allows same-owner 401 refresh with unchanged article command and fresh CSRF', async () => {
  fetchMock.mockResolvedValueOnce(new Response('', { status: 401 })).mockResolvedValueOnce(response({ UserNetUid: session.userNetUid, CsrfToken: 'new-article-csrf' })).mockResolvedValueOnce(response())
  await getCashMovementArticleChoices(cashMovementCapability(), '2026-Q3', session.userNetUid, signal())
  expect(fetchMock).toHaveBeenCalledTimes(3); expect(fetchMock.mock.calls[2][1].body).toBe(fetchMock.mock.calls[0][1].body)
  expect(new Headers(fetchMock.mock.calls[2][1].headers).get('X-CSRF-Token')).toBe('new-article-csrf')
})
it('refuses another refresh owner without replaying their article command', async () => {
  fetchMock.mockResolvedValueOnce(new Response('', { status: 401 })).mockResolvedValueOnce(response({ UserNetUid: 'other-owner', CsrfToken: 'other' }))
  await expect(getCashMovementArticleChoices(cashMovementCapability(), '2026-Q3', session.userNetUid, signal())).rejects.toMatchObject({ status: 401 })
  expect(fetchMock).toHaveBeenCalledTimes(2)
})
it('refuses a deferred old caller list without altering their newer login', async () => {
  let finish!: (value: Response) => void; fetchMock.mockReturnValueOnce(new Promise<Response>(done => { finish = done }))
  const pending = getCashMovementArticleChoices(cashMovementCapability(), '2026-Q3', session.userNetUid, signal()).catch(error => error)
  const next = { userNetUid: 'other-owner', csrfToken: 'other' }; saveSession(next); finish(response())
  expect(await pending).toMatchObject({ name: 'AbortError' }); expect(readSession()).toEqual(next)
})
it('refuses a new session generation while draining selected financial values', async () => {
  let body!: ReadableStreamDefaultController<Uint8Array>
  const report = cashMovementFilteredReport()
  fetchMock.mockResolvedValueOnce(new Response(new ReadableStream<Uint8Array>({ start(controller) { body = controller } }), { headers: { 'Content-Type': 'application/json',
    'Gba-Report-Request-Sha256': report.RequestSha256, 'Gba-Report-Result-Sha256': report.ResultSha256 } }))
  const pending = previewCashMovement(cashMovementCapability(), report.Period, session.userNetUid, signal(), CASH_MOVEMENT_TEST_ARTICLE)
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce()); saveSession({ ...session, csrfToken: 'new-generation' })
  body.enqueue(new TextEncoder().encode(JSON.stringify({ Body: report }))); body.close()
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
})
it('cancels incomplete list transport without publishing a partial choice', async () => {
  const cancel = vi.fn(), controller = new AbortController()
  fetchMock.mockResolvedValueOnce(new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'application/json' } }))
  const pending = getCashMovementArticleChoices(cashMovementCapability(), '2026-Q3', session.userNetUid, controller.signal)
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce()); controller.abort()
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' }); expect(cancel).toHaveBeenCalledOnce()
})
it.each(['json', 'utf8', 'type', 'oversize'])('refuses malformed %s choices transport without retry', async kind => {
  const bytes = kind === 'utf8' ? new Uint8Array([0xff]) : new TextEncoder().encode(kind === 'oversize' ? ' '.repeat(2 * 1024 * 1024 + 1) : '{bad')
  fetchMock.mockResolvedValueOnce(new Response(bytes, { headers: { 'Content-Type': kind === 'type' ? 'text/html' : 'application/json' } }))
  await expect(getCashMovementArticleChoices(cashMovementCapability(), '2026-Q3', session.userNetUid, signal())).rejects.toThrow('непідтверджений список')
  expect(fetchMock).toHaveBeenCalledOnce()
})
it('rejects wrong caller, dirty period and malformed selection before HTTP', async () => {
  await expect(getCashMovementArticleChoices(cashMovementCapability(), '2026-Q3', 'other-owner', signal())).rejects.toMatchObject({ status: 401 })
  await expect(getCashMovementArticleChoices(cashMovementCapability(), '2026-09', session.userNetUid, signal())).rejects.toThrow('допустимий')
  await expect(previewCashMovement(cashMovementCapability(), '2026-Q3', session.userNetUid, signal(), 'bad\n')).rejects.toThrow()
  expect(fetchMock).not.toHaveBeenCalled()
})
