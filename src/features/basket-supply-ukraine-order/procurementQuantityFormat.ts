/** Display fractional packs without whole-unit rounding or binary arithmetic tail digits. */
export const procurementQuantityFormat = new Intl.NumberFormat('uk-UA', { maximumSignificantDigits: 15 })

const WHOLE_UNITS = new Set(['шт', 'компл', 'пар', 'пара', 'уп', 'упак', 'наб'])
const wholeQuantityFormat = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 })
const measuredQuantityFormat = new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function formatDashboardQuantity(value: number, unit?: string | null): string {
  const label = unit?.trim() ?? ''
  const whole = WHOLE_UNITS.has(label.replace(/\.$/, '').toLowerCase())
  const text = Number.isInteger(value) || (whole && Math.abs(value) >= 1) ? wholeQuantityFormat.format(value)
    : Math.abs(value) >= 1 ? measuredQuantityFormat.format(value)
    : procurementQuantityFormat.format(value)
  return label ? `${text}\u00a0${label}` : text
}

export function quantityByUnit<T>(items: readonly T[], unitOf: (item: T) => string | null | undefined, qtyOf: (item: T) => number): Record<string, number> | null {
  const totals: Record<string, number> = {}
  for (const item of items) {
    const qty = qtyOf(item)
    if (!(qty > 0)) continue
    const unit = unitOf(item)?.trim()
    if (!unit) return null
    totals[unit] = (totals[unit] ?? 0) + qty
  }
  return Object.keys(totals).length > 0 ? totals : null
}

export type ProcurementLeadTimeBasis = 'measured' | 'default' | 'override'

export function formatProcurementQuantity(
  value: number,
  unit?: string | null,
  formatter: Intl.NumberFormat = procurementQuantityFormat,
): string {
  const text = formatter.format(value)
  const label = unit?.trim()
  return label ? `${text}\u00a0${label}` : text
}

export function describeLeadTimeBasis(
  basis: ProcurementLeadTimeBasis | null | undefined,
  sampleCount: number | null | undefined,
  statistic?: 'mean' | 'trimmed_mean' | null,
): string | null {
  if (basis === 'measured') {
    const measured = sampleCount != null && sampleCount > 0
      ? `виміряний за ${new Intl.NumberFormat('uk-UA').format(sampleCount)} поставками`
      : 'виміряний за поставками'
    return statistic === 'trimmed_mean' ? `${measured}, усереднено без викидів` : measured
  }
  if (basis === 'default') return 'типовий'
  if (basis === 'override') return 'задано вручну'
  return null
}
