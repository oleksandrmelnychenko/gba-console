import type { ReportDataset } from '../types'

export type SalesDocumentLookupCapability = {
  version: 1; fieldTypes: [12, 14]; periodRequired: true; identityKind: 'positiveInt64String'
}
export function customerGroupSalesDocumentLookup(dataset: ReportDataset | undefined | null): SalesDocumentLookupCapability | null {
  const value = dataset?.salesDocumentLookup
  if (dataset?.DataSource !== 44 || !value || typeof value !== 'object' || Array.isArray(value)) return null
  const cap = value as Record<string, unknown>
  return Object.keys(cap).sort().join(',') === 'fieldTypes,identityKind,periodRequired,version'
    && cap.version === 1 && cap.periodRequired === true && cap.identityKind === 'positiveInt64String'
    && Array.isArray(cap.fieldTypes) && cap.fieldTypes.length === 2 && cap.fieldTypes[0] === 12 && cap.fieldTypes[1] === 14
    && Array.isArray(dataset.Filters) && [12, 14].every(type => dataset.Filters.some(field => field.Type === type && field.Selectable !== false))
    ? value as SalesDocumentLookupCapability : null
}
