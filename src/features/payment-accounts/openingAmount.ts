import { getAmountError, parseAmountText } from '../../shared/ui/amountText'

/** Opening amount of a new currency register: a number with at most 2 decimals, never negative. */
export function getOpeningAmountError(value: string): string | null {
  return getAmountError(parseAmountText(value || ''), { decimalScale: 2 })
}
