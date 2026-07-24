import type { ReorderSuggestion } from './procurementTypes'

export type ProcurementDraftQuantities = Record<string, number>

export function procurementLineKey(row: ReorderSuggestion): string {
  return `${row.producer_id}:${row.product_id}`
}

export function getProcurementDraftQuantity(
  draftQty: ProcurementDraftQuantities,
  row: ReorderSuggestion,
): number | undefined {
  const compositeValue = draftQty[procurementLineKey(row)]

  if (typeof compositeValue === 'number') {
    return compositeValue
  }

  // Sessions saved before composite line keys used only product_id. Keep them
  // readable, but all new edits are stored with producer_id + product_id.
  const legacyValue = draftQty[String(row.product_id)]

  return typeof legacyValue === 'number' ? legacyValue : undefined
}

export function getProcurementOrderQuantity(
  draftQty: ProcurementDraftQuantities,
  row: ReorderSuggestion,
): number {
  return getProcurementDraftQuantity(draftQty, row) ?? row.suggested_qty
}

export function filterProcurementRows(
  rows: ReorderSuggestion[],
  query: string,
): ReorderSuggestion[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('uk-UA')

  if (!normalizedQuery) {
    return rows
  }

  return rows.filter((row) =>
    [
      row.product_id,
      row.product_name,
      row.vendor_code,
      row.oe_number,
      row.producer_id,
      row.producer_name,
      row.quadrant,
    ].some((value) =>
      value === null || value === undefined
        ? false
        : String(value).toLocaleLowerCase('uk-UA').includes(normalizedQuery),
    ),
  )
}
