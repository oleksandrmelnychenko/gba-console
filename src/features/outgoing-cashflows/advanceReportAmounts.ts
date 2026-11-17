import type { AdvanceReportOrder, CompanyCarFueling } from './advanceReportTypes'

export type AdvanceReportTotals = { total: number; totalVat: number }

/** Sum of the report lines (fuel and goods / services), deleted lines excluded. */
export function calculateAdvanceReportTotals(order: AdvanceReportOrder | null): AdvanceReportTotals {
  if (!order) {
    return { total: 0, totalVat: 0 }
  }

  let total = 0
  let totalVat = 0

  for (const fueling of order.CompanyCarFuelings || []) {
    if (!fueling.Deleted) {
      total += fueling.TotalPriceWithVat || 0
      totalVat += fueling.VatAmount || 0
    }
  }

  for (const entry of order.OutcomePaymentOrderConsumablesOrders || []) {
    for (const item of entry.ConsumablesOrder?.ConsumablesOrderItems || []) {
      if (!item.Deleted) {
        total += item.TotalPriceWithVAT || 0
        totalVat += item.VAT || 0
      }
    }
  }

  return { total: roundMoney(total), totalVat: roundMoney(totalVat) }
}

/**
 * The line calculation answers with `Amount` = sum of the report lines. The
 * order's own `Amount` is the money issued under report and `DifferenceAmount`
 * is the stored balance of the advance, so both stay as they were loaded.
 */
export function keepIssuedAdvanceAmounts(
  calculated: AdvanceReportOrder,
  source: AdvanceReportOrder,
): AdvanceReportOrder {
  return {
    ...calculated,
    Amount: source.Amount,
    DifferenceAmount: source.DifferenceAmount,
  }
}

/**
 * Balance of the advance with the server's sign: reported − issued, so a
 * negative value is money the colleague still owes.
 *
 * The loaded balance already counts the saved lines and the orders that
 * settled the advance (returns and extra payouts), so only the change of the
 * line total since loading is added to it.
 */
export function calculateAdvanceReportDifference({
  loadedDifference,
  loadedReportTotal,
  orderAmount,
  reportTotal,
}: {
  loadedDifference: number | null | undefined
  loadedReportTotal: number
  orderAmount: number
  reportTotal: number
}): number {
  if (typeof loadedDifference === 'number' && Number.isFinite(loadedDifference)) {
    return roundMoney(loadedDifference + reportTotal - loadedReportTotal)
  }

  return roundMoney(reportTotal - orderAmount)
}

/**
 * The fuel form keeps only the amount the user typed (price per litre or the
 * total) and zeroes the other one; the other field shows the derived value.
 */
export function getFuelAmountFieldValues(
  form: { pricePerLiter: number; totalPriceWithVat: number },
  preview: Pick<CompanyCarFueling, 'PricePerLiter' | 'TotalPriceWithVat'>,
): { pricePerLiter: number; totalPriceWithVat: number } {
  return {
    pricePerLiter: form.pricePerLiter || preview.PricePerLiter || 0,
    totalPriceWithVat: form.totalPriceWithVat || preview.TotalPriceWithVat || 0,
  }
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
