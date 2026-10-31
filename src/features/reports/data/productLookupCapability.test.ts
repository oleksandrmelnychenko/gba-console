import { expect, it, vi } from 'vitest'
import { parseReportDatasets } from '../api/reportWorkspaceApi'
import type { ReportDataset } from '../types'
import { purchaseDataset } from './reportDatasets.test-fixtures'
import { productLookupBinding, productLookupCapability, REPORT_PRODUCT_LOOKUP_SOURCES } from './productLookupCapability'
import { reportProductCapability, reportProductDataset } from './reportProductLookup.test-fixtures'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
it.each(REPORT_PRODUCT_LOOKUP_SOURCES)('admits only the explicit product1 capability owned by report%i', source => {
  const dataset = reportProductDataset(source)
  expect(productLookupCapability(dataset, source)).toEqual(reportProductCapability(source))
  expect(productLookupBinding(dataset, source)).toEqual({ kind: 'report', dataSource: source })
})
it.each([
  { productLookup: undefined }, { productLookup: null }, { productLookup: [] },
  { productLookup: { ...reportProductCapability(3), dataSource: 44 } },
  { productLookup: { ...reportProductCapability(3), version: 2 } },
  { productLookup: { ...reportProductCapability(3), fieldTypes: [2] } },
  { productLookup: { ...reportProductCapability(3), extra: true } },
  { productLookup: { ...reportProductCapability(3), supportsLocalizedNameSearch: false } },
  { productLookup: { ...reportProductCapability(3), periodRequired: true } },
  { ProductLookup: reportProductCapability(3) }, { DataSource: 35 },
  { Filters: [{ Type: 1, Name: 'Товар', Selectable: false }] },
  { Filters: undefined }, { Filters: null }, { Filters: [null] },
])('does not infer shared transport from malformed, foreign or absent metadata %j', patch => {
  const dataset = { ...reportProductDataset(3), ...patch } as unknown as ReportDataset
  expect(productLookupCapability(dataset, 3)).toBeNull()
  expect(productLookupBinding(dataset, 3)).toBeNull()
})
it('binds the actual UI source independently of dataset and advertised owner', () => {
  expect(productLookupBinding(reportProductDataset(44), 3)).toBeNull()
  expect(productLookupCapability(reportProductDataset(3), 44)).toBeNull()
})
it('prefers shared source2 while preserving the old P8 binding when new metadata is absent or malformed', () => {
  const shared = reportProductDataset(2)
  const salesProductLookup = { version: 1, fieldTypes: [1], identityKind: 'positiveInt64String', periodRequired: false,
    supportsNameAndArticleSearch: true, exactIdParameter: 'exactId', paging: 'offset', maximumPageSize: 50 }
  const dataset = { ...shared, salesProductLookup }
  expect(productLookupBinding(dataset, 2)?.kind).toBe('report')
  expect(productLookupBinding({ ...dataset, productLookup: undefined }, 2)).toEqual({ kind: 'sales', dataSource: 2 })
  expect(productLookupBinding({ ...dataset, productLookup: { version: 99 } }, 2)).toEqual({ kind: 'sales', dataSource: 2 })
})
it.each([reportProductCapability(3), { version: 2 }, null])('retains optional new metadata through the real dataset parser without rejecting the legacy report %j', productLookup => {
  const [parsed] = parseReportDatasets([{ ...purchaseDataset, productLookup }])
  expect(parsed.DataSource).toBe(3)
  expect(parsed.productLookup).toEqual(productLookup)
  expect(productLookupCapability(parsed, 3) !== null).toBe(productLookup?.version === 1)
})
