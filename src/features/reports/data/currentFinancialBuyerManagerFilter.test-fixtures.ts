import type { CurrentFinancialBuyerManagerFilter } from './currentFinancialBuyerManagerFilter'
import { FINANCIAL_BUYER_MANAGER_LOOKUP } from './currentFinancialBuyerManagerFilter'
import { currentFinancialDataset, currentFinancialRequest } from './currentFinancialAxes.test-fixtures'
export const managerId = '33221100554477668899AABBCCDDEEFF'
export const unassignedManagerId = '00000000000000000000000000000000'
export const buyerManagerCapability: CurrentFinancialBuyerManagerFilter = {
  version: 1, requiredProfitReadMode: 0, requiredDayOrganizationBasis: 0,
  field: { Type: 60, Name: 'Поточний основний менеджер покупця', Selectable: true }, valueKind: 'buyerManagerRef',
  conditions: [0, 1, 2, 4], lookupPath: FINANCIAL_BUYER_MANAGER_LOOKUP, maximumValues: 100,
}
export const buyerManagerDataset = { ...currentFinancialDataset, currentFinancialBuyerManagerFilter: buyerManagerCapability }
export function buyerManagerRequest(condition = 2, ids = [managerId, unassignedManagerId]) {
  return { ...currentFinancialRequest([3, 4], []), selections: [{ IsChecked: true,
    SelectedField: { Type: 60, Name: 'SourceBuyerManager' }, FilterCondition: { Type: condition, Name: 'Умова' },
    Values: ids.map(Id => ({ Data: { Id }, Name: Id === unassignedManagerId ? 'Без основного менеджера покупця' : 'Менеджер [42]', Value: 0 })),
  }] }
}
