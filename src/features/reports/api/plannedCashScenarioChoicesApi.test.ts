import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { clearSession, readSession, saveSession } from '../../../shared/auth/session'
import { createPlannedCashRequest, PLANNED_CASH_FORMS } from '../data/plannedCash'
import { createPlannedCashScenarioChoicesRequest } from '../data/plannedCashScenarioChoices'
import { PLANNED_CASH_TEST_CALLER, PLANNED_CASH_TEST_CHOICE, plannedCashCapability, plannedCashChoices,
  plannedCashDdsKinds, plannedCashFilters, plannedCashReport } from '../data/plannedCash.test-fixtures'
import { getPlannedCashScenarioChoices, previewPlannedCash } from './plannedCashApi'
const fetchMock = vi.fn(), session = { userNetUid: PLANNED_CASH_TEST_CALLER, csrfToken: 'choice-csrf' }
const signal = () => new AbortController().signal
const response = (body: unknown = plannedCashChoices()) => new Response(JSON.stringify({ Body: body }), { headers: { 'Content-Type': 'application/json' } })
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); saveSession(session) })
afterEach(() => { clearSession(); vi.unstubAllGlobals() })
it.each(plannedCashDdsKinds)('POSTs scoped %s choices with CSRF and no generated report headers', async kind => {
  fetchMock.mockResolvedValueOnce(response(plannedCashChoices(kind)))
  expect(await getPlannedCashScenarioChoices(plannedCashCapability(kind), plannedCashFilters(), session.userNetUid, signal())).toEqual(plannedCashChoices(kind))
  const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
  expect(new URL(url).pathname).toBe(`/api/v1/uk/report/constructors/planned-cash/${PLANNED_CASH_FORMS[kind].Route}/scenario-choices`)
  expect(options).toMatchObject({ method: 'POST', credentials: 'include', cache: 'no-store' })
  expect(JSON.parse(options.body as string)).toEqual(createPlannedCashScenarioChoicesRequest(plannedCashCapability(kind), plannedCashFilters()))
  expect(new Headers(options.headers).get('X-CSRF-Token')).toBe(session.csrfToken); expect(fetchMock).toHaveBeenCalledOnce()
})
it.each(plannedCashDdsKinds)('POSTs %s preview with opaque selection and no browser native reference or guessed endpoint', async kind => {
  const report = plannedCashReport(kind)
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ Body: report }), { headers: { 'Content-Type': 'application/json',
    'Gba-Report-Request-Sha256': report.RequestSha256, 'Gba-Report-Result-Sha256': report.ResultSha256 } }))
  expect(await previewPlannedCash(plannedCashCapability(kind), plannedCashFilters(), session.userNetUid, signal(), PLANNED_CASH_TEST_CHOICE)).toEqual(report)
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(createPlannedCashRequest(plannedCashCapability(kind), plannedCashFilters(), PLANNED_CASH_TEST_CHOICE))
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ Scenario: null, PlanEndpoint: null, ScenarioChoiceKey: PLANNED_CASH_TEST_CHOICE })
})
it('sends only the genuine supplied continuation and retains empty-page continuation', async () => {
  const page = { ...plannedCashChoices(), Choices: [], ContinuationKey: 'genuine-next' }; fetchMock.mockResolvedValueOnce(response(page))
  expect((await getPlannedCashScenarioChoices(plannedCashCapability('DdsPayouts'), plannedCashFilters(), session.userNetUid, signal(), 'genuine-prior')).ContinuationKey).toBe('genuine-next')
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).ContinuationKey).toBe('genuine-prior')
})
it.each([403, 409, 503])('never retries a refused %s choices request', async status => {
  fetchMock.mockResolvedValueOnce(new Response('', { status }))
  await expect(getPlannedCashScenarioChoices(plannedCashCapability('DdsPayouts'), plannedCashFilters(), session.userNetUid, signal())).rejects.toMatchObject({ status })
  expect(fetchMock).toHaveBeenCalledOnce()
})
it('keeps request bytes immutable while caller code mutates the filters and capability', async () => {
  let finish!: (value: Response) => void; fetchMock.mockReturnValueOnce(new Promise<Response>(resolve => { finish = resolve }))
  const cap = plannedCashCapability('DdsPayouts'), filters = plannedCashFilters()
  const pending = getPlannedCashScenarioChoices(cap, filters, session.userNetUid, signal())
  cap.SourceIdentity.DefinitionSha256 = '0'.repeat(64); filters.PreviousFrom = '2026-07-01'; finish(response())
  expect(await pending).toEqual(plannedCashChoices())
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(createPlannedCashScenarioChoicesRequest(plannedCashCapability('DdsPayouts'), plannedCashFilters()))
})
it('allows conventional same-owner refresh with unchanged choices request and new CSRF', async () => {
  fetchMock.mockResolvedValueOnce(new Response('', { status: 401 })).mockResolvedValueOnce(response({ UserNetUid: session.userNetUid, CsrfToken: 'fresh-choice-csrf' })).mockResolvedValueOnce(response())
  await getPlannedCashScenarioChoices(plannedCashCapability('DdsPayouts'), plannedCashFilters(), session.userNetUid, signal())
  expect(fetchMock).toHaveBeenCalledTimes(3); expect(fetchMock.mock.calls[2][1].body).toBe(fetchMock.mock.calls[0][1].body)
  expect(new Headers(fetchMock.mock.calls[2][1].headers).get('X-CSRF-Token')).toBe('fresh-choice-csrf')
})
it('refuses a refresh for another owner instead of replaying their encrypted choice request', async () => {
  fetchMock.mockResolvedValueOnce(new Response('', { status: 401 })).mockResolvedValueOnce(response({ UserNetUid: 'another-owner', CsrfToken: 'other' }))
  await expect(getPlannedCashScenarioChoices(plannedCashCapability('DdsPayouts'), plannedCashFilters(), session.userNetUid, signal())).rejects.toMatchObject({ status: 401 })
  expect(fetchMock).toHaveBeenCalledTimes(2)
})
it('refuses a deferred old-owner list while preserving the new login', async () => {
  let finish!: (value: Response) => void; fetchMock.mockReturnValueOnce(new Promise<Response>(resolve => { finish = resolve }))
  const pending = getPlannedCashScenarioChoices(plannedCashCapability('DdsPayouts'), plannedCashFilters(), session.userNetUid, signal()).catch(error => error)
  const next = { userNetUid: 'another-owner', csrfToken: 'other' }; saveSession(next); finish(response())
  expect(await pending).toMatchObject({ name: 'AbortError' }); expect(readSession()).toEqual(next)
})
it('cancels an incomplete body and exposes no partial choices', async () => {
  const cancel = vi.fn(), controller = new AbortController()
  fetchMock.mockResolvedValueOnce(new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'application/json' } }))
  const pending = getPlannedCashScenarioChoices(plannedCashCapability('DdsPayouts'), plannedCashFilters(), session.userNetUid, controller.signal)
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce()); controller.abort()
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' }); expect(cancel).toHaveBeenCalledOnce()
})
it('refuses a new authentication generation while draining an otherwise valid list', async () => {
  let body!: ReadableStreamDefaultController<Uint8Array>
  fetchMock.mockResolvedValueOnce(new Response(new ReadableStream<Uint8Array>({ start(controller) { body = controller } }), { headers: { 'Content-Type': 'application/json' } }))
  const pending = getPlannedCashScenarioChoices(plannedCashCapability('DdsPayouts'), plannedCashFilters(), session.userNetUid, signal())
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce()); saveSession({ ...session, csrfToken: 'new-generation' })
  body.enqueue(new TextEncoder().encode(JSON.stringify({ Body: plannedCashChoices() }))); body.close()
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
})
it.each(['json', 'utf8', 'type', 'oversize'])('refuses %s choices transport without retry', kind => {
  const bytes = kind === 'utf8' ? new Uint8Array([0xff]) : new TextEncoder().encode(kind === 'oversize' ? ' '.repeat(2 * 1024 * 1024 + 1) : '{broken')
  fetchMock.mockResolvedValueOnce(new Response(bytes, { headers: { 'Content-Type': kind === 'type' ? 'text/html' : 'application/json' } }))
  return expect(getPlannedCashScenarioChoices(plannedCashCapability('DdsPayouts'), plannedCashFilters(), session.userNetUid, signal())).rejects.toThrow('непідтверджений результат')
})
it('refuses a different caller and dirty previous dates before HTTP', async () => {
  await expect(getPlannedCashScenarioChoices(plannedCashCapability('DdsPayouts'), plannedCashFilters(), 'another-owner', signal())).rejects.toMatchObject({ status: 401 })
  await expect(getPlannedCashScenarioChoices(plannedCashCapability('DdsPayouts'), { ...plannedCashFilters(), PreviousFrom: '2026-02-30' }, session.userNetUid, signal())).rejects.toThrow('попереднього періоду')
  expect(fetchMock).not.toHaveBeenCalled()
})
