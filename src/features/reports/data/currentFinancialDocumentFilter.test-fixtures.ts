import type { CurrentFinancialDocumentFilter } from './currentFinancialDocumentFilter'
import { FINANCIAL_DOCUMENT_LOOKUP } from './currentFinancialDocumentFilter'
import { currentFinancialDataset, currentFinancialRequest } from './currentFinancialAxes.test-fixtures'
export const documentFilterCapability: CurrentFinancialDocumentFilter = {
  version: 1, requiredProfitReadMode: 0, requiredDayOrganizationBasis: 0,
  field: { Type: 12, Name: 'Документ', Selectable: true }, valueKind: 'documentRef',
  conditions: [0, 1, 2, 4], lookupPath: FINANCIAL_DOCUMENT_LOOKUP, maximumValues: 100,
}
export const documentFilterDataset = { ...currentFinancialDataset, currentFinancialDocumentFilter: documentFilterCapability }
export function documentFilterRequest(condition = 2, references = [{ kind: 'sale', id: '9007199254740993' }, { kind: 'return', id: '9007199254740993' }]) {
  return { ...currentFinancialRequest([3, 4], []), selections: [{ IsChecked: true,
    SelectedField: { Type: 12, Name: 'SaleDocument' }, FilterCondition: { Type: condition, Name: 'Умова' },
    Values: references.map(Data => ({ Data, Name: `${Data.kind} [${Data.id}]`, Value: 0 })),
  }] }
}
