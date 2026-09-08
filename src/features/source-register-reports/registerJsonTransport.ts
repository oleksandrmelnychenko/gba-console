import { BoundedJsonDocument, invalidJson, readBoundedRegisterBytes } from './rawJson'
import type { JsonSpan, RegisterJsonInput, RegisterJsonOptions } from './rawJson'
import type { RegisterPublicationReference, RegisterSchemaKey, SourceRegisterDescriptorWire, SourceRegisterQueryWire, SourceRegisterResultWire } from './types'
import { createRegisterGroupValidator, sameRegisterSchema, validateRegisterDescriptor, validateRegisterPublication, validateRegisterQuery, validateRegisterResult } from './validation'

export const REGISTER_JSON_BYTES = { schema: 2_097_152, query: 131_072, metadata: 16_384, statement: 33_554_432, statementHardMaximum: 536_870_912 } as const
export interface RegisterSchemaExpectation { readonly schema: RegisterSchemaKey; readonly schemaPayloadSha256: string }
export interface RegisterStatementExpectation { readonly query: SourceRegisterQueryWire; readonly publication: RegisterPublicationReference }

function checked<T>(value: unknown, validate: (value: unknown) => string | null): T {
  if (validate(value)) invalidJson('shape')
  return value as T
}
function schemaIdentity(key: RegisterSchemaKey): readonly string[] { return [key.world, key.schemaHash, key.registerUuid] }
function queryIdentity(query: SourceRegisterQueryWire): string {
  return JSON.stringify([schemaIdentity(query.schema), query.from, query.toExclusive, query.rowFields, query.columnFields, query.selections.map(item => [item.resourceUuid, item.stage])])
}
function publicationIdentity(publication: RegisterPublicationReference): string {
  const m = publication.metadata
  return JSON.stringify([schemaIdentity(m.schema), m.scopeHash, m.principalPolicyHash, m.captureId, m.revision,
    m.coverageStart, m.coverageEndExclusive, m.sourceReceiptHash, m.complete, publication.contentHash])
}
function descriptorSnapshot(descriptor: SourceRegisterDescriptorWire): SourceRegisterDescriptorWire {
  checked(descriptor, validateRegisterDescriptor)
  return structuredClone(descriptor)
}
function smallObject(document: BoundedJsonDocument, span: JsonSpan, expected?: readonly string[]): Record<string, unknown> {
  return Object.fromEntries([...document.members(span, expected)].map(([name, value]) => [name, document.scalar(value)]))
}
function queryFromDocument(document: BoundedJsonDocument, span: JsonSpan, descriptor: SourceRegisterDescriptorWire): SourceRegisterQueryWire {
  return checked(document.materialize(span, REGISTER_JSON_BYTES.query), value => validateRegisterQuery(value, descriptor))
}

/** Exact descriptor bytes must match an independently obtained registry binding, not a hash supplied by the payload. */
export async function decodeRegisterSchema(input: RegisterJsonInput, expected: RegisterSchemaExpectation, options: RegisterJsonOptions = {}): Promise<SourceRegisterDescriptorWire> {
  const key = { ...expected.schema }, expectedHash = expected.schemaPayloadSha256
  if (typeof expectedHash !== 'string' || !/^[0-9a-f]{64}$/.test(expectedHash)) invalidJson('binding')
  const bytes = await readBoundedRegisterBytes(input, REGISTER_JSON_BYTES.schema, REGISTER_JSON_BYTES.schema, options)
  const document = new BoundedJsonDocument(bytes, options.signal)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  options.signal?.throwIfAborted()
  const actualHash = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('')
  if (actualHash !== expectedHash) invalidJson('binding')
  const descriptor = checked<SourceRegisterDescriptorWire>(document.materialize(document.root, REGISTER_JSON_BYTES.schema), validateRegisterDescriptor)
  if (!sameRegisterSchema(descriptor.schema, key)) invalidJson('binding')
  return descriptor
}

export async function decodeRegisterQuery(input: RegisterJsonInput, descriptor: SourceRegisterDescriptorWire, options: RegisterJsonOptions = {}): Promise<SourceRegisterQueryWire> {
  const schema = descriptorSnapshot(descriptor)
  const bytes = await readBoundedRegisterBytes(input, REGISTER_JSON_BYTES.query, REGISTER_JSON_BYTES.query, options)
  const document = new BoundedJsonDocument(bytes, options.signal)
  return queryFromDocument(document, document.root, schema)
}

function preflightStatement(document: BoundedJsonDocument, descriptor: SourceRegisterDescriptorWire, expectedQuery: string, expectedPublication: string): void {
  const root = document.members(document.root, ['version', 'kind', 'schema', 'publication', 'query', 'groups', 'grandValues', 'sourceParityVerified'])
  if (document.scalar(root.get('version')!) !== 1 || document.scalar(root.get('kind')!) !== 'register-statement' || document.scalar(root.get('sourceParityVerified')!) !== false) invalidJson('shape')
  const key = smallObject(document, root.get('schema')!, ['world', 'schemaHash', 'registerUuid'])
  if (!sameRegisterSchema(key as unknown as RegisterSchemaKey, descriptor.schema)) invalidJson('binding')
  const query = queryFromDocument(document, root.get('query')!, descriptor)
  if (queryIdentity(query) !== expectedQuery) invalidJson('binding')
  const publicationParts = document.members(root.get('publication')!, ['metadata', 'contentHash'])
  const publication = checked<RegisterPublicationReference>({
    metadata: document.materialize(publicationParts.get('metadata')!, REGISTER_JSON_BYTES.metadata),
    contentHash: document.scalar(publicationParts.get('contentHash')!),
  }, value => validateRegisterPublication(value, query, descriptor))
  if (publicationIdentity(publication) !== expectedPublication) invalidJson('binding')

  const groups = createRegisterGroupValidator(descriptor, query)
  const numbers = (span: JsonSpan) => Array.from(document.elements(span, query.selections.length), item => smallObject(document, item, ['coefficient', 'scale']))
  for (const span of document.elements(root.get('groups')!, 1_000_000)) {
    const group = document.members(span, ['rowKey', 'columnKey', 'values'])
    // Only one bounded group is materialized. Identity sets retain no numeric values.
    const rowKey = Array.from(document.elements(group.get('rowKey')!, query.rowFields.length), item => smallObject(document, item))
    const columnKey = Array.from(document.elements(group.get('columnKey')!, query.columnFields.length), item => smallObject(document, item))
    if (groups.visit({ rowKey, columnKey, values: numbers(group.get('values')!) })) invalidJson('budget')
  }
  if (groups.finish(numbers(root.get('grandValues')!))) invalidJson('shape')
}

/** Structural decoding plus exact external query/publication matching; the reference itself cannot establish source or ACL authenticity. */
export async function decodeRegisterStatement(input: RegisterJsonInput, descriptor: SourceRegisterDescriptorWire, expected: RegisterStatementExpectation, options: RegisterJsonOptions = {}): Promise<SourceRegisterResultWire> {
  const schema = descriptorSnapshot(descriptor)
  checked(expected.query, value => validateRegisterQuery(value, schema))
  checked(expected.publication, value => validateRegisterPublication(value, expected.query, schema))
  // Snapshot immutable identities before the first await; caller mutations cannot retarget a pending decode.
  const query = queryIdentity(expected.query), publication = publicationIdentity(expected.publication)
  const bytes = await readBoundedRegisterBytes(input, REGISTER_JSON_BYTES.statement, REGISTER_JSON_BYTES.statementHardMaximum, options)
  const document = new BoundedJsonDocument(bytes, options.signal)
  preflightStatement(document, schema, query, publication)
  return checked(document.materialize(document.root, options.maximumBytes ?? REGISTER_JSON_BYTES.statement), value => validateRegisterResult(value, schema))
}
