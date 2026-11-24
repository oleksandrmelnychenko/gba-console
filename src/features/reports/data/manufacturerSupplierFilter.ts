import type { ReportFilterNode, ReportSelection } from '../types'
import { exactId } from './exactId'
import { createFilterExpression, readReportFilterExpression } from './reportFilterExpression'
import { REPORT_FILTER_FIELD_TYPES } from './reportOptions'

export const MAX_MANUFACTURER_LOOKUP_SUPPLIERS = 100
const EMPTY_SUPPLIERS: readonly number[] = []

/** An empty list searches all manufacturers. Null means that no supplier matches the filters. */
export function chosenGoodsSuppliers(
  selections: readonly ReportSelection[], expression?: unknown, suppliersMatchProduct = false,
): readonly number[] | null {
  if (expression != null || suppliersMatchProduct) {
    const tree = expression == null ? createFilterExpression([...selections]) : readReportFilterExpression(expression)
    if (!tree) return EMPTY_SUPPLIERS
    const ids = supplierLookupCandidates(tree.Root, selections) ?? EMPTY_SUPPLIERS
    return ids.length > MAX_MANUFACTURER_LOOKUP_SUPPLIERS ? EMPTY_SUPPLIERS : ids
  }
  const rows = selections.filter(selection => selection.IsChecked !== false && selection.SelectedField.Type === REPORT_FILTER_FIELD_TYPES.supplier
    && selection.Values.length > 0)
  const ids = (selection: ReportSelection) => new Set(selection.Values.flatMap(value => {
    const id = exactId(value.Data)
    return id !== null && Number.isSafeInteger(Number(id)) ? [Number(id)] : []
  }))
  const included = rows.filter(selection => [0, 2].includes(selection.FilterCondition.Type)).map(ids)
  if (!included.length) return EMPTY_SUPPLIERS
  const excluded = new Set(rows.filter(selection => [1, 4].includes(selection.FilterCondition.Type)).flatMap(selection => [...ids(selection)]))
  const chosen = [...included[0]].filter(id => included.every(set => set.has(id)) && !excluded.has(id)).sort((a, b) => a - b)
  return chosen.length ? chosen : null
}

function supplierLookupCandidates(node: ReportFilterNode, selections: readonly ReportSelection[]): readonly number[] | null {
  if (node.Kind === 3) {
    const selection = selections[node.SelectionIndex]
    if (selection?.IsChecked === false) return null
    if (!selection || selection.SelectedField.Type !== REPORT_FILTER_FIELD_TYPES.supplier
      || ![0, 2].includes(selection.FilterCondition.Type)) return EMPTY_SUPPLIERS
    const ids = selection.Values.map(value => Number(exactId(value.Data)))
    return ids.every(id => Number.isSafeInteger(id) && id > 0) ? [...new Set(ids)].sort((a, b) => a - b) : EMPTY_SUPPLIERS
  }

  const children = node.Children.map(child => supplierLookupCandidates(child, selections)).filter(child => child !== null)
  if (!children.length) return null
  // A product may have multiple suppliers. Any mandatory positive branch bounds
  // the catalogue, while negation alone cannot remove a supplier's entire brand.
  if (node.Kind === 1) return children.reduce((tightest, child) =>
    child.length && (!tightest.length || child.length < tightest.length) ? child : tightest, EMPTY_SUPPLIERS)
  // Every OR branch needs a supplier bound before the lookup may omit brands.
  return children.some(child => !child.length) ? EMPTY_SUPPLIERS : [...new Set(children.flat())].sort((a, b) => a - b)
}
