import { describe, expect, it } from 'vitest'
import { calculateConsumableOrderItemTotals } from './consumableOrderCalculations'

describe('consumable order calculations', () => {
  it('treats price per item as VAT-inclusive amount like the server', () => {
    expect(
      calculateConsumableOrderItemTotals({
        PricePerItem: 100,
        Qty: 2,
        VatPercent: 20,
      }),
    ).toEqual({
      PricePerItem: 100,
      Qty: 2,
      TotalPrice: 166.67,
      TotalPriceWithVAT: 200,
      VAT: 33.33,
      VatPercent: 20,
    })
  })

  it('backs VAT out from total-with-VAT input', () => {
    expect(
      calculateConsumableOrderItemTotals({
        Qty: 2,
        TotalPriceWithVAT: 240,
        VatPercent: 20,
      }),
    ).toEqual({
      PricePerItem: 0,
      Qty: 2,
      TotalPrice: 200,
      TotalPriceWithVAT: 240,
      VAT: 40,
      VatPercent: 20,
    })
  })

  it('preserves explicit VAT when percent is missing', () => {
    expect(
      calculateConsumableOrderItemTotals({
        Qty: 1,
        TotalPriceWithVAT: 120,
        VAT: 20,
      }),
    ).toEqual({
      PricePerItem: 0,
      Qty: 1,
      TotalPrice: 100,
      TotalPriceWithVAT: 120,
      VAT: 20,
      VatPercent: 20,
    })
  })
})
