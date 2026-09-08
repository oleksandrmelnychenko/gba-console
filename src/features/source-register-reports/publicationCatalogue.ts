import { BoundedJsonDocument, invalidJson, readBoundedRegisterBytes } from './rawJson'
import type { JsonSpan, RegisterJsonInput } from './rawJson'
import type { RegisterPublicationReference, RegisterSchemaKey } from './types'
import { hasExactMembers, isRegisterSchemaKey, validateRegisterPublication } from './validation'
import { isRegisterLocalTimestamp } from './period'

export const REGISTER_CATALOGUE_BYTES = 16_777_216
export const REGISTER_CATALOGUE_ITEMS = 4096
export interface RegisterPublicationSummary {
  readonly publicationId: string
  readonly caption: string
  readonly schema: RegisterSchemaKey
  readonly schemaPayloadSha256: string
  readonly revision: string
  readonly coverageStart: string
  readonly coverageEndExclusive: string
  readonly authorizationVersion: string
  readonly expectedPublication: RegisterPublicationReference
  readonly sourceParityVerified: false
}
const MEMBERS = ['publicationId', 'caption', 'schema', 'schemaPayloadSha256', 'revision', 'coverageStart', 'coverageEndExclusive', 'authorizationVersion', 'expectedPublication', 'sourceParityVerified'] as const
const HASH = /^[0-9a-f]{64}$/
const UUID = /^(?!00000000-0000-0000-0000-000000000000$)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
// Match the server's explicit control-character prohibition, including C0/C1.
// eslint-disable-next-line no-control-regex
const CAPTION_CONTROLS = /[\u0000-\u001f\u007f-\u009f]/u
// .NET whitespace includes NEL but excludes BOM; do not normalize source captions with trim().
// eslint-disable-next-line no-control-regex
const CAPTION_WHITESPACE = /^[\u0009-\u000d\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]*$/u

export function isRegisterPublication(value: unknown): value is RegisterPublicationSummary {
  if (!hasExactMembers(value, MEMBERS) || typeof value.publicationId !== 'string' || !UUID.test(value.publicationId)
    || typeof value.caption !== 'string' || value.caption.length > 256 || CAPTION_WHITESPACE.test(value.caption) || CAPTION_CONTROLS.test(value.caption)
    || !isRegisterSchemaKey(value.schema) || typeof value.schemaPayloadSha256 !== 'string' || !HASH.test(value.schemaPayloadSha256)
    || typeof value.authorizationVersion !== 'string' || !HASH.test(value.authorizationVersion) || value.sourceParityVerified !== false
    || typeof value.revision !== 'string' || !isRegisterLocalTimestamp(value.coverageStart) || !isRegisterLocalTimestamp(value.coverageEndExclusive)
    || value.coverageStart >= value.coverageEndExclusive) return false
  const publication = value.expectedPublication
  if (validateRegisterPublication(publication, { from: value.coverageStart, toExclusive: value.coverageEndExclusive }, { schema: value.schema })) return false
  const metadata = (publication as RegisterPublicationReference).metadata
  return metadata.revision === value.revision && metadata.coverageStart === value.coverageStart && metadata.coverageEndExclusive === value.coverageEndExclusive
}

function scalarObject(document: BoundedJsonDocument, span: JsonSpan, names: readonly string[]) {
  return Object.fromEntries([...document.members(span, names)].map(([name, value]) => [name, document.scalar(value)]))
}

/** Authenticated catalogue provides expected bindings; decoding alone confers no grant. */
export async function decodeRegisterPublications(input: RegisterJsonInput, signal?: AbortSignal): Promise<readonly RegisterPublicationSummary[]> {
  const bytes = await readBoundedRegisterBytes(input, REGISTER_CATALOGUE_BYTES, REGISTER_CATALOGUE_BYTES, { signal })
  const document = new BoundedJsonDocument(bytes, signal)
  const root = document.members(document.root, ['version', 'kind', 'items'])
  if (document.scalar(root.get('version')!) !== 1 || document.scalar(root.get('kind')!) !== 'register-publications') invalidJson('shape')
  const items: RegisterPublicationSummary[] = [], ids = new Set<string>()
  for (const span of document.elements(root.get('items')!, REGISTER_CATALOGUE_ITEMS)) {
    const members = document.members(span, MEMBERS), candidate: Record<string, unknown> = {}
    for (const name of MEMBERS) {
      if (name === 'schema') candidate.schema = scalarObject(document, members.get(name)!, ['world', 'schemaHash', 'registerUuid'])
      else if (name === 'expectedPublication') {
        const publication = document.members(members.get(name)!, ['metadata', 'contentHash'])
        candidate.expectedPublication = { metadata: document.materialize(publication.get('metadata')!, 16_384), contentHash: document.scalar(publication.get('contentHash')!) }
      } else candidate[name] = document.scalar(members.get(name)!)
    }
    if (!isRegisterPublication(candidate) || ids.has(candidate.publicationId)) invalidJson('shape')
    ids.add(candidate.publicationId); items.push(candidate)
  }
  return items
}
