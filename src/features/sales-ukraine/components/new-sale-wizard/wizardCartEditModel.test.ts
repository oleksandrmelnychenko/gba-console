import { describe, expect, it } from 'vitest'
import { getCurrentCartEditRows, getSplitCartEditRows, getWizardCartEditTotals } from './wizardCartEditModel'
import type { WizardSplitOrderItem } from './wizardSplitSale'

const item: WizardSplitOrderItem = {
  Product: { NameUA: 'Товар', Name: 'Fallback', Articul: 'A-1', CurrentPrice: 2, CurrentPriceEurToUah: 80 },
  Qty: 1.125, TotalAmount: 2.25, TotalAmountEurToUah: 90, TotalAmountLocal: 100,
  Discount: 15, OneTimeDiscount: 3, Comment: 'Note', User: { LastName: 'User' },
}

describe('cart edit display model', () => {
  it('preserves distinct current and split discounts and uses EUR-to-UAH totals', () => {
    expect(getCurrentCartEditRows([item])[0]).toMatchObject({
      index: 0, name: 'Товар', vendorCode: 'A-1', comment: 'Note', user: 'User',
      qty: 1.125, price: 2, localPrice: 80, totalAmount: 2.25, amountLocal: 90, discount: 15, oneTimeDiscount: 3,
    })
    expect(getSplitCartEditRows([item])[0]).toMatchObject({ discount: 3, oneTimeDiscount: 3, amountLocal: 90 })
    expect(item.Discount).toBe(15)
  })

  it('numbers identical product rows independently and keeps missing fields safe', () => {
    const rows = getCurrentCartEditRows([{}, {}, item, item])
    expect(rows.map((row) => row.index)).toEqual([0, 1, 2, 3])
    expect(rows[0]).toMatchObject({ name: '', qty: 0, price: 0, amountLocal: 0, totalAmount: 0 })
    expect(rows[2]).not.toBe(rows[3])
  })

  it('sums fractional quantities and rounds money only after aggregating', () => {
    const rows = getCurrentCartEditRows([
      { Qty: 0.125, TotalAmount: 0.004, TotalAmountEurToUah: 0.104 },
      { Qty: 0.125, TotalAmount: 0.004, TotalAmountEurToUah: 0.104 },
    ])
    expect(getWizardCartEditTotals(rows)).toEqual({ totalQty: 0.25, totalAmount: 0.01, totalAmountLocal: 0.21 })
    expect(getWizardCartEditTotals([])).toEqual({ totalQty: 0, totalAmount: 0, totalAmountLocal: 0 })
  })
})
