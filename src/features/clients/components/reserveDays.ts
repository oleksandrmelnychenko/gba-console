export const MAX_RESERVE_DAYS = 365

/** A whole number of days 0..365, or null for anything else (empty, text, negative, huge). */
export function parseReserveDays(value: number | string): number | null {
  if (typeof value === 'string' && !value.trim()) {
    return null
  }

  const days = Number(value)

  return Number.isInteger(days) && days >= 0 && days <= MAX_RESERVE_DAYS ? days : null
}
