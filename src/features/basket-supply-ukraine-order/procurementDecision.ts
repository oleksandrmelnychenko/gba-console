import type { ReorderSuggestion } from './procurementTypes'

export type ProcurementDecision = {
  arrivalPosition: number
  isArrivalRisk: boolean
  leadDemand: number
  leadTimeDays: number | null
  orderUpTo: number
  selectedCostEur: number | null
  stockoutDays: number | null
}

export function calculateProcurementDecision(
  row: ReorderSuggestion,
  selectedQty: number,
): ProcurementDecision {
  const meanDaily = Math.max(0, row.forecast.mean_daily)
  const leadDemand = row.lead_demand ?? Math.max(0, row.reorder_point - row.safety_stock)
  const orderUpTo = row.order_up_to ?? row.reorder_point + row.suggested_qty
  const leadTimeDays = meanDaily > 0 ? Math.max(0, Math.round(leadDemand / meanDaily)) : null
  const stockoutDays = meanDaily > 0
    ? Math.max(0, Math.round(Math.max(0, row.inventory.position) / meanDaily))
    : null

  return {
    arrivalPosition: row.inventory.position + selectedQty,
    isArrivalRisk:
      stockoutDays !== null
      && leadTimeDays !== null
      && stockoutDays <= leadTimeDays,
    leadDemand,
    leadTimeDays,
    orderUpTo,
    selectedCostEur:
      row.unit_cost_eur === null
        ? null
        : Math.max(0, selectedQty) * row.unit_cost_eur,
    stockoutDays,
  }
}
