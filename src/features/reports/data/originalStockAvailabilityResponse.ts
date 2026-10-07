import { stockAxes, stockAxis, stockDefinition, stockError, stockOpaqueKey, stockRecord, stockSame, type StockAxis, type StockMeasure, type StockRequest } from './originalStockAvailability'
export type StockNumber = { Numerator: string; Denominator: string; Display: string }
export type StockChoice = { Key: string; Caption: string }
export type StockChoices = Record<StockAxis, StockChoice[]>
export type StockRow = { Key: { Field: StockAxis; Key: string; Caption: string }[]; Values: Record<string, StockNumber | null> }
export type StockResult = StockRequest & { Available: boolean; Code: string; OurSnapshotVerified: boolean; NormalInputsComplete: boolean; Choices: StockChoices; Data: StockRow[] }
function fixed3(numerator: bigint, denominator: bigint) {
  const negative = numerator < 0n, absolute = negative ? -numerator : numerator, scaled = absolute * 1000n
  let value = scaled / denominator
  if (scaled % denominator * 2n >= denominator) value++
  return `${negative && value !== 0n ? '-' : ''}${value / 1000n}.${String(value % 1000n).padStart(3, '0')}`
}
export function readStockNumber(v: unknown): StockNumber | null {
  if (v === null) return null
  if (!stockRecord(v) || typeof v.Numerator !== 'string' || typeof v.Denominator !== 'string' || typeof v.Display !== 'string'
    || !/^(0|-?[1-9]\d*)$/.test(v.Numerator) || !/^[1-9]\d*$/.test(v.Denominator) || v.Numerator.length > 4096 || v.Denominator.length > 4096) throw stockError()
  if (fixed3(BigInt(v.Numerator), BigInt(v.Denominator)) !== v.Display) throw stockError()
  return { Numerator: v.Numerator, Denominator: v.Denominator, Display: v.Display }
}
function choices(v: unknown): StockChoices {
  if (!stockRecord(v) || !stockSame(Object.keys(v).sort(), [...stockAxes].sort())) throw stockError()
  return Object.fromEntries(stockAxes.map(axis => {
    const list = v[axis], seen = new Set<string>()
    if (!Array.isArray(list)) throw stockError()
    return [axis, list.map(item => {
      if (!stockRecord(item) || !stockOpaqueKey(item.Key) || typeof item.Caption !== 'string' || !item.Caption.trim() || seen.has(item.Key)) throw stockError()
      seen.add(item.Key); return { Key: item.Key, Caption: item.Caption }
    })]
  })) as StockChoices
}
function values(v: unknown, measures: StockMeasure[]) {
  if (!stockRecord(v) || !stockSame(Object.keys(v).sort(), [...measures].sort())) throw stockError()
  return Object.fromEntries(measures.map(m => [m, readStockNumber(v[m])]))
}
function rows(v: unknown, request: StockRequest, named: StockChoices): StockRow[] {
  if (!Array.isArray(v)) throw stockError()
  const seen = new Set<string>(), captions = new Map(stockAxes.flatMap(axis => named[axis].map(item => [`${axis}:${item.Key}`, item.Caption] as const)))
  return v.map(item => {
    if (!stockRecord(item) || !Array.isArray(item.Key) || item.Key.length !== request.Rows.length) throw stockError()
    const key = item.Key.map((entry, i) => {
      if (!stockRecord(entry) || !stockAxis(entry.Field) || entry.Field !== request.Rows[i] || !stockOpaqueKey(entry.Key) || typeof entry.Caption !== 'string' || !entry.Caption.trim()
        || captions.get(`${entry.Field}:${entry.Key}`) !== entry.Caption || request.Filters.some(f => f.Field === entry.Field && f.Key !== entry.Key)) throw stockError()
      return { Field: entry.Field, Key: entry.Key, Caption: entry.Caption }
    })
    const encoded = JSON.stringify(key.map(v => [v.Field, v.Key]))
    if (seen.has(encoded)) throw stockError(); seen.add(encoded)
    return { Key: key, Values: values(item.Values, request.Measures) }
  })
}
function scope(v: unknown, request: StockRequest): asserts v is Record<string, unknown> {
  if (!stockRecord(v) || v.Version !== 1 || v.World !== 'fenix' || v.SourceId !== stockDefinition.source || v.DefinitionSha256 !== stockDefinition.definition || v.At !== request.At
    || !stockSame(v.Rows, request.Rows) || !stockSame(v.Measures, request.Measures) || !Array.isArray(v.Filters) || v.Filters.length !== request.Filters.length
    || v.Filters.some((f, i) => !stockRecord(f) || f.Field !== request.Filters[i].Field || f.Key !== request.Filters[i].Key)) throw stockError()
}
export function normalizeStockResult(v: unknown, request: StockRequest): StockResult {
  scope(v, request)
  if (typeof v.Available !== 'boolean' || typeof v.OurSnapshotVerified !== 'boolean' || typeof v.NormalInputsComplete !== 'boolean' || typeof v.Code !== 'string' || !/^original_stock_availability_[a-z_]+$/.test(v.Code)) throw stockError()
  const named = choices(v.Choices), data = rows(v.Data, request, named)
  if ((!v.OurSnapshotVerified || !v.NormalInputsComplete) && (data.length || stockAxes.some(a => named[a].length) || v.NormalInputsComplete)) throw stockError()
  if (v.Available && (!v.OurSnapshotVerified || !v.NormalInputsComplete || v.Code !== 'original_stock_availability_current_our' || data.some(row => Object.values(row.Values).some(n => n === null)))) throw stockError()
  return { ...request, Available: v.Available, Code: v.Code, OurSnapshotVerified: v.OurSnapshotVerified, NormalInputsComplete: v.NormalInputsComplete, Choices: named, Data: data }
}
