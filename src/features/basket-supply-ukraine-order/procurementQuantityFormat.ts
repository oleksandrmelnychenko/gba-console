/** Display fractional packs without whole-unit rounding or binary arithmetic tail digits. */
export const procurementQuantityFormat = new Intl.NumberFormat('uk-UA', { maximumSignificantDigits: 15 })

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
): string | null {
  if (basis === 'measured') {
    return sampleCount != null && sampleCount > 0
      ? `виміряний за ${new Intl.NumberFormat('uk-UA').format(sampleCount)} поставками`
      : 'виміряний за поставками'
  }
  if (basis === 'default') return 'типовий'
  if (basis === 'override') return 'задано вручну'
  return null
}
