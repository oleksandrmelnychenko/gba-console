import wire from './customerGroupSelections.server-fixture.json'
import type { ReportDataset } from '../types'
import { ANALYSIS_GROUPS_ENDPOINT, ANALYSIS_HIERARCHY_STATUS_ENDPOINT, type AnalysisHierarchy } from './currentVparivanieAnalysis'

export const customerProductHierarchy: AnalysisHierarchy = {
  version: 1, groupKind: 'productGroup', itemKind: 'product', itemField: 1,
  groupConditions: [3, 5, 6, 7], mixedConditions: [3, 5], source: 'Товарні групи GBA (дерево груп номенклатури)',
  browseEndpoint: ANALYSIS_GROUPS_ENDPOINT, maximumPageSize: 50, statusEndpoint: ANALYSIS_HIERARCHY_STATUS_ENDPOINT,
}
export const customerCommonFieldsDataset: ReportDataset = {
  ...(wire.dataset as ReportDataset),
  Groupings: [...wire.dataset.Groupings, { Type: 17, Name: 'Документ продажу' }, { Type: 19, Name: 'Ввів документ' },
    { Type: 20, Name: 'Провів документ' }, { Type: 21, Name: 'Постачальник' }],
  Filters: [...wire.dataset.Filters.map(field => field.Type === 1 ? { ...field, hierarchy: customerProductHierarchy } : field),
    { Type: 12, Name: 'Документ продажу' }, { Type: 14, Name: 'Повернення від клієнта' },
    { Type: 15, Name: 'Ввів документ' }, { Type: 16, Name: 'Провів документ' }],
  configuration: { ...wire.dataset.configuration, allowedRows: [...wire.dataset.configuration.allowedRows, 17, 19, 20, 21] },
  salesDocumentLookup: { version: 1, fieldTypes: [12, 14], periodRequired: true, identityKind: 'positiveInt64String' },
}
