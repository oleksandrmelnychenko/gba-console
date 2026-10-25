import { expect, it } from 'vitest'
import type { SalesUkraineOrderItem } from '../../types'
import type { WizardSaleProduct } from './wizardSaleProduct'
import { getWizardCartTotals } from './wizardCartTotals'

it('sums invoiced amounts and rounds once, using the selected local-currency source', () => {
  const items: SalesUkraineOrderItem[] = [
    { Qty: 1.25, TotalAmount: 0.105, TotalAmountLocal: 4.005, TotalAmountEurToUah: 7.005, Product: { CurrentPrice: 100 } as WizardSaleProduct },
    { Qty: 2, TotalAmount: 0.105, TotalAmountLocal: 4.005, TotalAmountEurToUah: 7.005 },
  ]
  expect(getWizardCartTotals(items, false)).toEqual({ quantity: 3.25, eur: 0.21, local: 8.01 })
  expect(getWizardCartTotals(items, true)).toEqual({ quantity: 3.25, eur: 0.21, local: 14.01 })
})

it('handles empty and incomplete positions without substituting another currency total', () => {
  expect(getWizardCartTotals([], false)).toEqual({ quantity: 0, eur: 0, local: 0 })
  expect(getWizardCartTotals([{ Qty: NaN, TotalAmount: Infinity, TotalAmountLocal: 42 }], true))
    .toEqual({ quantity: 0, eur: 0, local: 0 })
})
