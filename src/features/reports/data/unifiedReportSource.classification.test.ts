import { expect, it } from 'vitest'
import { withoutProductClassification, withUnifiedSource } from './unifiedReportSource'
import { defaultDatasetRequest } from './reportDatasets'
import { profitDayDataset } from './profitReadMode.test-fixtures'
import { GOODS_KIND_ID, nativeExactFiltersConfigurationError, PRODUCT_CLASSIFICATION_RESAVE_ERROR, productClassificationReviewError,
  productServiceFromClassification, unmappedProductClassificationError } from './nativeExactFilters'
import { savedNativeReportConfigurationError } from './savedNativeReport'
import type { ReportDataset, ReportRequestBody } from '../types'

const serviceDataset: ReportDataset = { ...profitDayDataset, productServiceFilter: { Version: 1, IsServiceValues: [false, true],
  GoodsKind: 'Товар', Basis: 'GbaProductClassification' } }
const SERVICE_KIND_ID = '8FC4005056C0000811DF10AE5525F8C8'
const classification = (ProductKindId: string, IsService: boolean) => ({ Version: 1, SourceWorld: 0, ProductKindId, IsService })
const otherGoodsKind = classification('8AB2005056C0000811DF05C7D73CB155', false)
const request = (productClassification: unknown): ReportRequestBody =>
  ({ ...defaultDatasetRequest(serviceDataset, '2026-09-01', '2026-09-30'), productClassification })
const saved = (data: ReportRequestBody) => ({ Id: '10000000-0000-4000-8000-000000000001', Revision: 1, Name: 'Saved', Data: data })

it.each([
  ['a goods kind other than «Товар»', otherGoodsKind, 'вид 8AB2005056C0000811DF05C7D73CB155, без послуг'],
  ['services of the «Послуга» kind, which GBA «Послуги» could widen to every service kind', classification(SERVICE_KIND_ID, true), `вид ${SERVICE_KIND_ID}, лише послуги`],
  ['services of the «Товар» kind', classification(GOODS_KIND_ID, true), `вид ${GOODS_KIND_ID}, лише послуги`],
  ['services of a kind other than «Послуга»', classification('BF4C005056C0000811DF2D0E690520B9', true), 'вид BF4C005056C0000811DF2D0E690520B9, лише послуги'],
  ['goods of the services kind', classification(SERVICE_KIND_ID, false), `вид ${SERVICE_KIND_ID}, без послуг`],
  ['a malformed classification', { Version: 1, SourceWorld: 0, ProductKindId: 'not-a-kind', IsService: false }, 'некоректний відбір'],
])('keeps %s on an opened template and blocks it with what would be dropped instead of widening the report', (_name, value, dropped) => {
  const unified = withUnifiedSource(request(value), serviceDataset)
  expect(unified.productClassification).toEqual(value)
  expect(unified).not.toHaveProperty('productServiceFilter')
  const message = unmappedProductClassificationError(value)
  expect(message).toContain(`(${dropped})`)
  expect(message).toContain('немає рівнозначного відбору')
  expect(message).toContain('збережіть шаблон повторно')
  expect(productClassificationReviewError(unified, serviceDataset)).toBe(message)
  expect(nativeExactFiltersConfigurationError(unified, serviceDataset)).toBe(message)
  expect(savedNativeReportConfigurationError(saved(request(value)), [serviceDataset])).toBe(message)
  expect(nativeExactFiltersConfigurationError(withoutProductClassification(unified), serviceDataset)).toBeNull()
})

it('maps only «Товар» without services, the one kind the GBA filter expresses exactly', () => {
  expect(productServiceFromClassification(classification(GOODS_KIND_ID.toLowerCase(), false))).toEqual({ Version: 1, IsService: false })
  for (const value of [classification(SERVICE_KIND_ID, true), classification(GOODS_KIND_ID, true), classification(SERVICE_KIND_ID, false), otherGoodsKind])
    expect(productServiceFromClassification(value)).toBeNull()
  const value = classification(GOODS_KIND_ID, false)
  const unified = withUnifiedSource(request(value), serviceDataset)
  expect(unified).not.toHaveProperty('productClassification')
  expect(unified.productServiceFilter).toEqual({ Version: 1, IsService: false })
  expect(nativeExactFiltersConfigurationError(unified, serviceDataset)).toBeNull()
  expect(savedNativeReportConfigurationError(saved(request(value)), [serviceDataset])).toBe(PRODUCT_CLASSIFICATION_RESAVE_ERROR)
  expect(PRODUCT_CLASSIFICATION_RESAVE_ERROR).not.toContain('«Послуги»')
})

it('never turns a «Послуга» services template into the GBA filter for every service, even when a template already carries one', () => {
  const services = classification(SERVICE_KIND_ID, true)
  const unified = withUnifiedSource(request(services), serviceDataset)
  expect(unified).not.toHaveProperty('productServiceFilter')
  const both = { ...request(services), productServiceFilter: { Version: 1, IsService: true } } as ReportRequestBody
  expect(withUnifiedSource(both, serviceDataset).productClassification).toEqual(services)
  expect(nativeExactFiltersConfigurationError(withUnifiedSource(both, serviceDataset), serviceDataset)).not.toBeNull()
})

it('leaves the old Fenix classification untouched when the server does not advertise the GBA goods filter', () => {
  const data = { ...defaultDatasetRequest(profitDayDataset, '2026-09-01', '2026-09-30'), productClassification: otherGoodsKind }
  expect(withUnifiedSource(data, profitDayDataset).productClassification).toEqual(otherGoodsKind)
  expect(productClassificationReviewError(data, profitDayDataset)).toBeNull()
})

it('removes every spelling of the classification only when the user asks for it', () => {
  const data = { ...request(otherGoodsKind), ProductClassification: otherGoodsKind } as ReportRequestBody
  const cleared = withoutProductClassification(data)
  expect(Object.keys(cleared).filter(key => key.toLowerCase() === 'productclassification')).toEqual([])
  expect(Object.keys(data).filter(key => key.toLowerCase() === 'productclassification')).toHaveLength(2)
})
