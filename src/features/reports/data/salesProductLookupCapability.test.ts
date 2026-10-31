import { expect, it } from 'vitest'
import { positiveProductId, salesProductLookupCapability } from './salesProductLookupCapability'
import type { ReportDataset } from '../types'
export const productCapability = {
  version: 1,
  fieldTypes: [1],
  identityKind: 'positiveInt64String',
  periodRequired: false,
  supportsNameAndArticleSearch: true,
  exactIdParameter: 'exactId',
  paging: 'offset',
  maximumPageSize: 50,
}
export const productDataset = {
  DataSource: 2,
  Filters: [{ Type: 1, Name: 'Товар' }],
  salesProductLookup: productCapability,
} as ReportDataset
it('admits only the complete source2 contract and selectable product field', () => {
  expect(salesProductLookupCapability(productDataset)).toEqual(productCapability)
  for (const patch of [
    { DataSource: 44 },
    { salesProductLookup: { ...productCapability, version: 2 } },
    { salesProductLookup: { ...productCapability, extra: true } },
    { Filters: [{ Type: 1, Name: 'Товар', Selectable: false }] },
    { salesProductLookup: null },
  ])
    expect(salesProductLookupCapability({ ...productDataset, ...patch })).toBeNull()
})
it.each(['1', '9007199254740993', '9223372036854775807'])('keeps exact canonical ID %s', (id) =>
  expect(positiveProductId(id)).toBe(true),
)
it.each(['', '0', '01', '+1', '-1', '1 ', '١', '1e3', '9223372036854775808'])('rejects noncanonical ID %s', (id) =>
  expect(positiveProductId(id)).toBe(false),
)

it.each([undefined, null, {}, [null], [undefined]])('rejects malformed Filters without throwing: %j', (Filters) => {
  expect(salesProductLookupCapability({ ...productDataset, Filters } as unknown as ReportDataset)).toBeNull()
})
