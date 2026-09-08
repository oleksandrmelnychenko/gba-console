const unitCostFormatter = new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 20 })

/** Keep small manual estimates visible; line totals retain their separate cent format. */
export function formatUnitCost(value: number): string {
  const formatted = unitCostFormatter.format(value)
  return value !== 0 && formatted === unitCostFormatter.format(0) ? value.toString().replace('.', ',') : formatted
}
