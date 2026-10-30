import { customerGroupDirectoryId } from './customerGroupDirectory'
import { revenueExactId } from './revenueComparison'

/** A scoped report lookup Id is an Int64 string, never a rounded JavaScript number. */
export function canonicalCustomerGroupInt64Id(value: unknown): string | null {
  return typeof value === 'string' && /^[1-9][0-9]{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n ? value : null
}
/** Presentation/admission only. Preserve the original saved object or JSON text unchanged. */
export function customerGroupInt64Id(raw: unknown): string | null {
  if (typeof raw === 'string' && raw.length > 65536) return null
  const exact = revenueExactId(raw)
  if (!exact) return null
  try {
    const value: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const id = Object.entries(value).find(([key]) => key.toLowerCase() === 'id')?.[1]
    // The legacy numeric path checks the original JSON token before parsing can round it.
    if (typeof id === 'number' && customerGroupDirectoryId(raw) === null) return null
    return exact
  } catch { return null }
}
