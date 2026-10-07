import { expect, it } from 'vitest'
import { defaultDatasetRequest } from './reportDatasets'
import { resolveCatalogueLaunch } from './reportCatalogueLaunch'
import { CLIENT_DISCOUNTS_ORIGINAL_ID, originalClientDiscountsSupported, readClientDiscountRegions } from './originalClientDiscounts'
import { clientDiscountsCatalogue, clientDiscountsDataset, clientDiscountsPreview } from './originalClientDiscounts.test-fixtures'
import { normalizeNativeReportPreview } from './nativeReportPreview'

const period = { from: '2026-09-01', to: '2026-09-30' }
function launch(world = 'fenix') {
  return resolveCatalogueLaunch(clientDiscountsCatalogue(world), { reportId: 'builtin:ОтчетПоСкидкам', world,
    sourceId: CLIENT_DISCOUNTS_ORIGINAL_ID, dataSource: 25 }, [clientDiscountsDataset()], period)
}

it('opens the exact Fenix recipient rows and product columns with only MAX percentage', () => {
  const result = launch(); expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.message)
  expect(result.template.Data.sorted.Row.map(row => row.type)).toEqual([55])
  expect(result.template.Data.sorted.Col.map(row => row.type)).toEqual([53])
  expect(result.template.Data.sorted.Measurements.map(row => row.Type)).toEqual([64])
  expect(result.template.Data.selections.map(row => row.SelectedField.Type)).toEqual([41, 43, 50])
  expect(result.template.Data.selections.every(row => row.IsChecked === false && row.Values.length === 0)).toBe(true)
  expect(result.template.Data.discountMarkup).toEqual({ Version: 1, SourceWorld: 1, DateEnd: '' })
  expect([result.template.Data.from, result.template.Data.to]).toEqual(['', ''])
  expect(result.notice).toContain('одержувачі в рядках, товари в колонках, максимальний відсоток')
})

it('uses server-owned original defaults for fresh dataset requests without activating an empty filter', () => {
  const request = defaultDatasetRequest(clientDiscountsDataset(), period.from, period.to)
  expect(request.sorted.Col.map(row => row.type)).toEqual([53])
  expect(request.selections.filter(row => row.IsChecked)).toEqual([])
  expect(originalClientDiscountsSupported(clientDiscountsDataset())).toBe(true)
})

it('refuses wrong original hashes and does not carry Fenix default acceptance to AMG', () => {
  const dataset = clientDiscountsDataset()
  dataset.originalClientDiscounts = { ...(dataset.originalClientDiscounts as object), QuerySha256: 'b'.repeat(64) }
  expect(originalClientDiscountsSupported(dataset)).toBe(false)
  expect(resolveCatalogueLaunch(clientDiscountsCatalogue(), { reportId: 'builtin:ОтчетПоСкидкам', world: 'fenix',
    sourceId: CLIENT_DISCOUNTS_ORIGINAL_ID, dataSource: 25 }, [dataset], period).ok).toBe(false)
  const amg = launch('amg'); expect(amg.ok).toBe(true)
  if (!amg.ok) throw new Error(amg.message)
  expect(amg.template.Data.discountMarkup).toMatchObject({ SourceWorld: 2 })
  expect(amg.template.Data.sorted.Row.map(row => row.type)).toEqual([55, 53, 62, 58])
  expect(amg.template.Data.sorted.Col).toEqual([])
  expect(amg.template.Data.selections).toEqual([])
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
