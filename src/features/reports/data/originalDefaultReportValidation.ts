/** Wire checks shared only by the two ordinary default reports. No Source authority is inferred here. */
export const wireObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
export const wireHash = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
export const wireReference = (value: unknown): value is string => typeof value === 'string' && /^[0-9A-F]{32}$/.test(value)
export const wireExact = (value: unknown, expected: readonly string[]) => Array.isArray(value) && value.length === expected.length && value.every((item, index) => item === expected[index])
export function humanReportCaption(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value !== value.trim() || value.length > 512 || /[\p{Cc}]/u.test(value)
    || /^[0-9a-f]{32}$/i.test(value) || /^[({]?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[)}]?$/i.test(value) || /^[\d.\- ]+$/.test(value)) return false
  return validReportUtf16(value)
}
/** Lossless UTF16 validation; caption policies remain with each original. */
export function validReportUtf16(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const unit = value.charCodeAt(index)
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(++index)
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return false
  }
  return true
}
export function exactReportNumber(value: unknown, scale: 2 | 3): value is string {
  return typeof value === 'string' && value.length <= 100 && new RegExp(`^-?(0|[1-9]\\d*)\\.\\d{${scale}}$`).test(value)
    && value !== `-0.${'0'.repeat(scale)}`
}
export function businessDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(value + 'T00:00:00Z')
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null
}
export function referenceSelection(values: readonly string[], allowNull = false): string[] {
  if (values.length > 256 || new Set(values).size !== values.length || values.some(value => !wireReference(value) && !(allowNull && value === 'NULL')))
    throw new Error('Некоректний відбір звіту.')
  return [...values].sort()
}
