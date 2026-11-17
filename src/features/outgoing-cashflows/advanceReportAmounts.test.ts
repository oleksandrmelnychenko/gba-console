import { describe, expect, it } from 'vitest'
import {
  calculateAdvanceReportDifference,
  calculateAdvanceReportTotals,
  getFuelAmountFieldValues,
  keepIssuedAdvanceAmounts,
} from './advanceReportAmounts'
import type { AdvanceReportOrder } from './advanceReportTypes'

describe('advance report amounts', () => {
  const issued: AdvanceReportOrder = {
    Amount: 3000,
    CompanyCarFuelings: [],
    DifferenceAmount: -3000,
    NetUid: 'order-1',
  }

  it('keeps the issued amount when the line calculation answers with the line sum', () => {
    // POST …/advanced-reports/edit/calculate answers with Amount = sum of lines.
    const calculated: AdvanceReportOrder = {
      ...issued,
      Amount: 1665,
      CompanyCarFuelings: [{ Id: 0, TotalPriceWithVat: 1665, VatAmount: 277.5 }],
    }

    const order = keepIssuedAdvanceAmounts(calculated, issued)

    expect(order.Amount).toBe(3000)
    expect(order.DifferenceAmount).toBe(-3000)
    expect(calculateAdvanceReportTotals(order)).toEqual({ total: 1665, totalVat: 277.5 })
  })

  it('recalculates the difference as reported − issued after every line change', () => {
    const difference = (reportTotal: number) =>
      calculateAdvanceReportDifference({
        loadedDifference: -3000,
        loadedReportTotal: 0,
        orderAmount: 3000,
        reportTotal,
      })

    expect(difference(0)).toBe(-3000)
    expect(difference(1665)).toBe(-1335)
    expect(difference(3000)).toBe(0)
    expect(difference(3200.1)).toBe(200.1)
  })

  it('keeps the settling orders of an already filed report in the difference', () => {
    // 3 000 issued, 1 665 reported, 1 335 returned by an income order: settled.
    expect(
      calculateAdvanceReportDifference({
        loadedDifference: 0,
        loadedReportTotal: 1665,
        orderAmount: 3000,
        reportTotal: 1665,
      }),
    ).toBe(0)
    // One more line of 100 on top of it: the colleague is owed 100.
    expect(
      calculateAdvanceReportDifference({
        loadedDifference: 0,
        loadedReportTotal: 1665,
        orderAmount: 3000,
        reportTotal: 1765,
      }),
    ).toBe(100)
  })

  it('falls back to reported − issued when the stored difference is absent', () => {
    expect(
      calculateAdvanceReportDifference({
        loadedDifference: undefined,
        loadedReportTotal: 0,
        orderAmount: 100,
        reportTotal: 40,
      }),
    ).toBe(-60)
  })

  it('skips deleted lines in the report total', () => {
    expect(
      calculateAdvanceReportTotals({
        CompanyCarFuelings: [
          { Id: 1, TotalPriceWithVat: 100, VatAmount: 20 },
          { Deleted: true, Id: 2, TotalPriceWithVat: 50, VatAmount: 10 },
        ],
        OutcomePaymentOrderConsumablesOrders: [
          {
            ConsumablesOrder: {
              ConsumablesOrderItems: [
                { TotalPriceWithVAT: 10.1, VAT: 1.1 },
                { Deleted: true, TotalPriceWithVAT: 99, VAT: 9 },
              ],
            },
          },
        ],
      }),
    ).toEqual({ total: 110.1, totalVat: 21.1 })
  })

  it('shows the derived total in the fuel form when the price per litre was typed', () => {
    // 30 l × 55,50: the form keeps only the typed price, the total is derived.
    expect(
      getFuelAmountFieldValues(
        { pricePerLiter: 55.5, totalPriceWithVat: 0, vatAmount: 0 },
        { PricePerLiter: 55.5, TotalPriceWithVat: 1665, VatAmount: 277.5 },
      ),
    ).toEqual({ pricePerLiter: 55.5, totalPriceWithVat: 1665, vatAmount: 277.5 })
  })

  it('shows the derived price in the fuel form when the total was typed', () => {
    expect(
      getFuelAmountFieldValues(
        { pricePerLiter: 0, totalPriceWithVat: 1665, vatAmount: 100 },
        { PricePerLiter: 55.5, TotalPriceWithVat: 1665, VatAmount: 100 },
      ),
    ).toEqual({ pricePerLiter: 55.5, totalPriceWithVat: 1665, vatAmount: 100 })
  })
})
