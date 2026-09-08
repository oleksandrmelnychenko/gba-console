import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { BoundedJsonDocument, readBoundedRegisterBytes } from './rawJson'
import { decodeRegisterQuery, decodeRegisterSchema, decodeRegisterStatement, REGISTER_JSON_BYTES } from './registerJsonTransport'
import { createRegisterGroupValidator, REGISTER_STAGES, validateRegisterResult } from './validation'
import { testDescriptor, testQuery, testResult } from './registerReports.test-fixtures'
import type { SourceRegisterResultWire } from './types'

const encode = (text: string) => new TextEncoder().encode(text)
const bytes = (value: unknown) => encode(JSON.stringify(value))
const statement = (result = testResult(), descriptor = testDescriptor()) => decodeRegisterStatement(bytes(result), descriptor, result)
const hash = async (value: Uint8Array<ArrayBuffer>) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', value)), item => item.toString(16).padStart(2, '0')).join('')
beforeAll(async () => {
  // Real platform SHA256, not a digest mock; jsdom's Crypto omits SubtleCrypto.
  vi.stubGlobal('crypto', (await vi.importActual<{ webcrypto: Crypto }>('node:crypto')).webcrypto)
})
afterAll(() => vi.unstubAllGlobals())

describe('original JSON lexical boundary', () => {
  it.each([
    ['BOM', new Uint8Array([0xef, 0xbb, 0xbf, 0x7b, 0x7d])],
    ['overlong UTF8', new Uint8Array([0x22, 0xc0, 0xaf, 0x22])],
    ['surrogate UTF8', new Uint8Array([0x22, 0xed, 0xa0, 0x80, 0x22])],
    ['truncated UTF8', new Uint8Array([0x22, 0xf0, 0x9f, 0x98])],
    ['out-of-range UTF8', new Uint8Array([0x22, 0xf4, 0x90, 0x80, 0x80, 0x22])],
  ])('rejects %s before parsing objects', (_name, value) => expect(() => new BoundedJsonDocument(value)).toThrow())
  it.each(['{"x":"a","x":"b"}', '{"x":"a","\\u0078":"b"}', '{"x":{"kind":"Null","k\\u0069nd":"Undefined"}}', '{"__proto__":"a","\\u005f_proto__":"b"}'])('rejects decoded duplicate members: %s', text => {
    expect(() => new BoundedJsonDocument(encode(text))).toThrow(/duplicate/)
  })
  it.each(['{}{}', '{} null', '{"x":true,}', '[true,]', '/*x*/{}', '{"x":NaN}', '{"x":Infinity}', '{"x":"\\ud800"}', '{"x":"\\udc00"}', '{"x":"\\ud800a"}', '{"x":"a\nb"}', '{"x":"\\v"}', '[1]', '{"version":1.0}', '{"version":1e0}', '{"version":01}', '{"coefficient":9007199254740993}'])('rejects invalid syntax or numeric token: %s', text => {
    expect(() => new BoundedJsonDocument(encode(text))).toThrow()
  })
  it('allows depth16 but rejects17 and limits decoded names/strings before object materialization', () => {
    expect(() => new BoundedJsonDocument(encode('['.repeat(16) + 'null' + ']'.repeat(16)))).not.toThrow()
    expect(() => new BoundedJsonDocument(encode('['.repeat(17) + 'null' + ']'.repeat(17)))).toThrow(/depth/)
    expect(() => new BoundedJsonDocument(bytes({ ['a'.repeat(129)]: 'x' }))).toThrow(/string/)
    expect(() => new BoundedJsonDocument(bytes({ x: 'a'.repeat(4097) }))).toThrow(/string/)
    expect(() => new BoundedJsonDocument(encode('{"x":"' + '\\u0061'.repeat(4097) + '"}'))).toThrow(/string/)
  })
  it('preserves escaped aliases, exact Unicode and multibyte sequences crossing each 4096-byte decoder boundary', () => {
    for (let offset = 0; offset < 4; offset++) {
      const text = ' '.repeat(4094 + offset) + '{"\\u0078":"😀éé<&> \\ud83d\\ude00"}'
      const document = new BoundedJsonDocument(encode(text))
      expect(document.materialize(document.root, 1000)).toEqual({ x: '😀éé<&> 😀' })
    }
  })
})

describe('owned bounded byte and stream input', () => {
  it('pins exact serving defaults and hard ceilings', () => {
    expect(REGISTER_JSON_BYTES).toEqual({ schema: 2097152, query: 131072, metadata: 16384, statement: 33554432, statementHardMaximum: 536870912 })
  })
  it('rejects empty/oversized input and invalid configured ceilings before copying', async () => {
    for (const maximumBytes of [0, -1, 1.5, Infinity, 101]) await expect(readBoundedRegisterBytes(bytes({}), 100, 100, { maximumBytes })).rejects.toThrow(/bytes/)
    await expect(readBoundedRegisterBytes(new Uint8Array(), 2, 2)).rejects.toThrow(/bytes/)
    await expect(readBoundedRegisterBytes(encode('{} '), 2, 2)).rejects.toThrow(/bytes/)
    const input = encode('{}'), output = await readBoundedRegisterBytes(input, 2, 2)
    input.fill(0)
    expect(new TextDecoder().decode(output)).toBe('{}')
  })
  it('checks split streams at the exact bound, snapshots reused chunks and cancels overflow', async () => {
    const stream = new ReadableStream<Uint8Array>({ start(controller) { for (const char of '{}') controller.enqueue(encode(char)); controller.close() } })
    expect(Array.from(await readBoundedRegisterBytes(stream, 2, 2))).toEqual([123, 125])
    const cancelled = vi.fn()
    const excessive = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(encode('{}')); controller.enqueue(encode(' ')) }, cancel: cancelled })
    await expect(readBoundedRegisterBytes(excessive, 2, 2)).rejects.toThrow(/bytes/)
    expect(cancelled).toHaveBeenCalledOnce()
    expect(excessive.locked).toBe(false)
    const reused = new Uint8Array(1)
    let turn = 0
    const producer = new ReadableStream<Uint8Array>({ pull(controller) {
      if (turn === 2) { controller.close(); return }
      reused[0] = turn++ === 0 ? 123 : 125
      controller.enqueue(reused)
    } }, { highWaterMark: 0 })
    expect(Array.from(await readBoundedRegisterBytes(producer, 2, 2))).toEqual([123, 125])
  })
  it('cancels a pending stream read and honors an already aborted request', async () => {
    const controller = new AbortController(), cancelled = vi.fn()
    const stream = new ReadableStream<Uint8Array>({ cancel: cancelled })
    const pending = readBoundedRegisterBytes(stream, 10, 10, { signal: controller.signal })
    controller.abort()
    await expect(pending).rejects.toThrow()
    expect(cancelled).toHaveBeenCalledOnce()
    expect(stream.locked).toBe(false)
    await expect(readBoundedRegisterBytes(encode('{}'), 10, 10, { signal: controller.signal })).rejects.toThrow()
  })
  it('enforces the real32MiB default without scanning an oversized response', async () => {
    const result = testResult()
    await expect(decodeRegisterStatement(new Uint8Array(REGISTER_JSON_BYTES.statement + 1), testDescriptor(), result)).rejects.toThrow(/bytes/)
    await expect(decodeRegisterStatement(bytes(result), testDescriptor(), result, { maximumBytes: REGISTER_JSON_BYTES.statementHardMaximum + 1 })).rejects.toThrow(/bytes/)
    await expect(decodeRegisterQuery(new Uint8Array(REGISTER_JSON_BYTES.query + 1), testDescriptor())).rejects.toThrow(/bytes/)
  })
})

describe('independent expected schema and statement bindings', () => {
  it('requires the original schema SHA and exact tuple, preserving escaped property spelling in the digest', async () => {
    const descriptor = testDescriptor(), raw = bytes(descriptor), expectation = { schema: descriptor.schema, schemaPayloadSha256: await hash(raw) }
    expect(await decodeRegisterSchema(raw, expectation)).toEqual(descriptor)
    await expect(decodeRegisterSchema(encode(JSON.stringify(descriptor) + ' '), expectation)).rejects.toThrow(/binding/)
    await expect(decodeRegisterSchema(raw, { ...expectation, schema: { ...descriptor.schema, world: 'other' } })).rejects.toThrow(/binding/)
    const escaped = encode(JSON.stringify(descriptor).replace('"world"', '"w\\u006frld"'))
    await expect(decodeRegisterSchema(escaped, expectation)).rejects.toThrow(/binding/)
    expect(await decodeRegisterSchema(escaped, { ...expectation, schemaPayloadSha256: await hash(escaped) })).toEqual(descriptor)
  })
  it('accepts arbitrary object member order while preserving exact selected order and source strings', async () => {
    const result = testResult()
    const reorder = (value: unknown): unknown => Array.isArray(value) ? value.map(reorder) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, reorder(v)])) : value
    expect(await decodeRegisterStatement(bytes(reorder(result)), testDescriptor(), result)).toEqual(result)
    expect(await decodeRegisterQuery(bytes(reorder(result.query)), testDescriptor())).toEqual(result.query)
  })
  it.each(['query', 'scopeHash', 'principalPolicyHash', 'captureId', 'revision', 'coverageStart', 'coverageEndExclusive', 'sourceReceiptHash', 'contentHash'])('rejects a mismatched external %s', async field => {
    const result = testResult(), expected = { ...structuredClone(result) }
    if (field === 'query') expected.query = { ...expected.query, from: '2026-04-02T00:00:00.0000002' }
    else if (field === 'contentHash') expected.publication = { ...expected.publication, contentHash: 'f'.repeat(64) }
    else expected.publication = { ...expected.publication, metadata: { ...expected.publication.metadata, [field]: field === 'revision' ? '9007199254740994' : field === 'captureId' ? 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' : field === 'coverageStart' ? '2026-03-01T00:00:00.0000000' : field === 'coverageEndExclusive' ? '2026-04-06T00:00:00.0000000' : 'f'.repeat(64) } }
    await expect(decodeRegisterStatement(bytes(result), testDescriptor(), expected)).rejects.toThrow(/binding/)
  })
  it('snapshots caller expectations and descriptor before asynchronous input', async () => {
    const original = testResult(), descriptor = testDescriptor(), expected = structuredClone(original)
    const pending = decodeRegisterStatement(bytes(original), descriptor, expected)
    Object.assign(expected.query, { from: '2026-04-02T00:00:00.0000003' })
    Object.assign(descriptor.schema, { world: 'changed' })
    expect(await pending).toEqual(original)
  })
  it('rejects capture envelopes, unknown members and number substitutions before returning an object', async () => {
    const descriptor = testDescriptor(), query = testQuery()
    await expect(decodeRegisterQuery(bytes({ ...query, opening: [] }), descriptor)).rejects.toThrow()
    await expect(decodeRegisterQuery(bytes({ ...query, kind: 'register-capture' }), descriptor)).rejects.toThrow()
    const result = testResult()
    for (const raw of [JSON.stringify(result).replace('"9007199254740993"', '9007199254740993'), JSON.stringify(result).replace('"-123401"', '-123401'), JSON.stringify(result).replace('"scale":"4"', '"scale":4'), JSON.stringify(result).replace('"version":1', '"version":1e0')]) {
      await expect(decodeRegisterStatement(encode(raw), descriptor, result)).rejects.toThrow()
    }
  })
})

describe('statement resource preflight and accepted transport semantics', () => {
  it('checks embedded query and metadata byte ceilings including Unicode before materializing the complete result', async () => {
    const result = testResult(), raw = JSON.stringify(result)
    for (const mutated of [raw.replace('"query":{', '"query":{' + ' '.repeat(REGISTER_JSON_BYTES.query)), raw.replace('"metadata":{', '"metadata":{' + ' '.repeat(REGISTER_JSON_BYTES.metadata))]) {
      const parse = vi.spyOn(JSON, 'parse')
      try {
        await expect(decodeRegisterStatement(encode(mutated), testDescriptor(), result)).rejects.toThrow(/bytes/)
        expect(parse.mock.calls.some(([text]) => text === mutated)).toBe(false)
      } finally { parse.mockRestore() }
    }
  })
  it('rejects projected dense explosion with only1000 sparse groups before full materialization', async () => {
    const result: SourceRegisterResultWire = { ...testResult(), groups: Array.from({ length: 1000 }, (_, i) => ({ rowKey: [{ kind: 'String', value: `r${i}` }], columnKey: [{ kind: 'String', value: `c${i}` }], values: [{ coefficient: '0', scale: '0' }] })) }
    const raw = JSON.stringify(result), parse = vi.spyOn(JSON, 'parse')
    try {
      await expect(decodeRegisterStatement(encode(raw), testDescriptor(), result)).rejects.toThrow(/budget/)
      expect(parse.mock.calls.some(([text]) => text === raw)).toBe(false)
    } finally { parse.mockRestore() }
    expect(validateRegisterResult(result, testDescriptor())).not.toBeNull()
  })
  it('counts grand in sparse budget and accepts more than200k legitimate single-column groups', () => {
    const descriptor = testDescriptor(), query = testQuery(descriptor)
    const validator = createRegisterGroupValidator(descriptor, query)
    for (let index = 0; index < 200001; index++) {
      const error = validator.visit({ rowKey: [{ kind: 'String', value: String(index) }], columnKey: [{ kind: 'String', value: 'one' }], values: [{ coefficient: '0', scale: '0' }] })
      if (error) throw new Error(error)
    }
    expect(validator.finish([{ coefficient: '0', scale: '0' }])).toBeNull()
    const wideDescriptor = testDescriptor(256), wideQuery = { ...testQuery(wideDescriptor), selections: wideDescriptor.resources.flatMap(resource => REGISTER_STAGES.map(stage => ({ resourceUuid: resource.uuid, stage }))) }
    const wide = createRegisterGroupValidator(wideDescriptor, wideQuery)
    const values = Array.from({ length: 1280 }, () => ({ coefficient: '0', scale: '0' }))
    for (let index = 0; index < 780; index++) expect(wide.visit({ rowKey: [{ kind: 'String', value: String(index) }], columnKey: [{ kind: 'String', value: 'one' }], values })).toBeNull()
    expect(wide.visit({ rowKey: [{ kind: 'String', value: 'overflow' }], columnKey: [{ kind: 'String', value: 'one' }], values })).not.toBeNull()
  }, 20000)
  it('rejects duplicate typed groups, width mismatch and complete-empty nonzero grand', async () => {
    const result = testResult()
    for (const candidate of [{ ...result, groups: [result.groups[0], result.groups[0]] }, { ...result, grandValues: [] }, { ...result, groups: [] }]) await expect(statement(candidate)).rejects.toThrow()
    expect(await statement({ ...result, groups: [], grandValues: [{ coefficient: '0', scale: '0' }] })).toMatchObject({ groups: [] })
  })
  it('accepts all174 output digits and scale38 independent of resource scale without rounding or financial calculation', async () => {
    const result = testResult(), exact = { coefficient: '-'.concat('9'.repeat(174)), scale: '38' }
    const candidate = { ...result, groups: result.groups.map(group => ({ ...group, values: [exact] })), grandValues: [exact] }
    expect(await statement(candidate)).toEqual(candidate)
    expect(validateRegisterResult(candidate, testDescriptor())).toBeNull()
    await expect(statement({ ...candidate, grandValues: [{ coefficient: '9'.repeat(175), scale: '38' }] })).rejects.toThrow()
  })
})
