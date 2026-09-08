import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { decodeRegisterQuery, decodeRegisterSchema, decodeRegisterStatement } from './registerJsonTransport'
import { formatExactRegisterNumber } from './exactNumber'
import type { SourceRegisterDescriptorWire, SourceRegisterResultWire } from './types'
import rootSchema from './fixtures/root30-schema.json?raw'
import rootQuery from './fixtures/root30-query.json?raw'
import rootStatement from './fixtures/root30-statement.json?raw'
import rootExpected from './fixtures/root30-expected.json?raw'
import typedSchema from './fixtures/typed-schema.json?raw'
import typedQuery from './fixtures/typed-query.json?raw'
import typedStatement from './fixtures/typed-statement.json?raw'
import kernelSchema from './fixtures/kernel166-schema.json?raw'
import kernelQuery from './fixtures/kernel166-query.json?raw'
import kernelStatement from './fixtures/kernel166-statement.json?raw'
import emptySchema from './fixtures/empty-schema.json?raw'
import emptyQuery from './fixtures/empty-query.json?raw'
import emptyStatement from './fixtures/empty-statement.json?raw'
import wideSchema from './fixtures/wide1280-schema.json?raw'
import wideQuery from './fixtures/wide1280-query.json?raw'
import wideStatement from './fixtures/wide1280-statement.json?raw'
import transport174 from './fixtures/transport174-statement.json?raw'

// Actual C# writer bytes over explicitly synthetic operands; no original source or ACL proof.
const variants = [
  ['root30', rootSchema, rootQuery, rootStatement, 'c0d4f8e23661cfccbb56ca67cb298ecd4d16da7f727b3cdc5680e278da8180aa', 30],
  ['typed', typedSchema, typedQuery, typedStatement, 'c9b84dfb6bef33544c88a7f2f7f93efadc547b2537e00cc4d123c4eb6acbcffd', 8],
  ['kernel166', kernelSchema, kernelQuery, kernelStatement, 'c9b84dfb6bef33544c88a7f2f7f93efadc547b2537e00cc4d123c4eb6acbcffd', 2],
  ['empty', emptySchema, emptyQuery, emptyStatement, 'c9b84dfb6bef33544c88a7f2f7f93efadc547b2537e00cc4d123c4eb6acbcffd', 1],
  ['wide1280', wideSchema, wideQuery, wideStatement, '022aec59734419ff1f44b72a942e06c8de6af17f5b44894541684d5af739bfae', 2560],
  ['transport174-only', kernelSchema, kernelQuery, transport174, 'c9b84dfb6bef33544c88a7f2f7f93efadc547b2537e00cc4d123c4eb6acbcffd', 2],
] as const
const encode = (text: string) => new TextEncoder().encode(text)
beforeAll(async () => vi.stubGlobal('crypto', (await vi.importActual<{ webcrypto: Crypto }>('node:crypto')).webcrypto))
afterAll(() => vi.unstubAllGlobals())

it.each(variants)('decodes actual %s writer bytes through all boundaries without losing a digit', async (_name, schemaText, queryText, resultText, schemaPayloadSha256, numericCells) => {
  // Expectations are frozen external test controls, not promoted to trusted runtime defaults.
  const expectedDescriptor = JSON.parse(schemaText) as SourceRegisterDescriptorWire
  const expectedResult = JSON.parse(resultText) as SourceRegisterResultWire
  const descriptor = await decodeRegisterSchema(encode(schemaText), { schema: expectedDescriptor.schema, schemaPayloadSha256 })
  const query = await decodeRegisterQuery(encode(queryText), descriptor)
  const result = await decodeRegisterStatement(encode(resultText), descriptor, { query, publication: expectedResult.publication })
  expect(descriptor).toEqual(expectedDescriptor)
  expect(result).toEqual(expectedResult)
  expect(result.query).toEqual(query)
  expect(result.groups.reduce((count, group) => count + group.values.length, result.grandValues.length)).toBe(numericCells)
  expect(result.sourceParityVerified).toBe(false)
})

it('matches the30 decoded root writer numbers against independent literal controls', async () => {
  const expected = JSON.parse(rootExpected) as { groups: { rawReferenceHex: string; values: string[] }[]; grandValues: string[]; kernelContentHash: string }
  const descriptor = await decodeRegisterSchema(encode(rootSchema), { schema: (JSON.parse(rootSchema) as SourceRegisterDescriptorWire).schema, schemaPayloadSha256: variants[0][4] })
  const query = await decodeRegisterQuery(encode(rootQuery), descriptor)
  const publication = (JSON.parse(rootStatement) as SourceRegisterResultWire).publication
  expect(publication.contentHash).toBe(expected.kernelContentHash)
  const result = await decodeRegisterStatement(encode(rootStatement), descriptor, { query, publication })
  const byRef = new Map(expected.groups.map(group => [group.rawReferenceHex, group.values]))
  for (const group of result.groups) {
    const atom = group.rowKey[0]
    if (atom.kind !== 'Reference') throw new Error('Frozen control must be a typed reference')
    expect(group.values.map(formatExactRegisterNumber)).toEqual(byRef.get(atom.rawReferenceHex)!.map(value => value.replace('.', ',')))
  }
  expect(result.grandValues.map(formatExactRegisterNumber)).toEqual(expected.grandValues.map(value => value.replace('.', ',')))
})
