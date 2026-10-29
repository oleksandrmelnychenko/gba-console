import type { ReportSelection } from '../types'
import { customerGroupDirectoryId } from './customerGroupDirectory'
import { reportSelectionCardinalityError } from './reportOptions'
export const isCustomerGroupExactSelection = (source: number, field: number) => source === 44 && [1, 8, 10].includes(field)
export const CUSTOMER_GROUP_CURRENT_FIELDS_NOTE = 'Регіон, код регіону та основний менеджер у відборах — поточні дані картки клієнта; їх зміна впливає і на минулі періоди.'
export const CUSTOMER_GROUP_MANAGER_NOTE = 'Основний менеджер із поточної картки клієнта, а не автор продажу.'
export function customerGroupSelectionsError(source: number, selections: ReportSelection[]): string | null {
  if (source !== 44) return null
  for (const selection of selections) {
    const field = selection.SelectedField.Type
    if (selection.IsChecked === false || ![1, 8, 10].includes(field)) continue
    // Product equality already supports a saved exact set; do not narrow this existing financial contract.
    const cardinality = field === 1 ? null : reportSelectionCardinalityError(selection)
    if (cardinality) return cardinality
    if (!selection.Values.length) return 'Оберіть значення або вимкніть цю умову.'
    if (selection.Values.length > 100 || ![0, 1, 2, 4].includes(selection.FilterCondition.Type))
      return 'Оберіть до 100 значень і одну з чотирьох умов відбору.'
    if (selection.Values.some(value => customerGroupDirectoryId(value.Data) === null))
      return 'Повторно оберіть значення: збережений ідентифікатор не підтверджено.'
  }
  return null
}
export function customerGroupProductQueryError(query: string): string | null {
  if (!query.startsWith('id:')) return null
  const token = query.slice(3)
  return /^[1-9]\d*$/.test(token) && Number.isSafeInteger(Number(token))
    ? null : 'Вкажіть точний ID товару у форматі id:123 без пробілів, дробів або початкових нулів.'
}
