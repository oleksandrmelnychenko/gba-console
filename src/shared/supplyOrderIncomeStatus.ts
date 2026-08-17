export const SUPPLY_ORDER_INCOME_STATUS_LABEL = 'Оприходувано'
export const SUPPLY_ORDER_NOT_INCOMED_STATUS_LABEL = 'Не оприходувано'

export function getSupplyOrderIncomeStatusLabel(isPlaced?: boolean | null): string {
  return isPlaced
    ? SUPPLY_ORDER_INCOME_STATUS_LABEL
    : SUPPLY_ORDER_NOT_INCOMED_STATUS_LABEL
}
