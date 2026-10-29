import type { ReportSelection } from '../types'
import { customerGroupDirectoryId } from './customerGroupDirectory'
import { reportSelectionCardinalityError } from './reportOptions'
export { customerGroupDirectoryId as customerGroupOrganizationId } from './customerGroupDirectory'

export const isCustomerGroupOrganization = (source: number, field: number) => source === 44 && field === 0
export function customerGroupOrganizationError(source: number, selections: ReportSelection[]): string | null {
  if (source !== 44) return null
  for (const selection of selections) {
    if (selection.IsChecked === false || selection.SelectedField.Type !== 0) continue
    const cardinality = reportSelectionCardinalityError(selection)
    if (cardinality) return cardinality
    if (!selection.Values.length) return 'Оберіть організацію або вимкніть цю умову.'
    if (selection.Values.length > 100 || ![0, 1, 2, 4].includes(selection.FilterCondition.Type))
      return 'Оберіть до 100 організацій і одну з чотирьох умов відбору.'
    if (selection.Values.some(value => customerGroupDirectoryId(value.Data) === null))
      return 'Повторно оберіть організацію: збережений ідентифікатор не підтверджено.'
  }
  return null
}
