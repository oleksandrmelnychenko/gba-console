import type { ReportDataset, ReportSelection } from '../types'
import { customerGroupTopName } from './customerGroupTop'
import { customerGroupInt64Id } from './customerGroupInt64'
import { customerGroupDirectoryId } from './customerGroupDirectory'
import { reportSelectionCardinalityError } from './reportOptions'
import { datasetFieldHierarchy, datasetGroupSelectionError, isGroupConditionType } from './reportHierarchyFilters'
import { customerGroupSalesDocumentLookup } from './salesDocumentLookupCapability'
const EXACT_FIELDS = new Set([1, 4, 8, 9, 10, 15, 16, 21])
const VALIDATED_FIELDS = new Set([1, 3, 4, 8, 9, 10, 12, 14, 15, 16, 21])
const DOCUMENT_FIELDS = new Set([12, 14])
const INT64_FIELDS = new Set([4, 9, 12, 14, 15, 16, 21])
const FLAT_CONDITIONS = new Set([0, 1, 2, 4])
export type CustomerGroupExactChoiceField = 1 | 4 | 8 | 9 | 10 | 15 | 16 | 21
export const isCustomerGroupExactSelection = (source: number, field: number): field is CustomerGroupExactChoiceField => source === 44 && EXACT_FIELDS.has(field)
export const CUSTOMER_GROUP_CURRENT_FIELDS_NOTE = 'Регіон, код регіону та основний менеджер у відборах — поточні дані картки клієнта; їх зміна впливає і на минулі періоди.'
export const CUSTOMER_GROUP_MANAGER_NOTE = 'Основний менеджер із поточної картки клієнта, а не автор продажу.'
export function customerGroupConditionTypes(dataset: ReportDataset | undefined | null, field: number): number[] {
  return field === 1 && dataset?.DataSource === 44 && datasetFieldHierarchy(dataset, field)
    ? [0, 1, 2, 3, 4, 5, 6, 7] : [0, 1, 2, 4]
}
export function customerGroupSelectionsError(source: number | undefined, selections: ReportSelection[], dataset?: ReportDataset | null): string | null {
  if (source !== 44) return null
  for (const selection of selections) {
    const field = selection.SelectedField.Type
    if (selection.IsChecked === false || !VALIDATED_FIELDS.has(field)) continue
    if (DOCUMENT_FIELDS.has(field) && !customerGroupSalesDocumentLookup(dataset))
      return 'Сервер не підтвердив довідник документів для порівняння клієнтів. Збережений відбір залишено без змін.'
    if (field === 1 && isGroupConditionType(selection.FilterCondition.Type) && datasetFieldHierarchy(dataset, field)) {
      if (!selection.Values.length) return 'Оберіть значення або вимкніть цю умову.'
      const error = datasetGroupSelectionError(dataset, selection)
      if (error) return error
      continue
    }
    if (field === 1 && datasetFieldHierarchy(dataset, field)) {
      const error = datasetGroupSelectionError(dataset, selection)
      if (error) return error
    }
    // Product equality already supports a saved exact set; do not narrow this existing financial contract.
    const cardinality = field === 1 ? null : reportSelectionCardinalityError(selection)
    if (cardinality) return cardinality
    if (!selection.Values.length) return 'Оберіть значення або вимкніть цю умову.'
    if (selection.Values.length > 100 || !FLAT_CONDITIONS.has(selection.FilterCondition.Type))
      return 'Оберіть до 100 значень і одну з чотирьох умов відбору.'
    if (selection.Values.some(value => (field === 3 ? customerGroupTopName(value.Data) : INT64_FIELDS.has(field) ? customerGroupInt64Id(value.Data) : customerGroupDirectoryId(value.Data)) === null))
      return field === 3 ? 'Повторно оберіть TOP: збережений код не підтверджено.' : 'Повторно оберіть значення: збережений ідентифікатор не підтверджено.'
  }
  return null
}
export function customerGroupProductQueryError(query: string): string | null {
  if (!query.startsWith('id:')) return null
  const token = query.slice(3)
  return /^[1-9]\d*$/.test(token) && Number.isSafeInteger(Number(token))
    ? null : 'Вкажіть точний ID товару у форматі id:123 без пробілів, дробів або початкових нулів.'
}
