import { expect, it } from 'vitest'
import { defaultDatasetRequest } from './reportDatasets'
import { originalClientDiscountsSupported, readClientDiscountRegions } from './originalClientDiscounts'
import { clientDiscountsDataset, clientDiscountsPreview } from './originalClientDiscounts.test-fixtures'
import { normalizeNativeReportPreview } from './nativeReportPreview'

const period = { from: '2026-09-01', to: '2026-09-30' }

it('uses server-owned original defaults for fresh dataset requests without activating an empty filter', () => {
  const request = defaultDatasetRequest(clientDiscountsDataset(), period.from, period.to)
  expect(request.sorted.Col.map(row => row.type)).toEqual([53])
  expect(request.selections.filter(row => row.IsChecked)).toEqual([])
  expect(originalClientDiscountsSupported(clientDiscountsDataset())).toBe(true)
})

it('refuses wrong original hashes', () => {
  const dataset = clientDiscountsDataset()
  dataset.originalClientDiscounts = { ...(dataset.originalClientDiscounts as object), QuerySha256: 'b'.repeat(64) }
  expect(originalClientDiscountsSupported(dataset)).toBe(false)
})

it('binds region values to exact result and page rows and preserves empty text separately from null', () => {
  const value = clientDiscountsPreview().ClientDiscountRecipientRegions
  expect(readClientDiscountRegions(value, 'a'.repeat(64), [12])?.Rows[0].RegionCode).toBe('01')
  expect(() => readClientDiscountRegions(value, 'b'.repeat(64), [12])).toThrow()
  expect(() => readClientDiscountRegions(value, 'a'.repeat(64), [13])).toThrow()
  value.Rows[0].RegionCode = ''
  expect(readClientDiscountRegions(value, 'a'.repeat(64), [12])?.Rows[0].RegionCode).toBe('')
})

it('requires the direct region attribute to belong to the client-discount recipient axis', () => {
  const value = clientDiscountsPreview()
  expect(normalizeNativeReportPreview({ Preview: value }).ClientDiscountRecipientRegions?.Rows[0].RegionCode).toBe('01')
  value.Request.DataSource = 'NativeOneCDiscountMarkup'
  expect(() => normalizeNativeReportPreview({ Preview: value })).toThrow()
})
