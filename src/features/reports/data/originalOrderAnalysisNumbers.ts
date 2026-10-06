import { orderAnalysisInvalid, orderAnalysisRecord } from './originalOrderAnalyses'
export type OrderAnalysisNumber = { Observed: boolean; Value: { Numerator: string; Denominator: string } | null }
const integer = (v: unknown): v is string => typeof v === 'string' && v.length <= 20_000 && /^(0|-?[1-9]\d*)$/.test(v)
export function readOrderAnalysisNumber(v: unknown): OrderAnalysisNumber {
  if (!orderAnalysisRecord(v) || typeof v.Observed !== 'boolean') throw orderAnalysisInvalid()
  if (v.Value === null) return { Observed: v.Observed, Value: null }
  if (!v.Observed || !orderAnalysisRecord(v.Value) || !integer(v.Value.Numerator) || !integer(v.Value.Denominator) || BigInt(v.Value.Denominator) <= 0n
    || v.Value.Numerator === '0' && v.Value.Denominator !== '1') throw orderAnalysisInvalid()
  return { Observed: true, Value: { Numerator: v.Value.Numerator, Denominator: v.Value.Denominator } }
}
/** Exact terminating values or an exact fraction. No invented native rounding or Number conversion. */
export function orderAnalysisNumberText(v: OrderAnalysisNumber): string {
  if (!v.Observed) return 'Недоступно'
  if (v.Value === null) return 'Немає значення'
  const { Numerator: n, Denominator: d } = v.Value
  if (d === '1') return n
  let remainder = BigInt(d), twos = 0, fives = 0
  while (remainder % 2n === 0n && twos < 256) { remainder /= 2n; twos++ }
  while (remainder % 5n === 0n && fives < 256) { remainder /= 5n; fives++ }
  if (remainder !== 1n) return `${n} / ${d}`
  const scale = Math.max(twos, fives), signed = BigInt(n), digits = (signed < 0n ? -signed : signed) * 10n ** BigInt(scale) / BigInt(d)
  const text = String(digits).padStart(scale + 1, '0'), fraction = text.slice(-scale).replace(/0+$/, '')
  return `${signed < 0n ? '-' : ''}${text.slice(0, -scale)}${fraction ? '.' + fraction : ''}`
}
