import type { ReportDataset, ReportRequestBody } from '../types'
import { datasetGroupings } from './reportDatasets'
export type NativePriceComparison = { Version: 1; PriceTypeId: string }
export const NATIVE_PRICE_COMPARISON_WORKBOOK = 'Продажі порівнянням по групах цін.xls'
export function nativePriceComparisonError(value: NativePriceComparison | undefined): string | null {
  return value?.Version === 1 && /^[0-9a-f]{32}$/i.test(value.PriceTypeId) && !/^0{32}$/.test(value.PriceTypeId)
    ? null : 'Оберіть тип ціни зі збереженої історії.'
}
export function nativePriceComparisonRequest(request: ReportRequestBody, dataset: ReportDataset): ReportRequestBody {
  const groups=datasetGroupings(dataset)
  return { dataSource:46, from:request.from, to:request.to, nativePriceComparison:{Version:1,PriceTypeId:''}, selections:[],
    sorted:{ Row:[12,2,6].flatMap(type=>groups.filter(field=>field.type===type)), Col:[],
      Measurements:[4,70,71].flatMap(type=>dataset.Measurements.filter(field=>field.Type===type)).map(field=>({Type:field.Type,Name:field.Name,parentName:field.Name,IsChecked:true})) } }
}
