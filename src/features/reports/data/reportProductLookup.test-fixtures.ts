import type { ReportDataset } from '../types'
import type { ProductLookupCapability, ReportProductLookupSource } from './productLookupCapability'
export const reportProductCapability = (dataSource: ReportProductLookupSource): ProductLookupCapability => ({
  dataSource, version: 1, fieldTypes: [1], identityKind: 'positiveInt64String', periodRequired: false,
  supportsNameAndArticleSearch: true, supportsLocalizedNameSearch: true, exactIdParameter: 'exactId', paging: 'offset', maximumPageSize: 50,
})
export const reportProductDataset = (source: ReportProductLookupSource): ReportDataset => ({
  DataSource: source, Name: 'Звіт', Description: 'Довідник товарів звіту.', Limitations: [], Groupings: [{ Type: 5, Name: 'Товар' }],
  Measurements: [{ Type: 0, Name: 'Кількість' }], Filters: [{ Type: 1, Name: 'Товар' }],
  productLookup: reportProductCapability(source),
})
