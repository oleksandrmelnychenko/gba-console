/** Same limits the server enforces (ReSaleSelectionPolicy): no negative markup, qty or price, qty within stock. */
export const RESALE_MAX_EXTRA_CHARGE_PERCENT = 1_000
export const RESALE_MAX_INVOICE_AMOUNT = 1_000_000_000

export const RESALE_MARKUP_INPUT_PROPS = {
  allowNegative: false,
  clampBehavior: 'strict',
  max: RESALE_MAX_EXTRA_CHARGE_PERCENT,
  min: 0,
} as const

export const RESALE_AMOUNT_INPUT_PROPS = {
  allowNegative: false,
  clampBehavior: 'strict',
  max: RESALE_MAX_INVOICE_AMOUNT,
  min: 0,
} as const

export const RESALE_PRICE_INPUT_PROPS = { allowNegative: false, min: 0 } as const

/** Quantity input limited to what is available for this line (unlimited when the stock is unknown). */
export function resaleQtyInputProps(available: number | null | undefined) {
  return {
    allowNegative: false,
    clampBehavior: 'strict',
    min: 0,
    ...(typeof available === 'number' && Number.isFinite(available) && available >= 0 ? { max: available } : {}),
  } as const
}
