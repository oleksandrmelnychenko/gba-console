import type { FinancialBasis, ProductHistoryContract } from './types'

const calendarFormat = new Intl.DateTimeFormat('uk-UA', { timeZone: 'UTC' })

// Add exact decimal source amounts first, then round once with accounting HALF_UP.
// This prevents summing rounded monthly amounts into a different dashboard total.
export function financialTotal(basis: FinancialBasis[], net: boolean): number | null {
  if (!basis.length || (net && basis.some(row => row.unresolved_amount_count !== 0))) return null
  const values = basis.flatMap(row => net ? [row.revenue_eur, negate(row.known_returned_value_eur)] : [row.revenue_eur])
  if (values.some(value => !/^-?\d+(?:\.\d+)?$/.test(value))) return null
  const scale = Math.max(2, ...values.map(value => value.split('.')[1]?.length ?? 0))
  if (scale > 30) return null
  const sum = values.reduce((total, value) => {
    const [whole, fraction = ''] = value.replace(/^-/, '').split('.')
    const integer = BigInt(whole + fraction.padEnd(scale, '0'))
    return total + (value.startsWith('-') ? -integer : integer)
  }, 0n)
  const divisor = 10n ** BigInt(scale - 2)
  const magnitude = sum < 0n ? -sum : sum
  const cents = (magnitude + divisor / 2n) / divisor
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) return null
  return Number(sum < 0n ? -cents : cents) / 100
}
function negate(value: string) { return value.startsWith('-') ? value.slice(1) : `-${value}` }

export function financialPeriod(history: ProductHistoryContract | null | undefined, window = 'dead'): string {
  const start = history?.history_windows[window]?.effective_start
  if (!history || !start) return 'Період недоступний'
  if (history.history_windows[window]?.effective_days === 0) return 'Немає історії за період'
  const end = new Date(`${history.as_of}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() - 1)
  return `${calendarFormat.format(new Date(`${start}T00:00:00Z`))} — ${calendarFormat.format(end)} · Київ`
}
