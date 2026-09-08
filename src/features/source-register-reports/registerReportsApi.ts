import { apiRequestStream, assertApiStreamCurrent } from '../../shared/api/apiStreamClient'
import type { ApiStreamSession } from '../../shared/api/apiStreamClient'
import { ApiError } from '../../shared/api/apiClient'
import { decodeRegisterPublications, isRegisterPublication } from './publicationCatalogue'
import type { RegisterPublicationSummary } from './publicationCatalogue'
import { decodeRegisterSchema, decodeRegisterStatement } from './registerJsonTransport'
import { serializeRegisterQuery } from './query'
import type { SourceRegisterDescriptorWire, SourceRegisterQueryWire } from './types'
import { sameRegisterSchema, validateRegisterPublication } from './validation'

const ROOT = '/report/generalized/publications'
export interface RegisterApiContext { readonly session: ApiStreamSession; readonly signal: AbortSignal }
async function readResponse<T>(response: Response, signal: AbortSignal, decode: (body: ReadableStream<Uint8Array>) => Promise<T>): Promise<T> {
  try {
    if (!response.body || response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      void response.body?.cancel().catch(() => undefined)
      throw new ApiError('Сервер повернув непідтримуваний формат звіту.', 502, null)
    }
    return await decode(response.body)
  } finally {
    // Covers cancellation between response headers and the decoder acquiring its reader.
    void response.body?.cancel().catch(() => undefined)
    assertApiStreamCurrent(response, signal)
  }
}
function publicationPath(publication: RegisterPublicationSummary): string {
  if (!isRegisterPublication(publication)) throw new Error('Некоректна публікація звіту.')
  return `${ROOT}/${publication.publicationId}`
}
export async function listRegisterPublications(context: RegisterApiContext) {
  const response = await apiRequestStream(ROOT, context)
  return readResponse(response, context.signal, body => decodeRegisterPublications(body, context.signal))
}
export async function getRegisterSchema(publication: RegisterPublicationSummary, context: RegisterApiContext) {
  const path = publicationPath(publication), expected = { schema: { ...publication.schema }, schemaPayloadSha256: publication.schemaPayloadSha256 }
  const response = await apiRequestStream(`${path}/schema`, context)
  return readResponse(response, context.signal, body => decodeRegisterSchema(body, expected, { signal: context.signal }))
}
export async function generateRegisterStatement(publication: RegisterPublicationSummary, descriptor: SourceRegisterDescriptorWire, query: SourceRegisterQueryWire, context: RegisterApiContext) {
  const path = publicationPath(publication), body = serializeRegisterQuery(query, descriptor)
  if (!sameRegisterSchema(publication.schema, descriptor.schema)) throw new Error('Опис не відповідає вибраній публікації.')
  const publicationError = validateRegisterPublication(publication.expectedPublication, query, descriptor)
  if (publicationError) throw new Error(publicationError)
  // Keep exactly the query that was serialized, even if a caller later mutates its draft.
  const expected = { query: structuredClone(query), publication: structuredClone(publication.expectedPublication) }, schema = structuredClone(descriptor)
  const response = await apiRequestStream(`${path}/statement`, { ...context, method: 'POST', body })
  return readResponse(response, context.signal, stream => decodeRegisterStatement(stream, schema, expected, { signal: context.signal }))
}
