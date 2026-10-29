import type { ReportDataset, ReportRequestBody } from '../types'
import { datasetGroupings } from './reportDatasets'
export type NativePriceComparison =
  | { Version: 1; PriceTypeId: string; PricingId?: never }
  | { Version: 2; PricingId: string; PriceTypeId?: never }
export function isNativePricingId(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9][0-9]{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n
}
export const NATIVE_PRICE_COMPARISON_WORKBOOK = 'Продажі порівнянням по групах цін.xls'
export function nativePriceComparisonError(value: NativePriceComparison | undefined): string | null {
  const valid = value?.Version === 2
    ? isNativePricingId(value.PricingId) && value.PriceTypeId == null
    : value?.Version === 1 && value.PricingId == null && /^[0-9a-f]{32}$/i.test(value.PriceTypeId) && !/^0{32}$/.test(value.PriceTypeId)
  return valid ? null : 'Оберіть тип ціни з довідника GBA.'
}
export function nativePriceComparisonRequest(request: ReportRequestBody, dataset: ReportDataset): ReportRequestBody {
  const groups=datasetGroupings(dataset)
  return { dataSource:46, from:request.from, to:request.to, nativePriceComparison:{Version:2,PricingId:''}, selections:[],
    sorted:{ Row:[12,2,6].flatMap(type=>groups.filter(field=>field.type===type)), Col:[],
      Measurements:[4,70,71].flatMap(type=>dataset.Measurements.filter(field=>field.Type===type)).map(field=>({Type:field.Type,Name:field.Name,parentName:field.Name,IsChecked:true})) } }
}
