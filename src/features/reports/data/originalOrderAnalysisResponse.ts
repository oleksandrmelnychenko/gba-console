import { orderAnalysisDefinitions, orderAnalysisFilterKey, orderAnalysisHash, orderAnalysisInvalid, orderAnalysisMeasures, orderAnalysisRecord, orderAnalysisSame, readOrderAnalysisFilter, type OrderAnalysisField, type OrderAnalysisFilter, type OrderAnalysisRequest } from './originalOrderAnalyses'
import { readOrderAnalysisNumber, type OrderAnalysisNumber } from './originalOrderAnalysisNumbers'
export type OrderAnalysisChoice = OrderAnalysisFilter & { Caption: string; MappingSource: string; WitnessSha256: string }
export type OrderAnalysisUnresolvedChoice = OrderAnalysisFilter & { Code: string }
export type OrderAnalysisInput = { Family: string; Published: boolean; Replayed: boolean; OpeningRunId: string | null; InputWitnessSha256: string | null; PhysicalGrains: number; Code: string }
export type OrderAnalysisChoices = { Request: OrderAnalysisRequest; OurSnapshotVerified: boolean; InputWitnessSha256: string | null; Choices: OrderAnalysisChoice[]; UnresolvedChoices: OrderAnalysisUnresolvedChoice[]; Inputs: OrderAnalysisInput[]; MissingDependencies: string[]; NormalReportAccepted: false }
export type OrderAnalysisStatus = { Observed: boolean; Caption: string | null; NumericZero: boolean }
export type OrderAnalysisGroup = { Key: { Field: OrderAnalysisField; Value: string | null }[]; Measures: Record<string, OrderAnalysisNumber>; Shipment: OrderAnalysisStatus; Payment: OrderAnalysisStatus | null }
export type OrderAnalysisResult = Omit<OrderAnalysisChoices, 'NormalReportAccepted'> & { Available: boolean; Code: string; NormalInputsComplete: boolean; SelectedNumbersObserved: boolean; Rows: Record<string, unknown>[]; Groups: OrderAnalysisGroup[] }
function object(v: unknown): Record<string, unknown> { if (!orderAnalysisRecord(v)) throw orderAnalysisInvalid(); return v }
function boolean(v: unknown): boolean { if (typeof v !== 'boolean') throw orderAnalysisInvalid(); return v }
function text(v: unknown): string { if (typeof v !== 'string' || !v.trim()) throw orderAnalysisInvalid(); return v }
function list(v: unknown): unknown[] { if (!Array.isArray(v)) throw orderAnalysisInvalid(); return v }
function hash(v: unknown): string | null { if (v === null) return null; if (!orderAnalysisHash(v)) throw orderAnalysisInvalid(); return v }
function sameStates(value: unknown, expected: unknown) { return expected === null ? value === null : orderAnalysisSame(value, expected as number[]) }
function echoedRequest(v: unknown, request: OrderAnalysisRequest) {
  const value = object(v), definition = object(value.Definition)
  if (!Object.entries(orderAnalysisDefinitions[request.Kind]).every(([key, expected]) => definition[key] === expected)
    || value.From !== request.From || value.Through !== request.Through || !orderAnalysisSame(value.Rows, request.Rows) || !orderAnalysisSame(value.Measures, request.Measures)
    || value.Shipment !== null || value.Payment !== null || !sameStates(value.ShipmentStates, request.ShipmentStates) || !sameStates(value.PaymentStates, request.PaymentStates)) throw orderAnalysisInvalid()
  const filters = list(value.Filters).map(v => readOrderAnalysisFilter(v, request.Kind))
  if (!orderAnalysisSame(filters.map(orderAnalysisFilterKey), request.Filters.map(orderAnalysisFilterKey))) throw orderAnalysisInvalid()
}
function choices(v: unknown, request: OrderAnalysisRequest): OrderAnalysisChoice[] {
  const rows = list(v).map(value => {
    const row = object(value), filter = readOrderAnalysisFilter(row, request.Kind), witness = hash(row.WitnessSha256)
    if (!witness) throw orderAnalysisInvalid()
    return { ...filter, Caption: text(row.Caption), MappingSource: text(row.MappingSource), WitnessSha256: witness }
  })
  if (new Set(rows.map(orderAnalysisFilterKey)).size !== rows.length) throw orderAnalysisInvalid()
  return rows
}
function inputs(v: unknown): OrderAnalysisInput[] {
  return list(v).map(value => {
    const row = object(value), count = row.PhysicalGrains
    if (!Number.isSafeInteger(count) || (count as number) < 0 || !(row.OpeningRunId === null || typeof row.OpeningRunId === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(row.OpeningRunId))) throw orderAnalysisInvalid()
    return { Family: text(row.Family), Published: boolean(row.Published), Replayed: boolean(row.Replayed), OpeningRunId: row.OpeningRunId as string | null, InputWitnessSha256: hash(row.InputWitnessSha256), PhysicalGrains: count as number, Code: text(row.Code) }
  })
}
function common(value: Record<string, unknown>, request: OrderAnalysisRequest) {
  echoedRequest(value.Request, request)
  const resolved = choices(value.Choices, request), unresolved = list(value.UnresolvedChoices).map(v => ({ ...readOrderAnalysisFilter(v, request.Kind), Code: text(object(v).Code) }))
  if (new Set(unresolved.map(orderAnalysisFilterKey)).size !== unresolved.length || unresolved.some(v => resolved.some(r => orderAnalysisFilterKey(r) === orderAnalysisFilterKey(v)))) throw orderAnalysisInvalid()
  return { Request: request, OurSnapshotVerified: boolean(value.OurSnapshotVerified), InputWitnessSha256: hash(value.InputWitnessSha256), Choices: resolved, UnresolvedChoices: unresolved, Inputs: inputs(value.Inputs), MissingDependencies: list(value.MissingDependencies).map(text) }
}
export function normalizeOrderAnalysisChoices(raw: unknown, request: OrderAnalysisRequest): OrderAnalysisChoices {
  const value = object(raw)
  if (value.NormalReportAccepted !== false) throw orderAnalysisInvalid()
  const data = common(value, request)
  if (data.Choices.length && (!data.OurSnapshotVerified || !data.InputWitnessSha256)) throw orderAnalysisInvalid()
  return { ...data, NormalReportAccepted: false }
}
function numbers(v: unknown, names: readonly string[]) {
  const value = object(v)
  if (Object.keys(value).length !== names.length || names.some(name => !(name in value))) throw orderAnalysisInvalid()
  return Object.fromEntries(names.map(name => [name, readOrderAnalysisNumber(value[name])]))
}
function status(v: unknown, captions: readonly string[]): OrderAnalysisStatus {
  const row = object(v), observed = boolean(row.Observed), numeric = boolean(row.NumericZero), caption = row.Caption
  if (!(caption === null || typeof caption === 'string' && captions.includes(caption)) || !observed && (caption !== null || numeric) || numeric && caption !== null) throw orderAnalysisInvalid()
  return { Observed: observed, Caption: caption as string | null, NumericZero: numeric }
}
function groupValue(field: OrderAnalysisField, value: string | null): boolean {
  if (value === null) return true
  if (field === 0) return ['Warehouse', 'Department', 'Undefined'].includes(value)
  if (field === 1 || field === 3 || field === 9) return /^(?:[0-9A-F]{2}:[0-9A-F]{8}:|::)[0-9A-F]{32}$/.test(value)
  if (field === 8) return /^(0|-?[1-9]\d*)\/[1-9]\d*$/.test(value)
  if (field === 10) return /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{7}(?:Z|[+-]\d\d:\d\d)?$/.test(value)
  return /^[0-9A-F]{32}$/.test(value)
}
function group(v: unknown, request: OrderAnalysisRequest): OrderAnalysisGroup {
  const row = object(v), allowedRows = new Set(request.Rows), key = list(row.Key).map(v => {
    const item = object(v)
    if (!(item.Value === null || typeof item.Value === 'string') || !allowedRows.has(item.Field as OrderAnalysisField)) throw orderAnalysisInvalid()
    return { Field: item.Field as OrderAnalysisField, Value: item.Value as string | null }
  })
  if (key.some(v => !groupValue(v.Field, v.Value)) || !orderAnalysisSame(key.map(v => v.Field), request.Rows.slice(0, key.length))) throw orderAnalysisInvalid()
  const shipment = request.Kind === 2 ? ['Не поступило', 'Поступило частично', 'Поступило полностью'] : ['Не отгружено', 'Отгружено частично', 'Отгружено полностью']
  return { Key: key, Measures: numbers(row.Measures, request.Measures), Shipment: status(row.Shipment, shipment), Payment: request.Kind === 0 && row.Payment === null ? null : status(row.Payment, ['Не оплачено', 'Оплачено частично', 'Оплачено полностью']) }
}
export function normalizeOrderAnalysisResult(raw: unknown, request: OrderAnalysisRequest): OrderAnalysisResult {
  const value = object(raw), base = common(value, request)
  for (const flag of ['NativeVirtualTableVerified', 'CommonSourceSnapshotVerified', 'SourceParityVerified', 'OriginalSavedVariantsVerified', 'OriginalAclVerified', 'AppliesFxConversion']) if (value[flag] !== false) throw orderAnalysisInvalid()
  const rows = list(value.Rows).map(v => {
    const row = object(v); object(row.Grain); numbers(row.Measures, orderAnalysisMeasures(request.Kind))
    for (const key of ['Shipment', 'Payment']) if (!(row[key] === null || row[key] === 0 || row[key] === 1 || row[key] === 2)) throw orderAnalysisInvalid()
    if (request.Kind === 0 && row.Payment !== null) throw orderAnalysisInvalid()
    return row
  }), groups = list(value.Groups).map(v => group(v, request))
  if (new Set(groups.map(v => JSON.stringify(v.Key))).size !== groups.length) throw orderAnalysisInvalid()
  const available = boolean(value.Available), complete = boolean(value.NormalInputsComplete), observed = boolean(value.SelectedNumbersObserved)
  if (available && (!base.OurSnapshotVerified || !complete || !observed || !base.InputWitnessSha256 || groups.some(group => Object.values(group.Measures).some(number => !number.Observed))) || !base.OurSnapshotVerified && (rows.length || groups.length || base.Choices.length)) throw orderAnalysisInvalid()
  return { ...base, Available: available, Code: text(value.Code), NormalInputsComplete: complete, SelectedNumbersObserved: observed, Rows: rows, Groups: groups }
}
