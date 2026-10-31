import type { ReportDataset } from '../types'

export type SalesProductLookupCapability = {
  version: 1
  fieldTypes: [1]
  identityKind: 'positiveInt64String'
  periodRequired: false
  supportsNameAndArticleSearch: true
  exactIdParameter: 'exactId'
  paging: 'offset'
  maximumPageSize: 50
}
export function salesProductLookupCapability(
  dataset: ReportDataset | undefined | null,
): SalesProductLookupCapability | null {
  const value = dataset?.salesProductLookup
  if (dataset?.DataSource !== 2 || !value || typeof value !== 'object' || Array.isArray(value)) return null
  const cap = value as Record<string, unknown>
  return Object.keys(cap).sort().join(',') ===
    'exactIdParameter,fieldTypes,identityKind,maximumPageSize,paging,periodRequired,supportsNameAndArticleSearch,version' &&
    cap.version === 1 &&
    cap.identityKind === 'positiveInt64String' &&
    cap.periodRequired === false &&
    cap.supportsNameAndArticleSearch === true &&
    cap.exactIdParameter === 'exactId' &&
    cap.paging === 'offset' &&
    cap.maximumPageSize === 50 &&
    Array.isArray(cap.fieldTypes) &&
    cap.fieldTypes.length === 1 &&
    cap.fieldTypes[0] === 1 &&
    Array.isArray(dataset.Filters) &&
    dataset.Filters.some((field) => field?.Type === 1 && field.Selectable !== false)
    ? (value as SalesProductLookupCapability)
    : null
}
export function positiveProductId(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9][0-9]{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n
}
