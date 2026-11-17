export const SUPPLY_ORDER_INCOME_STATUS_LABEL = 'Оприходувано'
export const SUPPLY_ORDER_NOT_INCOMED_STATUS_LABEL = 'Не оприходувано'
export const SUPPLY_ORDER_PARTIAL_INCOME_STATUS_LABEL = 'Частково оприходувано'

export type SupplyOrderIncomeState = 'placed' | 'partial' | 'none'

/** IsPlaced = everything received; IsPartialPlaced = some columns already have an income document. */
export function getSupplyOrderIncomeState(isPlaced?: boolean | null, isPartialPlaced?: boolean | null): SupplyOrderIncomeState {
  if (isPlaced) return 'placed'
  return isPartialPlaced ? 'partial' : 'none'
}

export function getSupplyOrderIncomeStatusLabel(isPlaced?: boolean | null, isPartialPlaced?: boolean | null): string {
  switch (getSupplyOrderIncomeState(isPlaced, isPartialPlaced)) {
    case 'placed':
      return SUPPLY_ORDER_INCOME_STATUS_LABEL
    case 'partial':
      return SUPPLY_ORDER_PARTIAL_INCOME_STATUS_LABEL
    default:
      return SUPPLY_ORDER_NOT_INCOMED_STATUS_LABEL
  }
}

/** The pill class used next to the label: green when received, yellow while partly received. */
export function getSupplyOrderIncomePillClass(isPlaced?: boolean | null, isPartialPlaced?: boolean | null): string {
  const state = getSupplyOrderIncomeState(isPlaced, isPartialPlaced)
  return state === 'placed' ? 'is-green' : state === 'partial' ? 'is-yellow' : 'is-gray'
}
