export type AvailabilityNumber = { Numerator: string; Denominator: string; Display: string }
export type AvailabilityAmounts = { Current: AvailabilityNumber | null; Writeoff: AvailabilityNumber | null; Receipts: AvailabilityNumber | null; Reserve: AvailabilityNumber | null; Free: AvailabilityNumber | null }
export const availabilityStages = ['Current', 'Writeoff', 'Receipts', 'Reserve', 'Free'] as const
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const integer = (v: unknown): v is string => typeof v === 'string' && v.length <= 512 && /^-?(0|[1-9]\d*)$/.test(v) && v !== '-0'
export const availabilityMoneyError = () => new Error('Сервер не підтвердив суми доступних коштів.')
export function availabilityDisplay(n: bigint, d: bigint): string {
  const absolute = n < 0n ? -n : n, whole = absolute * 100n / d, remainder = absolute * 100n % d
  const cents = whole + (remainder * 2n >= d ? 1n : 0n)
  return `${n < 0n && cents !== 0n ? '-' : ''}${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`
}
export function readAvailabilityNumber(v: unknown): AvailabilityNumber | null {
  if (v === null) return null
  if (!record(v) || !integer(v.Numerator) || !integer(v.Denominator) || BigInt(v.Denominator) <= 0n
    || v.Display !== availabilityDisplay(BigInt(v.Numerator), BigInt(v.Denominator))) throw availabilityMoneyError()
  return { Numerator: v.Numerator, Denominator: v.Denominator, Display: String(v.Display) }
}
export function readAvailabilityAmounts(v: unknown): AvailabilityAmounts {
  if (!record(v)) throw availabilityMoneyError()
  const values = availabilityStages.map(stage => readAvailabilityNumber(v[stage]))
  const [current, writeoff, receipts, reserve, free] = values
  if ([current, writeoff, receipts, reserve].some(v => v === null)) {
    if (free !== null) throw availabilityMoneyError()
  } else {
    const expected = sumAvailability([current!, writeoff!, receipts!, reserve!], [1n, -1n, 1n, -1n])
    if (free === null || !sameAvailability(free, expected)) throw availabilityMoneyError()
  }
  return { Current: current, Writeoff: writeoff, Receipts: receipts, Reserve: reserve, Free: free }
}
function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a
  while (b !== 0n) { const next = a % b; a = b; b = next }
  return a
}
export function sumAvailability(values: AvailabilityNumber[], signs?: bigint[]): AvailabilityNumber {
  let n = 0n, d = 1n
  values.forEach((v, index) => {
    const vd = BigInt(v.Denominator), common = gcd(d, vd), left = vd / common, right = d / common
    n = n * left + BigInt(v.Numerator) * right * (signs?.[index] ?? 1n); d *= left
    const reduce = gcd(n, d); n /= reduce; d /= reduce
  })
  return { Numerator: String(n), Denominator: String(d), Display: availabilityDisplay(n, d) }
}
export const sameAvailability = (a: AvailabilityNumber, b: AvailabilityNumber) => BigInt(a.Numerator) * BigInt(b.Denominator) === BigInt(b.Numerator) * BigInt(a.Denominator)
