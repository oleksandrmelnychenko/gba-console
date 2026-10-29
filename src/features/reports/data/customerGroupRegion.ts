import type { ReportSelection } from '../types'
import { customerGroupDirectoryId } from './customerGroupDirectory'
import { reportSelectionCardinalityError } from './reportOptions'
export const isCustomerGroupRegion = (source: number, field: number) => source === 44 && field === 7
export const CUSTOMER_GROUP_REGION_NOTE = 'Відбір використовує поточний регіон у картці клієнта; його зміна впливає й на звіти за минулі періоди.'
export function customerGroupRegionError(source: number, selections: ReportSelection[]): string | null {
  if (source !== 44) return null
  for (const selection of selections) {
    if (selection.IsChecked === false || selection.SelectedField.Type !== 7) continue
    const cardinality = reportSelectionCardinalityError(selection)
    if (cardinality) return cardinality
    if (!selection.Values.length) return 'Оберіть регіон клієнта або вимкніть цю умову.'
    if (selection.Values.length > 100 || ![0, 1, 2, 4].includes(selection.FilterCondition.Type))
      return 'Оберіть до 100 регіонів клієнта і одну з чотирьох умов відбору.'
    if (selection.Values.some(value => customerGroupDirectoryId(value.Data) === null))
      return 'Повторно оберіть регіон клієнта: збережений ідентифікатор не підтверджено.'
  }
  return null
}
