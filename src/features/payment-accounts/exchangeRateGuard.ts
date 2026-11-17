export type SystemExchangeRate = { Code?: string; Amount?: number }

/** Hryvnia per unit of `currencyCode` from /exchangerates/get/current (first entry, like the income forms). */
export function findSystemExchangeRate(rates: SystemExchangeRate[], currencyCode: string): number | null {
  const code = currencyCode.trim().toUpperCase()

  if (!code || code === 'UAH') {
    return null
  }

  const rate = rates.find((entry) => (entry.Code || '').toUpperCase() === code)?.Amount

  return typeof rate === 'number' && Number.isFinite(rate) && rate > 0 ? rate : null
}

/** The register exchange quotes hryvnia per foreign unit, so a system rate exists only when one side is UAH. */
export function getExchangeSystemRate(
  rates: SystemExchangeRate[],
  fromCurrencyCode: string,
  toCurrencyCode: string,
): number | null {
  const from = fromCurrencyCode.trim().toUpperCase()
  const to = toCurrencyCode.trim().toUpperCase()

  if (from === 'UAH' && to && to !== 'UAH') return findSystemExchangeRate(rates, to)
  if (to === 'UAH' && from && from !== 'UAH') return findSystemExchangeRate(rates, from)

  return null
}

export const EXCHANGE_RATE_TOLERANCE = 0.2

/** A typed rate more than 20% away from the system rate (10 EUR at 99 999 999 999 became 999 999 999 990 UAH). */
export function isExchangeRateFarFromSystem(rate: number, systemRate: number | null, tolerance = EXCHANGE_RATE_TOLERANCE): boolean {
  if (!systemRate || !(rate > 0)) {
    return false
  }

  return Math.abs(rate / systemRate - 1) > tolerance
}

export function formatExchangeRate(rate: number): string {
  return String(Math.round(rate * 1_000_000) / 1_000_000).replace('.', ',')
}
