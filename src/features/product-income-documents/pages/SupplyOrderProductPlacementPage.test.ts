import { describe, expect, it } from 'vitest'
import { mapSupplyPlacementRows } from '../supplyOrderProductPlacementRows'
import type { ProductIncomeItem } from '../types'

describe('SupplyOrderProductPlacementPage helpers', () => {
  it('maps Ukraine supply order VAT values into placement rows', () => {
    const [row] = mapSupplyPlacementRows([
      {
        SupplyOrderUkraineItem: {
          GrossPriceLocal: 120,
          NetPriceLocal: 100,
          Product: {
            Name: 'Ukraine product',
            VendorCode: 'UK-100',
          },
          VatAmountLocal: 20,
          VatPercent: 20,
        },
      },
    ] satisfies ProductIncomeItem[])

    expect(row).toMatchObject({
      productName: 'Ukraine product',
      total: 120,
      totalNetPrice: 100,
      vatAmount: 20,
      vatPercent: 20,
      vendorCode: 'UK-100',
    })
  })
})
