import type { CurrentFinancialFilterConditions } from './currentFinancialFilterConditions'
import { currentFinancialDataset, currentFinancialRequest } from './currentFinancialAxes.test-fixtures'
import type { ReportDataset } from '../types'

export const financialFilterCapability: CurrentFinancialFilterConditions = {
  version: 1, requiredProfitReadMode: 0, requiredDayOrganizationBasis: 0,
  allowedFields: [0, 1, 2, 6, 9], conditions: [0, 1, 2, 4], maximumSelections: 32, maximumValues: 100,
}
export const financialFilterDataset: ReportDataset = { ...currentFinancialDataset, currentFinancialFilterConditions: financialFilterCapability }
export function financialFilterRequest(field = 1, condition = 4, ids = ['9007199254740993']) {
  return { ...currentFinancialRequest([3, 4], []), selections: [{ IsChecked: true,
    SelectedField: { Type: field, Name: financialFilterDataset.Filters.find(item => item.Type === field)?.Name ?? 'Field' },
    FilterCondition: { Type: condition, Name: 'Condition' },
    Values: ids.map(Id => ({ Data: { Id }, Name: `Identity [${Id}]`, Value: 0 })),
  }] }
}
