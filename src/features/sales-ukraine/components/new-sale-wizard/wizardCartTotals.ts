import { roundMoney } from '../../saleMoney'
import type { SalesUkraineOrderItem } from '../../types'
import { getOrderItemLocalTotal, getWizardProductNumber } from './wizardSaleProduct'

export type WizardCartTotals = { quantity: number; eur: number; local: number }

// Sum the server-provided row totals, then round once. Quantity and displayed unit
// prices may differ from the invoiced amount because of discounts and rounding.
export function getWizardCartTotals(items: readonly SalesUkraineOrderItem[], useEurToUah: boolean): WizardCartTotals {
  let quantity = 0
  let eur = 0
  let local = 0
  for (const item of items) {
    quantity += getWizardProductNumber(item.Qty) ?? 0
    eur += getWizardProductNumber(item.TotalAmount) ?? 0
    local += getOrderItemLocalTotal(item, useEurToUah)
  }
  return { quantity, eur: roundMoney(eur), local: roundMoney(local) }
}
