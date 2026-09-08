import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { decodeRegisterPublications, REGISTER_CATALOGUE_BYTES } from './publicationCatalogue'
import { generateRegisterStatement, getRegisterSchema, listRegisterPublications } from './registerReportsApi'
import { serializeRegisterQuery } from './query'
import { saveSession } from '../../shared/auth/session'
import type { SourceRegisterQueryWire, SourceRegisterResultWire } from './types'
import catalogueText from './fixtures/runtime-catalogue.json?raw'
import schemaText from './fixtures/runtime-schema.json?raw'
import queryText from './fixtures/runtime-query.json?raw'
import statementText from './fixtures/runtime-statement.json?raw'

const encode = (text: string) => new TextEncoder().encode(text)
const response = (text: string) => new Response(text, { headers: { 'Content-Type': 'application/json; charset=utf-8' } })
const session = { userNetUid: '11111111-1111-1111-1111-111111111111', csrfToken: 'test-csrf' }
const context = () => ({ session, signal: new AbortController().signal })
const fetchMock = vi.fn()
beforeEach(async () => { saveSession(session); fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); vi.stubGlobal('crypto', (await vi.importActual<{ webcrypto: Crypto }>('node:crypto')).webcrypto) })
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear() })

it('roundtrips actual application-service catalogue/schema/query/statement through authenticated raw streams', async () => {
  fetchMock.mockResolvedValueOnce(response(catalogueText)).mockResolvedValueOnce(response(schemaText)).mockResolvedValueOnce(response(statementText))
  const publications = await listRegisterPublications(context()), publication = publications[0]
  expect(publication.revision).toBe('9007199254740993')
  const descriptor = await getRegisterSchema(publication, context()), query = JSON.parse(queryText) as SourceRegisterQueryWire
  const result = await generateRegisterStatement(publication, descriptor, query, context())
  expect(result).toEqual(JSON.parse(statementText) as SourceRegisterResultWire)
  expect(fetchMock.mock.calls.map(([url]) => new URL(url).pathname)).toEqual([
    '/api/v1/uk/report/generalized/publications',
    `/api/v1/uk/report/generalized/publications/${publication.publicationId}/schema`,
    `/api/v1/uk/report/generalized/publications/${publication.publicationId}/statement`,
  ])
  const body = fetchMock.mock.calls[2][1].body as string
  expect(body).toBe(serializeRegisterQuery(query, descriptor))
  expect(body).not.toContain('authorizationVersion'); expect(body).not.toContain('expectedPublication'); expect(body).not.toContain('complete')
})

it('rejects forged expected schema bytes and query/publication schema mismatch', async () => {
  const [publication] = await decodeRegisterPublications(encode(catalogueText))
  fetchMock.mockResolvedValueOnce(response(schemaText))
  await expect(getRegisterSchema({ ...publication, schemaPayloadSha256: 'f'.repeat(64) }, context())).rejects.toThrow(/binding/)
  fetchMock.mockResolvedValueOnce(response(schemaText))
  const descriptor = await getRegisterSchema(publication, context()), query = JSON.parse(queryText) as SourceRegisterQueryWire
  const before = fetchMock.mock.calls.length
  await expect(generateRegisterStatement(publication, { ...descriptor, schema: { ...descriptor.schema, world: 'wrong' } }, query, context())).rejects.toThrow()
  expect(fetchMock.mock.calls).toHaveLength(before)
  await expect(generateRegisterStatement(publication, descriptor, { ...query, from: '2026-03-01T00:00:00.0000000' }, context())).rejects.toThrow()
  expect(fetchMock.mock.calls).toHaveLength(before)
})

it('never returns decoded data after the session changes while a response body is being read', async () => {
  let streamController!: ReadableStreamDefaultController<Uint8Array>
  const stream = new ReadableStream<Uint8Array>({ start(controller) { streamController = controller } })
  fetchMock.mockResolvedValue(new Response(stream, { headers: { 'Content-Type': 'application/json' } }))
  const pending = listRegisterPublications(context())
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
  saveSession({ ...session, csrfToken: 'fresh-login' })
  streamController.enqueue(encode(catalogueText)); streamController.close()
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
})

it('aborts a bounded response reader after headers without a partial catalogue', async () => {
  const cancel = vi.fn(), controller = new AbortController()
  fetchMock.mockResolvedValue(new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'application/json' } }))
  const pending = listRegisterPublications({ session, signal: controller.signal })
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce()); controller.abort()
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' }); expect(cancel).toHaveBeenCalledOnce()
})

it('accepts a complete empty catalogue and rejects duplicate/escaped IDs, numeric revisions and incoherent metadata', async () => {
  expect(await decodeRegisterPublications(encode('{"version":1,"kind":"register-publications","items":[]}'))).toEqual([])
  const original = JSON.parse(catalogueText), item = original.items[0]
  for (const text of [
    catalogueText.replace('"items":', '"items":[],"\\u0069tems":'),
    catalogueText.replace('"revision":"9007199254740993"', '"revision":9007199254740993'),
    JSON.stringify({ ...original, items: [item, item] }),
    JSON.stringify({ ...original, items: [{ ...item, revision: '9007199254740994' }] }),
    JSON.stringify({ ...original, items: [{ ...item, coverageStart: '2026-04-02T00:00:00.0000000' }] }),
    JSON.stringify({ ...original, items: [{ ...item, caption: 'hidden\ncontrol' }] }),
    JSON.stringify({ ...original, items: [{ ...item, sourceParityVerified: true }] }),
  ]) await expect(decodeRegisterPublications(encode(text))).rejects.toThrow()
})

it('enforces the4096-item and16MiB catalogue limits without truncating', async () => {
  const item = JSON.parse(catalogueText).items[0]
  const items = Array.from({ length: 4096 }, (_, index) => ({ ...item, publicationId: `22222222-2222-2222-2222-${(index + 1).toString(16).padStart(12, '0')}` }))
  expect(await decodeRegisterPublications(encode(JSON.stringify({ version: 1, kind: 'register-publications', items })))).toHaveLength(4096)
  items.push({ ...item, publicationId: '33333333-3333-3333-3333-333333333333' })
  await expect(decodeRegisterPublications(encode(JSON.stringify({ version: 1, kind: 'register-publications', items })))).rejects.toThrow(/budget/)
  await expect(decodeRegisterPublications(new Uint8Array(REGISTER_CATALOGUE_BYTES + 1))).rejects.toThrow(/bytes/)
}, 20000)
