import type { ActReconciliationItem } from './types'

export const INCOME_NOT_RECEIVABLE_MESSAGE =
  'Оприходувати неможливо: у пак-листах інвойсу немає неоприходованого залишку цього товару'

/**
 * «Оприходування» of an invoice act takes goods only from what the invoice's packing lists still
 * hold unplaced; the server reports that as IncomeReceivableQty. Rows where it is 0 (shortage rows
 * among them) were offered the action and always refused (chaos2-orders F10 / w1-16). A missing
 * value (supply-order acts, older API) does not limit the action.
 */
export function getIncomeReceivableQty(item: ActReconciliationItem): number | undefined {
  const value = item.IncomeReceivableQty

  return typeof value === 'number' && Number.isFinite(value) ? Math.max(value, 0) : undefined
}

/** Message for the disabled tab when none of the chosen rows can be received; null when it is allowed. */
export function getIncomeRefusal(items: ActReconciliationItem[]): string | null {
  if (!items.length) {
    return null
  }

  return items.every((item) => getIncomeReceivableQty(item) === 0) ? INCOME_NOT_RECEIVABLE_MESSAGE : null
}

/** Upper bound for an income quantity: the act's difference, capped by what the packing lists still hold. */
export function getIncomeQuantityLimit(item: ActReconciliationItem | null | undefined): number | undefined {
  if (!item) {
    return undefined
  }

  const difference = typeof item.QtyDifference === 'number' && Number.isFinite(item.QtyDifference) ? item.QtyDifference : undefined
  const receivable = getIncomeReceivableQty(item)

  if (receivable === undefined) {
    return difference
  }

  return difference === undefined ? receivable : Math.min(difference, receivable)
}
