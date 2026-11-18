/**
 * Owner decision: a lot may be received, capitalized or imported with price 0 (free goods), but only after the
 * user confirms it; the server accepts 0 and still refuses a negative price.
 */
export const ZERO_PRICE_CONFIRM_MESSAGE = 'Ціна 0 — товар буде оприбутковано безкоштовно. Продовжити?'

/** True when at least one line carries an explicit price of exactly 0 (blank or invalid prices are not zero). */
export function hasZeroPrice(prices: Iterable<unknown>): boolean {
  for (const price of prices) {
    const value = typeof price === 'string' && price.trim() !== '' ? Number(price.replace(',', '.')) : price

    if (typeof value === 'number' && Number.isFinite(value) && value === 0) {
      return true
    }
  }

  return false
}
