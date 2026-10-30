import type { ReportDataset, ReportRequestBody } from '../types'

export type StockQuantityFilter = { version: 1; measure: 106; comparison: 'GreaterThan'; value: 0 }
export const positiveClosingQuantity: StockQuantityFilter = { version: 1, measure: 106, comparison: 'GreaterThan', value: 0 }
const positiveStockRowGroupings = [5, 6, 7, 8, 9, 24, 28, 29, 34, 83]
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const aliases = (data: object) => Object.keys(data).filter(key => key.toLowerCase() === 'stockquantityfilter')
export function requestStockQuantityFilter(data: object): unknown {
  const keys = aliases(data)
  return keys.length > 1 ? { invalid: true } : keys.length ? (data as Record<string, unknown>)[keys[0]] : undefined
}
export function cloneStockQuantityFilter(data: object): Record<string, unknown> {
  return Object.fromEntries(aliases(data).filter(key => (data as Record<string, unknown>)[key] != null)
    .map(key => [key, structuredClone((data as Record<string, unknown>)[key])]))
}
export function readStockQuantityFilter(value: unknown): StockQuantityFilter | null {
  return object(value) && Object.keys(value).sort().join(',') === 'comparison,measure,value,version'
    && value.version === 1 && value.measure === 106 && value.comparison === 'GreaterThan' && value.value === 0
    ? { ...positiveClosingQuantity } : null
}
export function stockQuantityFilterSupported(dataset?: ReportDataset): boolean {
  const value = dataset?.stockQuantityFilter
  return dataset?.DataSource === 45 && object(value)
    && Object.keys(value).sort().join(',') === 'comparison,maxColumnGroupings,maxRowGroupings,measure,requiresMeasure,rowGroupingTypes,stage,unknownQuantity,value,version'
    && value.version === 1 && value.measure === 106 && value.comparison === 'GreaterThan' && value.value === 0
    && value.stage === 'GroupedRowsBeforeTotals' && value.requiresMeasure === true
    && JSON.stringify(value.rowGroupingTypes) === JSON.stringify(positiveStockRowGroupings)
    && value.maxColumnGroupings === 0 && value.maxRowGroupings === 3 && value.unknownQuantity === 'Reject'
}
/** Drafts remain editable; callers apply this guard only when saving or running. */
export function stockQuantityFilterError(request: ReportRequestBody, dataset?: ReportDataset): string | null {
  const raw = requestStockQuantityFilter(request)
  if (raw == null) return null
  if (request.dataSource !== 45 || !readStockQuantityFilter(raw)) return 'Непідтримуваний відбір кінцевого залишку. Вимкніть його або виберіть кількість більше 0.'
  if (dataset && !stockQuantityFilterSupported(dataset)) return 'Сервер ще не підтримує відбір кінцевої кількості більше 0. Вимкніть цей відбір або оновіть сервер.'
  if (!request.sorted.Measurements.some(measure => measure.Type === 106 && measure.IsChecked !== false))
    return 'Для цього відбору виберіть показник «Кінцевий залишок: кількість» або вимкніть відбір.'
  if (!request.sorted.Row.some(row => row.type != null && row.type >= 0 && row.type <= 3)
    && [...request.sorted.Row, ...request.sorted.Col].some(group => group.type === 33))
    return 'Відбір кінцевої кількості більше 0 поки не підтримує групування за партіями GBA. Приберіть цей відбір або групування за партією.'
  if (request.sorted.Col.length !== 0 || request.sorted.Row.length < 1 || request.sorted.Row.length > 3)
    return 'Для цього відбору залиште 1–3 групування рядків без групування колонок або вимкніть відбір.'
  if (request.sorted.Row.some(row => !positiveStockRowGroupings.includes(row.type ?? -1)))
    return 'Для цього відбору приберіть групування за роком, кварталом, місяцем або днем. Дати періоду звіту можна змінювати.'
  return null
}
