/** Same limits the server enforces (ReSaleSelectionPolicy): markup 0..1000 %, qty within stock, price > 0. */
export const RESALE_MAX_EXTRA_CHARGE_PERCENT = 1_000
export const RESALE_MAX_INVOICE_AMOUNT = 1_000_000_000
export const RESALE_MIN_SALE_PRICE = 0.01

/** Quantity limits for a resale line: never negative, never above what is available. */
export function resaleQtyLimits(available: number | null | undefined): { max?: number; min: number } {
  return typeof available === 'number' && Number.isFinite(available) && available >= 0
    ? { max: available, min: 0 }
    : { min: 0 }
}
