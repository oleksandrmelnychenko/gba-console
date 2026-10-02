import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { clearSession, saveSession } from '../../../shared/auth/session'
import { generateSavedNativeReport, previewSavedNativeReport, type SavedNativeReportTarget } from './savedNativeReportApi'

const fetchMock = vi.fn()
const session = { userNetUid: 'caller-a', csrfToken: 'csrf-a' }
const target: SavedNativeReportTarget = { id: '11111111-1111-1111-1111-111111111111', revision: 7, dataSource: 22 }
const definition = 'a'.repeat(64), resultHash = 'b'.repeat(64)
const context = (signal = new AbortController().signal) => ({ session, signal })
function payload() {
  return { DocumentURL: '/reports/saved.xlsx', PdfDocumentURL: '/reports/saved.pdf', Preview: {
    Version: 1, RequestSha256: definition, ResultSha256: resultHash, PresentationOnly: true,
    Request: { DataSource: 'NativeAgreementProductPrices', IsCurrentSnapshot: true, HasPeriod: false },
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 1, ReturnedRows: 1, HasMore: false },
    RowSchema: [{ Caption: 'Товар' }], ColumnSchema: [{ Caption: 'Ціна' }],
    Rows: [{ Ordinal: 0, SourceIndex: 1, Values: [{ Caption: 'Товар А' }] }],
    Columns: [{ Ordinal: 0, SourceIndex: 2, Values: [{ Caption: 'Ціна' }] }],
    Cells: [{ RowSourceIndex: 1, ColumnSourceIndex: 2, Value: { Kind: 'null', Value: null, Provenance: 'producerCell' } }],
  } }
}
function headers() {
  return { 'Content-Type': 'application/json', 'Gba-Report-Template-Id': target.id,
    'Gba-Report-Template-Revision': '7', 'Gba-Report-Definition-Sha256': definition,
    'Gba-Report-Request-Sha256': definition, 'Gba-Report-Result-Sha256': resultHash }
}
function response(body = payload(), overrides: Record<string, string> = {}) {
  return new Response(JSON.stringify({ Body: body }), { headers: { ...headers(), ...overrides } })
}

beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); saveSession(session) })
afterEach(() => { clearSession(); vi.unstubAllGlobals() })

it('returns bound preview and both files from one saved-revision response without a replacement body', async () => {
  fetchMock.mockResolvedValueOnce(response())
  const original = { ...target, replacement: { valuationClientAgreementId: 999 } }
  const observed = await previewSavedNativeReport(original, context())
  expect(observed.binding).toEqual({ id: target.id, revision: 7, definitionSha256: definition })
  expect(observed.result.document).toEqual({ DocumentURL: '/reports/saved.xlsx', PdfDocumentURL: '/reports/saved.pdf' })
  expect(observed.preview?.Cells[0].Value.Value).toBeNull()
  expect(fetchMock).toHaveBeenCalledOnce()
  const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
  expect(new URL(url).pathname).toBe(`/api/v1/uk/report/templates/${target.id}/revisions/7/preview`)
  expect(new URL(url).search).toBe('?rowOffset=0&rowLimit=50')
  expect(options.body).toBeUndefined()
  expect(options).toMatchObject({ method: 'POST', cache: 'no-store', credentials: 'include' })
  expect(new Headers(options.headers).get('X-CSRF-Token')).toBe(session.csrfToken)
})

it('generates files at the exact revision and rejects a definition changed since the accepted preview', async () => {
  fetchMock.mockResolvedValueOnce(response())
  const observed = await generateSavedNativeReport({ ...target, expectedDefinitionSha256: definition }, context())
  expect(observed.preview).toBeUndefined()
  expect(observed.result.document.PdfDocumentURL).toBe('/reports/saved.pdf')
  expect(new URL(fetchMock.mock.calls[0][0]).pathname).toMatch(/\/revisions\/7\/generate$/)
  expect(fetchMock.mock.calls[0][1].body).toBeUndefined()
  fetchMock.mockResolvedValueOnce(response(payload(), { 'Gba-Report-Definition-Sha256': 'c'.repeat(64) }))
  await expect(generateSavedNativeReport({ ...target, expectedDefinitionSha256: definition }, context())).rejects.toThrow(/іншого збереженого/)
})

const invalidHeaders: Record<string, string>[] = [
  { 'Gba-Report-Template-Id': '22222222-2222-2222-2222-222222222222' },
  { 'Gba-Report-Template-Revision': '8' },
  { 'Gba-Report-Template-Revision': '07' },
  { 'Gba-Report-Definition-Sha256': '' },
  { 'Gba-Report-Request-Sha256': 'c'.repeat(64) },
  { 'Gba-Report-Result-Sha256': 'c'.repeat(64) },
]
it.each(invalidHeaders)('rejects inconsistent revision/hash headers before exposing preview or files %#', async override => {
  fetchMock.mockResolvedValueOnce(response(payload(), override))
  await expect(previewSavedNativeReport(target, context())).rejects.toThrow(/іншого збереженого/)
  expect(fetchMock).toHaveBeenCalledOnce()
})

it.each(['request-hash', 'dataset', 'cell-coordinate', 'page'])('rejects an inconsistent %s payload with valid headers', async kind => {
  const body = payload()
  if (kind === 'request-hash') body.Preview.RequestSha256 = 'c'.repeat(64)
  else if (kind === 'dataset') body.Preview.Request.DataSource = 'NativeStockAgreementValuation'
  else if (kind === 'cell-coordinate') body.Preview.Cells[0].ColumnSourceIndex = 999
  else body.Preview.Page.Limit = 25
  fetchMock.mockResolvedValueOnce(response(body))
  await expect(previewSavedNativeReport(target, context())).rejects.toThrow()
})

it('rejects stale server revisions without falling back to a draft report route', async () => {
  fetchMock.mockResolvedValueOnce(new Response('', { status: 409 }))
  await expect(previewSavedNativeReport(target, context())).rejects.toMatchObject({ status: 409 })
  expect(fetchMock).toHaveBeenCalledOnce()
  expect(new URL(fetchMock.mock.calls[0][0]).pathname).not.toContain('/stocks/')
})

it.each([
  { ...target, revision: 0 }, { ...target, revision: 2147483648 }, { ...target, id: '../other' },
  { ...target, dataSource: 1 }, { ...target, expectedDefinitionSha256: 'invalid' },
])('refuses invalid or enum-only targets before network access %#', async invalid => {
  await expect(previewSavedNativeReport(invalid, context())).rejects.toThrow()
  expect(fetchMock).not.toHaveBeenCalled()
})

it('captures the chosen revision before the caller mutates its object during a deferred fetch', async () => {
  let release!: (value: Response) => void
  fetchMock.mockReturnValueOnce(new Promise<Response>(resolve => { release = resolve }))
  const mutable = { ...target }, pending = previewSavedNativeReport(mutable, context())
  mutable.revision = 8
  release(response())
  expect((await pending).binding.revision).toBe(7)
})

it('rejects an old caller response while allowing the new caller to read the same saved route', async () => {
  const releases: ((value: Response) => void)[] = []
  fetchMock.mockImplementation(() => new Promise<Response>(resolve => { releases.push(resolve) }))
  const old = previewSavedNativeReport(target, context()).then(() => 'unexpected', cause => cause)
  const nextSession = { userNetUid: 'caller-b', csrfToken: 'csrf-b' }
  saveSession(nextSession)
  const next = previewSavedNativeReport(target, { session: nextSession, signal: new AbortController().signal })
  releases[1](response())
  expect((await next).binding.revision).toBe(7)
  releases[0](response())
  expect(await old).toMatchObject({ name: 'AbortError' })
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it('rejects a response if authentication changes after headers while its body is being read', async () => {
  let stream!: ReadableStreamDefaultController<Uint8Array>
  fetchMock.mockResolvedValueOnce(new Response(new ReadableStream<Uint8Array>({ start(value) { stream = value } }), { headers: headers() }))
  const pending = previewSavedNativeReport(target, context())
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
  saveSession({ ...session, csrfToken: 'new-login' })
  stream.enqueue(new TextEncoder().encode(JSON.stringify({ Body: payload() }))); stream.close()
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
})

it('cancels a pending body and never returns partial files after abort', async () => {
  const cancel = vi.fn(), abort = new AbortController()
  fetchMock.mockResolvedValueOnce(new Response(new ReadableStream({ cancel }), { headers: headers() }))
  const pending = previewSavedNativeReport(target, context(abort.signal))
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
  abort.abort()
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  expect(cancel).toHaveBeenCalledOnce()
})
