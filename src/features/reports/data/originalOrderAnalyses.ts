import type { ReportCatalogueEntry } from '../types'
export type OrderAnalysisKind = 0 | 1 | 2
export type OrderAnalysisField = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
export type OrderAnalysisState = 0 | 1 | 2
export type OrderAnalysisReference = { Reference: string; Type: string | null; Table: string | null }
export type OrderAnalysisFilter = { Field: OrderAnalysisField; Value: OrderAnalysisReference }
export type OrderAnalysisDefinition = { Kind: OrderAnalysisKind; SourceId: string; Name: string; DefinitionSha256: string; ModuleSha256: string }
export const orderAnalysisDefinitions: readonly OrderAnalysisDefinition[] = [
  { Kind: 0, SourceId: 'e13f00ea-3e37-41d3-ac77-e2a10c644cf3', Name: 'АнализВнутреннихЗаказов', DefinitionSha256: '0d647a3d491ddb11d15699999d33c0fc24924549e4a71108b49c76a395ac9f20', ModuleSha256: '8de5733a6b21987332dcd689e09df2652cdb7120c87073c30eac1306bd0b2e7a' },
  { Kind: 1, SourceId: 'f2bab2c0-5d17-442a-85c2-9d9cc5d807a9', Name: 'АнализЗаказовПокупателей', DefinitionSha256: 'ce10f0a7fbce19eb3225449b1b0badc1ce15df3dff3a2d8f556cd74389b9b633', ModuleSha256: 'e17c34ad7832252175c4271755aeb9e1b88dbd42e124ddd6fc4d266a3f28dee4' },
  { Kind: 2, SourceId: 'f9880ee4-8aa0-4e67-a703-5db2e43178e5', Name: 'АнализЗаказовПоставщикам', DefinitionSha256: 'fcde4e98fd66a13c7b6124d985766723816f9cbea9c0fcb15455a9623bfab2d3', ModuleSha256: '8024002b1e0afe28ff649fe80b9321176e847725a148e8d5ba5cf50d6604f5c3' },
]
export const orderAnalysisTitles = ['Внутрішні замовлення', 'Замовлення покупців', 'Замовлення постачальникам'] as const
export const orderAnalysisFieldLabels = ['Вид замовника', 'Замовник / контрагент', 'Договір', 'Замовлення', 'Номенклатура', 'Характеристика', 'Статус партії', 'Одиниця', 'Ціна', 'Реєстратор', 'Період'] as const
export const orderAnalysisRows = (kind: OrderAnalysisKind): OrderAnalysisField[] => kind === 0 ? [0, 1, 3, 4] : [1, 2, 3, 4]
export const orderAnalysisRowOptions = (kind: OrderAnalysisKind): OrderAnalysisField[] => kind === 0 ? [0, 1, 3, 4, 5, 6, 7, 9, 10] : [1, 2, 3, 4, 5, 6, 7, 8]
export const orderAnalysisFilterFields = (kind: OrderAnalysisKind): OrderAnalysisField[] => kind === 0 ? [1, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5, 6, 7]
export function orderAnalysisMeasures(kind: OrderAnalysisKind): string[] {
  const quantities = kind === 2 ? ['Запланировано', 'ОсталосьОтгрузить', 'Заказано'] : ['Запланировано', 'ОсталосьОтгрузить', 'СоСклада', 'Заказано', 'ОсталосьОбеспечить']
  const money = kind === 1 ? ['СуммаЗаказа', 'ОсталосьОплатить', 'Предоплата', 'ОсталосьОтгрузитьСуммаВзаиморасчетов', 'ОсталосьОтгрузитьСуммаУпр'] : kind === 2
    ? ['СуммаЗаказа', 'СуммаЗапланировано', 'ОсталосьОплатить', 'Оплачено', 'ОсталосьЗакупитьСуммаВзаиморасчетов', 'ОсталосьЗакупитьСуммаУпр'] : []
  return [...money, ...(kind === 0 ? ['', 'БазовыхЕд', 'ЕдиницОтчетов', 'ЕдиницЗаказа'] : ['', 'БазовыхЕд', 'ЕдиницОтчетов']).flatMap(suffix => quantities.map(v => v + suffix))]
}
export const orderAnalysisDefaultMeasures = (kind: OrderAnalysisKind) => kind === 0 ? ['Запланировано', 'ОсталосьОтгрузить', 'СоСклада', 'Заказано', 'ОсталосьОбеспечить'] : kind === 1
  ? ['СуммаЗаказа', 'ОсталосьОплатить', 'Предоплата', 'Запланировано', 'ОсталосьОтгрузить', 'СоСклада', 'Заказано', 'ОсталосьОбеспечить']
  : ['СуммаЗаказа', 'СуммаЗапланировано', 'ОсталосьОплатить', 'Оплачено', 'Запланировано', 'ОсталосьОтгрузить', 'Заказано']
export type OrderAnalysisCapability = { Version: 1; World: 'fenix'; Definition: OrderAnalysisDefinition; DefaultRows: OrderAnalysisField[]; DefaultMeasures: string[]; Measures: string[];
  OurOnlyReaderImplemented: true; OriginalSavedVariantsVerified: false; SourceParityVerified: false }
export type OrderAnalysisRequest = { Version: 1; World: 'fenix'; Kind: OrderAnalysisKind; SourceId: string; DefinitionSha256: string; ModuleSha256: string; From: string; Through: string;
  Rows: OrderAnalysisField[]; Measures: string[]; Filters: OrderAnalysisFilter[]; ShipmentStates: OrderAnalysisState[] | null; PaymentStates: OrderAnalysisState[] | null }
export const orderAnalysisRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
export const orderAnalysisSame = (a: unknown, b: readonly unknown[]) => Array.isArray(a) && a.length === b.length && a.every((v, i) => JSON.stringify(v) === JSON.stringify(b[i]))
export const orderAnalysisHash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v) && !/^0+$/.test(v)
export const orderAnalysisInvalid = () => new Error('Сервер не підтвердив цей аналіз замовлень.')
const hex = (v: unknown, size: number): v is string => typeof v === 'string' && v.length === size && /^[0-9A-F]+$/.test(v)
export function readOrderAnalysisReference(v: unknown): OrderAnalysisReference {
  if (!orderAnalysisRecord(v) || !hex(v.Reference, 32) || !((v.Type === null && v.Table === null) || hex(v.Type, 2) && hex(v.Table, 8))) throw orderAnalysisInvalid()
  return { Reference: v.Reference, Type: v.Type as string | null, Table: v.Table as string | null }
}
export function readOrderAnalysisFilter(v: unknown, kind: OrderAnalysisKind): OrderAnalysisFilter {
  if (!orderAnalysisRecord(v) || !orderAnalysisFilterFields(kind).includes(v.Field as OrderAnalysisField)) throw orderAnalysisInvalid()
  const value = readOrderAnalysisReference(v.Value), field = v.Field as OrderAnalysisField
  if (field === 3 ? value.Type === null : field === 1 ? (value.Type !== null) !== (kind === 0) : value.Type !== null) throw orderAnalysisInvalid()
  return { Field: field, Value: value }
}
export const orderAnalysisFilterKey = (v: OrderAnalysisFilter) => JSON.stringify([v.Field, v.Value.Type, v.Value.Table, v.Value.Reference])
export function orderAnalysisCatalogueKind(report: ReportCatalogueEntry, worlds: readonly string[]): OrderAnalysisKind | null {
  if (!worlds.includes('fenix')) return null
  return orderAnalysisDefinitions.find(d => report.Id === `builtin:${d.Name}` && report.Sources.some(s => s.World === 'fenix' && s.SourceId === d.SourceId && s.DefinitionSha256 === d.DefinitionSha256))?.Kind ?? null
}
export function isOrderAnalysisCapability(v: unknown, kind: OrderAnalysisKind): v is OrderAnalysisCapability {
  const definition = orderAnalysisDefinitions[kind]
  if (!definition) return false
  return orderAnalysisRecord(v) && v.Version === 1 && v.World === 'fenix' && orderAnalysisRecord(v.Definition)
    && Object.entries(definition).every(([key, value]) => v.Definition && (v.Definition as Record<string, unknown>)[key] === value)
    && orderAnalysisSame(v.DefaultRows, orderAnalysisRows(kind)) && orderAnalysisSame(v.DefaultMeasures, orderAnalysisDefaultMeasures(kind)) && orderAnalysisSame(v.Measures, orderAnalysisMeasures(kind))
    && v.OurOnlyReaderImplemented === true && v.OriginalSavedVariantsVerified === false && v.SourceParityVerified === false
}
function day(value: string): number | null {
  if (!/^\d{4}-\d\d-\d\d$/.test(value) || value < '0001-01-02' || value >= '3999-01-01') return null
  const ms = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value ? ms : null
}
export function orderAnalysisPeriodError(from: string, through: string) {
  const first = day(from), last = day(through)
  return first === null || last === null || last < first || last - first >= 366 * 86_400_000 ? 'Оберіть точний період до 366 календарних днів.' : null
}
const states = (v: OrderAnalysisState[] | null) => v === null || v.length <= 3 && new Set(v).size === v.length && v.every(s => s === 0 || s === 1 || s === 2)
export function orderAnalysisRequest(capability: OrderAnalysisCapability, from: string, through: string, rows: OrderAnalysisField[], measures: string[], filters: OrderAnalysisFilter[], shipment: OrderAnalysisState[] | null, payment: OrderAnalysisState[] | null): OrderAnalysisRequest {
  const kind = capability.Definition.Kind
  if (!isOrderAnalysisCapability(capability, kind) || orderAnalysisPeriodError(from, through) || rows.length > 11 || new Set(rows).size !== rows.length || rows.some(v => !orderAnalysisRowOptions(kind).includes(v))
    || !measures.length || new Set(measures).size !== measures.length || measures.some(v => !capability.Measures.includes(v)) || filters.length > 256 || new Set(filters.map(orderAnalysisFilterKey)).size !== filters.length
    || !states(shipment) || !states(payment) || kind === 0 && payment !== null) throw orderAnalysisInvalid()
  return { Version: 1, World: 'fenix', Kind: kind, SourceId: capability.Definition.SourceId, DefinitionSha256: capability.Definition.DefinitionSha256, ModuleSha256: capability.Definition.ModuleSha256,
    From: from, Through: through, Rows: [...rows], Measures: [...measures], Filters: filters.map(v => readOrderAnalysisFilter(v, kind)), ShipmentStates: shipment?.slice() ?? null, PaymentStates: payment?.slice() ?? null }
}
