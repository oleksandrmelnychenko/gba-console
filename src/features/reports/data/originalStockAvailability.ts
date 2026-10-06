import type { ReportCatalogueEntry } from '../types'
import { availabilityDateError, availabilityDateInput } from './originalCashAvailability'
export const stockDefinition = { name: 'АнализДоступностиТоваровНаСкладах', source: '2008cac6-109b-4585-aa0f-6d5c422d9be3', definition: 'a088f57ae0642763cbd196278e7ccf9fdb91c188b47fce354472284129a6ea8e', module: 'cfc905672c1cf4a982bb6603f88fe54a1cb6b67866390e1fe101c6392b2a3552' } as const
export const stockAxes = ['warehouse', 'product', 'characteristic', 'series', 'quality', 'basisDocument'] as const
export type StockAxis = typeof stockAxes[number]
export const stockDefaultRows: StockAxis[] = ['warehouse', 'product']
export const stockDefaults = ['stock', 'reserved', 'incoming', 'outgoing', 'supplierOrdered', 'free'] as const
export const stockMeasures = [...stockDefaults, 'baseStock', 'baseReserved', 'baseIncoming', 'baseOutgoing', 'baseSupplierOrdered', 'baseFree', 'reportStock', 'reportReserved', 'reportIncoming', 'reportOutgoing', 'reportSupplierOrdered', 'reportFree'] as const
export type StockMeasure = typeof stockMeasures[number]
export const stockAxisLabels: Record<StockAxis, string> = { warehouse: 'Склад', product: 'Номенклатура', characteristic: 'Характеристика', series: 'Серія', quality: 'Якість', basisDocument: 'Документ підстава' }
const nativeLabels = { stock: 'Залишок', reserved: 'Резерв', incoming: 'Очікуване надходження', outgoing: 'До передачі', supplierOrdered: 'Замовлено постачальникам', free: 'Вільний залишок' }
export function stockMeasureLabel(value: StockMeasure): string {
  const prefix = value.startsWith('base') ? 'base' : value.startsWith('report') ? 'report' : null
  if (!prefix) return nativeLabels[value as keyof typeof nativeLabels]
  const suffix = value.slice(prefix.length), base = suffix[0].toLowerCase() + suffix.slice(1)
  return `${nativeLabels[base as keyof typeof nativeLabels]} · ${prefix === 'base' ? 'базові одиниці' : 'одиниці звітів'}`
}
export type StockFilter = { Field: StockAxis; Key: string }
export type StockRequest = { Version: 1; World: 'fenix'; SourceId: string; DefinitionSha256: string; At: string; Rows: StockAxis[]; Measures: StockMeasure[]; Filters: StockFilter[] }
export type StockCapability = { Version: 1; World: 'fenix'; SourceId: string; DefinitionSha256: string; ModuleSha256: string; Executable: boolean; SourceSyncEnabled: false; CurrentInputsComplete: false; SourceParityVerified: false; DatePolicy: 'explicit_plain_DateKon_second_exclusive'; Axes: StockAxis[]; DefaultRows: StockAxis[]; DefaultFilters: StockAxis[]; Measures: StockMeasure[]; DefaultMeasures: StockMeasure[] }
export const stockError = () => new Error('Сервер не підтвердив звіт доступності товарів.')
export const stockRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
export const stockOpaqueKey = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)
export const stockSame = (v: unknown, expected: readonly unknown[]) => Array.isArray(v) && v.length === expected.length && v.every((item, i) => item === expected[i])
const axisSet = new Set<string>(stockAxes), measureSet = new Set<string>(stockMeasures)
export const stockAxis = (v: unknown): v is StockAxis => typeof v === 'string' && axisSet.has(v)
export const stockMeasure = (v: unknown): v is StockMeasure => typeof v === 'string' && measureSet.has(v)
export function stockCatalogueMatches(report: ReportCatalogueEntry, worlds: readonly string[]) {
  return worlds.includes('fenix') && report.Id === `builtin:${stockDefinition.name}` && report.Sources.some(v => v.World === 'fenix' && v.SourceId === stockDefinition.source && v.DefinitionSha256 === stockDefinition.definition)
}
export function isStockCapability(v: unknown): v is StockCapability {
  return stockRecord(v) && v.Version === 1 && v.World === 'fenix' && v.SourceId === stockDefinition.source && v.DefinitionSha256 === stockDefinition.definition && v.ModuleSha256 === stockDefinition.module
    && typeof v.Executable === 'boolean' && v.SourceSyncEnabled === false && v.CurrentInputsComplete === false && v.SourceParityVerified === false && v.DatePolicy === 'explicit_plain_DateKon_second_exclusive'
    && stockSame(v.Axes, stockAxes) && stockSame(v.DefaultRows, stockDefaultRows) && stockSame(v.DefaultFilters, stockDefaultRows) && stockSame(v.Measures, stockMeasures) && stockSame(v.DefaultMeasures, stockDefaults)
}
export function stockDateError(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) || value.slice(0, 4) < '2000' || value.slice(0, 4) > '2099') return 'Оберіть точну дату й час із секундами.'
  return availabilityDateError(value.replace(' ', 'T'))
}
export const stockDateInput = (value: string) => availabilityDateInput(value).replace('T', ' ')
export function stockRequest(capability: StockCapability, at: string, rows: StockAxis[], measures: StockMeasure[], filters: StockFilter[]): StockRequest {
  if (!isStockCapability(capability) || !capability.Executable || stockDateError(at) || rows.length < 1 || rows.length > 6 || rows.some(v => !stockAxis(v)) || new Set(rows).size !== rows.length
    || measures.length < 1 || measures.length > 18 || measures.some(v => !stockMeasure(v)) || new Set(measures).size !== measures.length || filters.length > 6 || new Set(filters.map(v => v.Field)).size !== filters.length
    || filters.some(v => !stockAxis(v.Field) || !stockOpaqueKey(v.Key))) throw stockError()
  return { Version: 1, World: 'fenix', SourceId: stockDefinition.source, DefinitionSha256: stockDefinition.definition, At: at, Rows: [...rows], Measures: [...measures], Filters: filters.map(v => ({ ...v })) }
}
