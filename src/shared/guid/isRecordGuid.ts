const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'

/**
 * A route id that can name an existing record: a well-formed, non-empty GUID.
 * Deep links such as /edit/not-a-guid or the zero GUID can never load a record,
 * so pages show their «не знайдено» state without asking the server.
 */
export function isRecordGuid(value: string | null | undefined): value is string {
  if (typeof value !== 'string') {
    return false
  }

  const trimmed = value.trim()

  return GUID_PATTERN.test(trimmed) && trimmed !== EMPTY_GUID
}
