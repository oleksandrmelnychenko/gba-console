/**
 * GUIDs are case-insensitive: a route or 1C deep link may carry an upper-case
 * GUID while the API echoes it lower-case. Compare them with this helper.
 */
export function normalizeGuid(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function sameGuid(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = normalizeGuid(left)
  return a !== '' && a === normalizeGuid(right)
}

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A GUID-shaped route parameter (any case); anything else is a broken link, not an id. */
export function isGuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && GUID_PATTERN.test(value.trim())
}
