export const originalMatrixDefinition = {
  source: '069dfc76-74b6-491d-b039-f7fb54e0ea81', schema: 'e1bb727a-9d3f-4947-92d0-200ae0f143e5',
  hash: '443b34ce3fff87a1d3a5072f997b64ea2b85a53f115143fefd9c8028444d9338',
} as const
export type MatrixRequest = {
  Version: 1; World: 'fenix' | 'amg'; SourceId: string; SchemaId: string; DefinitionSha256: string;
  From: string; Through: string; GroupId: number; GroupReference: string;
}
export type MatrixCapability = {
  Version: 1; World: 'fenix' | 'amg'; SourceId: string; SchemaId: string; DefinitionSha256: string;
  Executable: boolean; PeriodPolicy: 'InclusiveCalendarWholeSecondsSingleMonth'; GroupPolicy: 'ExactSourceLeafProductGroup';
  MaximumProductRows: 128; MaximumColumns: 262; QuantityEncoding: 'InvariantDecimalString'; RequiresCompleteNormalInputs: true;
  SourceParityVerified: boolean; OriginalFullTaskAccepted: boolean;
}
export type MatrixGroup = 'Counterparties' | 'Stock' | 'Sales'
export type MatrixColumn = { Group: MatrixGroup; Caption: string; RegionCode: string | null; MeasureCaption: string | null }
export type MatrixRow = { ProductReference: string; Caption: string; Values: (string | null)[] }
export type MatrixResult = MatrixRequest & {
  GroupCaption: string | null; Available: boolean; Code: string; NormalInputsComplete: boolean; OurSnapshotVerified: boolean;
  InputWitnessSha256: string | null; Columns: MatrixColumn[]; Rows: MatrixRow[];
  PeriodPolicy: 'InclusiveCalendarWholeSecondsSingleMonth'; QuantityEncoding: 'InvariantDecimalString';
  SourceParityVerified: boolean; OriginalFullTaskAccepted: boolean;
}
const captions: Record<MatrixGroup, string> = { Counterparties: 'Контрагенты', Stock: 'Остатки', Sales: 'Продажи' }
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const reference = (v: unknown): v is string => typeof v === 'string' && /^[A-F0-9]{32}$/.test(v) && v !== '0'.repeat(32)
const text = (v: unknown): v is string => typeof v === 'string' && v.length <= 8192
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)
const group = (v: unknown): v is MatrixGroup => v === 'Counterparties' || v === 'Stock' || v === 'Sales'
function invalid() { return new Error('Сервер не підтвердив повну матрицю для обраної групи та періоду.') }
const identity = (v: Record<string, unknown>) => v.Version === 1 && (v.World === 'fenix' || v.World === 'amg')
  && v.SourceId === originalMatrixDefinition.source && v.SchemaId === originalMatrixDefinition.schema && v.DefinitionSha256 === originalMatrixDefinition.hash
const policy = (v: Record<string, unknown>) => v.PeriodPolicy === 'InclusiveCalendarWholeSecondsSingleMonth' && v.QuantityEncoding === 'InvariantDecimalString'
  && typeof v.SourceParityVerified === 'boolean' && typeof v.OriginalFullTaskAccepted === 'boolean' && (!v.OriginalFullTaskAccepted || v.SourceParityVerified)
export function isMatrixCapability(v: unknown): v is MatrixCapability {
  return object(v) && identity(v) && policy(v) && v.Executable === (v.World === 'fenix')
    && v.GroupPolicy === 'ExactSourceLeafProductGroup' && v.MaximumProductRows === 128 && v.MaximumColumns === 262 && v.RequiresCompleteNormalInputs === true
}
function calendar(v: string): boolean {
  if (!/^20[2-9][0-9]-\d{2}-\d{2}$/.test(v) || v < '2025-01-01') return false
  const parsed = new Date(v + 'T00:00:00Z')
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === v
}
export function matrixPeriodError(from: string, through: string): string | null {
  return !calendar(from) || !calendar(through) || through < from || from.slice(0, 7) !== through.slice(0, 7)
    ? 'Оберіть період у межах одного місяця, починаючи з 01.01.2025.' : null
}
export function matrixRequest(capability: MatrixCapability, from: string, through: string, id: number, sourceReference: string): MatrixRequest {
  if (!isMatrixCapability(capability) || !capability.Executable || matrixPeriodError(from, through)
    || !Number.isSafeInteger(id) || id <= 0 || !reference(sourceReference)) throw invalid()
  return { Version: 1, World: capability.World, SourceId: capability.SourceId, SchemaId: capability.SchemaId,
    DefinitionSha256: capability.DefinitionSha256, From: from, Through: through, GroupId: id, GroupReference: sourceReference }
}
/** Validate the .NET decimal envelope without passing quantities through binary floating point. */
export function matrixQuantity(value: unknown): string {
  if (typeof value !== 'string' || value.length > 60 || !/^-?(0|[1-9]\d*)(?:\.\d{1,28})?$/.test(value)) throw invalid()
  const digits = value.replace('-', '').replace('.', '')
  if (BigInt(digits) > 79228162514264337593543950335n) throw invalid()
  return value
}
export const matrixColumnKey = (column: MatrixColumn) => JSON.stringify([column.Group, column.RegionCode])
function columns(values: unknown[]): MatrixColumn[] {
  const keys = new Set<string>(), totals = new Set<MatrixGroup>()
  return values.map(value => {
    if (!object(value) || !group(value.Group) || value.Caption !== captions[value.Group]
      || value.RegionCode !== null && (!text(value.RegionCode) || value.RegionCode.length > 4096)
      || value.MeasureCaption !== (value.RegionCode === null ? null : 'Результат')) throw invalid()
    const column: MatrixColumn = { Group: value.Group, Caption: captions[value.Group], RegionCode: value.RegionCode as string | null, MeasureCaption: value.MeasureCaption as string | null }
    const key = matrixColumnKey(column)
    if (keys.has(key) || column.RegionCode !== null && !totals.has(column.Group)
      || column.Group !== 'Counterparties' && column.RegionCode !== null && column.RegionCode !== '') throw invalid()
    keys.add(key); if (column.RegionCode === null) totals.add(column.Group)
    return column
  })
}
/** Scope identity and sparse physical order are retained for both screen and future exports. */
export function normalizeMatrixResult(value: unknown, request: MatrixRequest): MatrixResult {
  if (!object(value) || !identity(value) || !policy(value) || Object.entries(request).some(([key, item]) => value[key] !== item)
    || typeof value.Available !== 'boolean' || typeof value.Code !== 'string' || !value.Code.startsWith('original_vparivanie_')
    || typeof value.NormalInputsComplete !== 'boolean' || typeof value.OurSnapshotVerified !== 'boolean'
    || !Array.isArray(value.Columns) || value.Columns.length > 262 || !Array.isArray(value.Rows) || value.Rows.length > 128
    || value.Columns.length * value.Rows.length > 50000 || value.GroupCaption !== null && !text(value.GroupCaption)) throw invalid()
  if (!value.Available) {
    if (value.NormalInputsComplete || value.OurSnapshotVerified || value.InputWitnessSha256 !== null || value.GroupCaption !== null
      || value.Rows.length || value.Columns.length || value.Code === 'original_vparivanie_current_our') throw invalid()
    return { ...request, ...value } as MatrixResult
  }
  if (value.World !== 'fenix' || !value.NormalInputsComplete || !value.OurSnapshotVerified || !hash(value.InputWitnessSha256)
    || !text(value.GroupCaption) || value.Code !== 'original_vparivanie_current_our' || (value.Rows.length === 0) !== (value.Columns.length === 0)) throw invalid()
  const readColumns = columns(value.Columns), keys = new Set<string>()
  const totalIndexes = new Map(readColumns.flatMap((column, index) => column.RegionCode === null ? [[column.Group, index] as const] : []))
  for (const family of ['Stock', 'Sales'] as const) {
    const familyColumns = readColumns.filter(column => column.Group === family)
    if (familyColumns.length && (familyColumns.length !== 2 || familyColumns[0].RegionCode !== null || familyColumns[1].RegionCode !== '')) throw invalid()
  }
  const rows = value.Rows.map(item => {
    if (!object(item) || !reference(item.ProductReference) || keys.has(item.ProductReference) || !text(item.Caption)
      || !Array.isArray(item.Values) || item.Values.length !== readColumns.length || item.Values.every(cell => cell === null)) throw invalid()
    keys.add(item.ProductReference)
    const values = item.Values.map(cell => cell === null ? null : matrixQuantity(cell))
    readColumns.forEach((column, index) => {
      if (column.RegionCode === null || values[index] === null) return
      const total = totalIndexes.get(column.Group)
      if (total === undefined || values[total] === null || column.Group !== 'Counterparties' && values[total] !== values[index]) throw invalid()
    })
    return { ProductReference: item.ProductReference, Caption: item.Caption, Values: values }
  })
  return { ...request, ...value, Columns: readColumns, Rows: rows } as MatrixResult
}
