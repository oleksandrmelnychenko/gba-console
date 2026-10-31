import type { ReportDataset } from '../types'
import { salesProductLookupCapability } from './salesProductLookupCapability'

export const REPORT_PRODUCT_LOOKUP_SOURCES = [2, 3, 44, 45, 46] as const
export type ReportProductLookupSource = typeof REPORT_PRODUCT_LOOKUP_SOURCES[number]
export type ProductLookupCapability = {
  dataSource: ReportProductLookupSource
  version: 1
  fieldTypes: [1]
  identityKind: 'positiveInt64String'
  periodRequired: false
  supportsNameAndArticleSearch: true
  supportsLocalizedNameSearch: true
  exactIdParameter: 'exactId'
  paging: 'offset'
  maximumPageSize: 50
}
export type ProductLookupBinding = { kind: 'report'; dataSource: ReportProductLookupSource } | { kind: 'sales'; dataSource: 2 }
const keys = 'dataSource,exactIdParameter,fieldTypes,identityKind,maximumPageSize,paging,periodRequired,supportsLocalizedNameSearch,supportsNameAndArticleSearch,version'
export function isReportProductLookupSource(value: unknown): value is ReportProductLookupSource {
  return typeof value === 'number' && REPORT_PRODUCT_LOOKUP_SOURCES.includes(value as ReportProductLookupSource)
}
function supportsIdentityAndSearch(cap: Record<string, unknown>): boolean {
  return cap.identityKind === 'positiveInt64String' && cap.periodRequired === false
    && cap.supportsNameAndArticleSearch === true && cap.supportsLocalizedNameSearch === true
    && cap.exactIdParameter === 'exactId'
}
export function productLookupCapability(dataset: ReportDataset | undefined | null, requestedSource = dataset?.DataSource): ProductLookupCapability | null {
  if (!dataset || !isReportProductLookupSource(requestedSource) || dataset.DataSource !== requestedSource
    || Object.hasOwn(dataset, 'ProductLookup')) return null
  const value = dataset.productLookup
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const cap = value as Record<string, unknown>
  if (Object.keys(cap).sort().join(',') !== keys || cap.version !== 1 || cap.dataSource !== requestedSource
    || cap.paging !== 'offset' || cap.maximumPageSize !== 50 || !supportsIdentityAndSearch(cap)) return null
  if (!Array.isArray(cap.fieldTypes) || cap.fieldTypes.length !== 1 || cap.fieldTypes[0] !== 1
    || !Array.isArray(dataset.Filters) || !dataset.Filters.some(field => field?.Type === 1 && field.Selectable !== false)) return null
  return value as ProductLookupCapability
}
export function productLookupBinding(dataset: ReportDataset | undefined | null, requestedSource = dataset?.DataSource): ProductLookupBinding | null {
  const shared = productLookupCapability(dataset, requestedSource)
  if (shared) return { kind: 'report', dataSource: shared.dataSource }
  return requestedSource === 2 && dataset?.DataSource === 2 && salesProductLookupCapability(dataset)
    ? { kind: 'sales', dataSource: 2 } : null
}
