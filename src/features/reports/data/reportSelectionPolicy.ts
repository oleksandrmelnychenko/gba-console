import type { ReportDataset, ReportRequestBody, ReportSelection } from '../types'
import { customerGroupConditionTypes } from './customerGroupSelections'
import { financialFilterConditionTypes } from './currentFinancialFilterConditions'
import { reportSelectionCardinalityError } from './reportOptions'
import { isNativePriceFilterField } from './nativePriceFilterLookup'
import { isReturnItemStatusSelection } from './returnItemStatuses'

/** Shared by modal and inline editors: preserve each source's advertised condition contract. */
export function reportSelectionConditions(source: number, dataset: ReportDataset | null | undefined,
  request: ReportRequestBody | undefined, field: number | undefined): Set<number> | null {
  if (isNativePriceFilterField(source, field ?? -1)) return new Set([0, 1, 2, 4])
  if ([2, 3, 45, 46].includes(source)) return new Set([0, 1, 2, 4])
  if (source === 35) return new Set(financialFilterConditionTypes(dataset ?? undefined, request, field))
  if (source === 44) return new Set(customerGroupConditionTypes(dataset, field ?? -1))
  return null
}

export function reportSelectionEditorCardinalityError(source: number, request: ReportRequestBody | undefined,
  selection: ReportSelection): string | null {
  if (isReturnItemStatusSelection(request, selection.SelectedField.Type)) return null
  // Source44 Product equality already accepts a saved exact set; its source validator checks that set.
  if (source === 44 && selection.SelectedField.Type === 1) return null
  return reportSelectionCardinalityError(selection)
}
