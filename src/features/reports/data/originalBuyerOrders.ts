import type { ReportCatalogueEntry } from '../types'
export const BUYER_ORDERS_SOURCE = '87be2853-126a-4dc0-8ae3-287368bfddee'
export const BUYER_ORDERS_DEFINITION = '64b4ede28f39a55ddde49436443453019bbc8f201e19917a99fbc47d707d546a'
const moduleHash = '21b55e41d955357dc0ab1187a04172fdb4283a6bbaa7c94c1e3a1e9b5cc01746'
export const buyerOrdersMeasures = ['КоличествоБазовыхЕдНачальныйОстаток', 'КоличествоБазовыхЕдПриход', 'КоличествоБазовыхЕдРасход', 'КоличествоБазовыхЕдКонечныйОстаток',
  'КоличествоНачальныйОстаток', 'КоличествоПриход', 'КоличествоРасход', 'КоличествоКонечныйОстаток']
export type BuyerOrdersField = 0 | 1 | 2 | 3
export type BuyerOrdersGroupValue = { Field: BuyerOrdersField; Type: string | null; Table: string | null; Reference: string }
export type BuyerOrdersMeasure = { Opening: string; Incoming: string; Outgoing: string; Closing: string }
export type BuyerOrdersCapability = { Version: 1; World: 'fenix' | 'amg'; SourceId: string; DefinitionSha256: string; ModuleSha256: string;
  Executable: boolean; Title: string; MaximumInclusiveDays: 366; DefaultRows: BuyerOrdersField[]; FilterFields: BuyerOrdersField[]; DefaultMeasures: string[];
  UnitPolicy: 'ExactStorageCoefficientBeforeAggregation'; RequiresReportUnitCoefficient: false; NativeRoundingVerified: false; SourceParityVerified: false; OriginalFullTaskAccepted: false }
export type BuyerOrdersRequest = { Version: 1; World: 'fenix' | 'amg'; SourceId: string; DefinitionSha256: string; From: string; Through: string;
  Rows: BuyerOrdersField[]; Filters: BuyerOrdersGroupValue[] }
export type BuyerOrdersResult = { Version: 1; World: 'fenix' | 'amg'; SourceId: string; DefinitionSha256: string; From: string; Through: string;
  Available: boolean; Code: string; NormalInputsComplete: boolean; OurSnapshotVerified: boolean; InputWitnessSha256: string | null; ResultSha256: string;
  Rows: Array<{ Key: BuyerOrdersGroupValue[]; Base: BuyerOrdersMeasure; Stored: BuyerOrdersMeasure }>;
  BaseTotals: BuyerOrdersMeasure | null; StoredTotals: BuyerOrdersMeasure | null; ProductChoices: Array<{ Key: string; Caption: string }>;
  FieldChoices: Array<{ Value: BuyerOrdersGroupValue; Caption: string }>; MissingProductRoleKeys: string[]; MissingStorageUnitKeys: string[];
  MissingProductRoleCount: number; MissingStorageUnitCount: number; FilterSummary: string[]; UnitPolicy: 'ExactStorageCoefficientBeforeAggregation';
  NumberPresentation: 'ExactUnroundedDecimalAtLeastThreePlaces'; RequiresReportUnitCoefficient: false; AppliesFxConversion: false;
  NativeRoundingVerified: false; SourceParityVerified: false; OriginalFullTaskAccepted: false; OrderCaptionAvailable: false }
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const ref = (v: unknown) => typeof v === 'string' && /^[0-9A-F]{32}$/.test(v)
const hash = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v)
const list = (v: unknown, expected: readonly unknown[]) => Array.isArray(v) && v.length === expected.length && v.every((item, i) => item === expected[i])
const field = (v: unknown): v is BuyerOrdersField => v === 0 || v === 1 || v === 2 || v === 3
const value = (v: unknown): v is BuyerOrdersGroupValue => object(v) && field(v.Field) && ref(v.Reference) && (v.Field === 0
  ? typeof v.Type === 'string' && /^[0-9A-F]{2}$/.test(v.Type) && typeof v.Table === 'string' && /^[0-9A-F]{8}$/.test(v.Table)
  : v.Type === null && v.Table === null)
export const buyerOrdersValueKey = (v: BuyerOrdersGroupValue) => JSON.stringify([v.Field, v.Type, v.Table, v.Reference])
const identity = (v: Record<string, unknown>) => v.Version === 1 && (v.World === 'fenix' || v.World === 'amg')
  && v.SourceId === BUYER_ORDERS_SOURCE && v.DefinitionSha256 === BUYER_ORDERS_DEFINITION && v.UnitPolicy === 'ExactStorageCoefficientBeforeAggregation'
  && v.RequiresReportUnitCoefficient === false && v.NativeRoundingVerified === false && v.SourceParityVerified === false && v.OriginalFullTaskAccepted === false
export function isBuyerOrdersCapability(v: unknown): v is BuyerOrdersCapability {
  return object(v) && identity(v) && v.ModuleSha256 === moduleHash && v.Executable === (v.World === 'fenix') && typeof v.Title === 'string' && !!v.Title.trim()
    && v.MaximumInclusiveDays === 366 && list(v.DefaultRows, [0, 1]) && list(v.FilterFields, [0, 1, 2, 3]) && list(v.DefaultMeasures, buyerOrdersMeasures)
}
export function isBuyerOrdersCatalogueEntry(report: ReportCatalogueEntry, worlds: readonly string[] = ['fenix']) {
  return report.Id === 'builtin:ВедомостьЗаказыПокупателей' && worlds.includes('fenix')
    && report.Sources.some(s => s.World === 'fenix' && s.SourceId === BUYER_ORDERS_SOURCE)
}
const date = (v: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || v < '0001-02-01' || v >= '3999-01-01') return null
  const ms = Date.parse(`${v}T00:00:00Z`)
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === v ? ms : null
}
export function buyerOrdersPeriodError(from: string, through: string): string | null {
  const a = date(from), b = date(through)
  return a === null || b === null || a > b || (b - a) / 86_400_000 >= 366 ? 'Оберіть явний період до 366 календарних днів.' : null
}
export function buyerOrdersRequest(capability: BuyerOrdersCapability, from: string, through: string,
  filters: readonly BuyerOrdersGroupValue[] = [], rows: readonly BuyerOrdersField[] = [0, 1]): BuyerOrdersRequest {
  if (!isBuyerOrdersCapability(capability) || !capability.Executable || buyerOrdersPeriodError(from, through) || rows.length > 4
    || rows.some(r => !field(r)) || new Set(rows).size !== rows.length || filters.length > 256 || filters.some(f => !value(f))
    || new Set(filters.map(buyerOrdersValueKey)).size !== filters.length) throw new Error('Некоректний запит відомості замовлень покупців.')
  return { Version: 1, World: capability.World, SourceId: capability.SourceId, DefinitionSha256: capability.DefinitionSha256,
    From: from, Through: through, Rows: [...rows], Filters: filters.map(f => ({ ...f })) }
}
/** Exact six-place integer arithmetic, with no Number or inferred native rounding. */
export function buyerOrdersScaled(v: unknown, stored = false): bigint {
  if (typeof v !== 'string' || v.length > 100 || !(stored ? /^-?(0|[1-9]\d*)\.\d{3}$/ : /^-?(0|[1-9]\d*)\.\d{3,6}$/).test(v))
    throw new Error('Некоректна точна кількість.')
  const [whole, fraction] = v.split('.')
  const number = BigInt(`${whole}${fraction.padEnd(6, '0')}`)
  if (number === 0n && v.startsWith('-')) throw new Error('Неканонічна нульова кількість.')
  return number
}
const stages = ['Opening', 'Incoming', 'Outgoing', 'Closing'] as const
const measure = (v: unknown, stored: boolean): v is BuyerOrdersMeasure => object(v)
  && buyerOrdersScaled(v.Closing, stored) === buyerOrdersScaled(v.Opening, stored) + buyerOrdersScaled(v.Incoming, stored) - buyerOrdersScaled(v.Outgoing, stored)
const sumEquals = (total: BuyerOrdersMeasure, parts: BuyerOrdersMeasure[], stored: boolean) => stages.every(stage =>
  buyerOrdersScaled(total[stage], stored) === parts.reduce((sum, p) => sum + buyerOrdersScaled(p[stage], stored), 0n))
const missing = (keys: unknown, count: unknown) => Array.isArray(keys) && keys.length <= 64 && keys.every(ref)
  && new Set(keys).size === keys.length && typeof count === 'number' && Number.isSafeInteger(count) && count >= keys.length && count <= 200_000
  && keys.length === Math.min(count, 64)
export function normalizeBuyerOrders(v: unknown, request: BuyerOrdersRequest): BuyerOrdersResult {
  const invalid = () => { throw new Error('Сервер не підтвердив повний результат замовлень покупців.') }
  if (!object(v) || !identity(v) || v.World !== request.World || v.From !== request.From || v.Through !== request.Through
    || typeof v.Available !== 'boolean' || typeof v.NormalInputsComplete !== 'boolean' || typeof v.OurSnapshotVerified !== 'boolean'
    || typeof v.Code !== 'string' || !v.Code.startsWith('original_buyer_orders_') || !hash(v.ResultSha256)
    || (v.NormalInputsComplete ? !hash(v.InputWitnessSha256) : v.InputWitnessSha256 !== null)
    || !Array.isArray(v.Rows) || v.Rows.length > 200_000 || !Array.isArray(v.ProductChoices) || v.ProductChoices.length > 200_000
    || !Array.isArray(v.FieldChoices) || v.FieldChoices.length > 800_000 || !Array.isArray(v.FilterSummary) || v.FilterSummary.some(s => typeof s !== 'string')
    || !missing(v.MissingProductRoleKeys, v.MissingProductRoleCount) || !missing(v.MissingStorageUnitKeys, v.MissingStorageUnitCount)
    || v.NumberPresentation !== 'ExactUnroundedDecimalAtLeastThreePlaces' || v.AppliesFxConversion !== false || v.OrderCaptionAvailable !== false) return invalid()
  const choices = new Set<string>(), products = new Set<string>()
  for (const c of v.FieldChoices) {
    if (!object(c) || !value(c.Value) || typeof c.Caption !== 'string' || !c.Caption.trim() || choices.has(buyerOrdersValueKey(c.Value))) return invalid()
    choices.add(buyerOrdersValueKey(c.Value))
  }
  for (const c of v.ProductChoices) {
    if (!object(c) || !ref(c.Key) || typeof c.Caption !== 'string' || !c.Caption.trim() || products.has(c.Key as string)) return invalid()
    products.add(c.Key as string)
  }
  if (!v.Available) {
    if (v.Rows.length || v.BaseTotals !== null || v.StoredTotals !== null) return invalid()
    return structuredClone(v) as BuyerOrdersResult
  }
  if (v.World !== 'fenix' || !v.NormalInputsComplete || !v.OurSnapshotVerified || v.Code !== 'original_buyer_orders_OUR_complete'
    || v.MissingProductRoleCount !== 0 || v.MissingStorageUnitCount !== 0 || !measure(v.BaseTotals, false) || !measure(v.StoredTotals, true)) return invalid()
  const keys = new Set<string>()
  for (const row of v.Rows) {
    if (!object(row) || !Array.isArray(row.Key) || row.Key.length !== request.Rows.length || row.Key.some((k, i) => !value(k) || k.Field !== request.Rows[i])
      || !measure(row.Base, false) || !measure(row.Stored, true)) return invalid()
    const key = JSON.stringify(row.Key.map(k => buyerOrdersValueKey(k as BuyerOrdersGroupValue)))
    if (keys.has(key)) return invalid(); keys.add(key)
    for (const k of row.Key as BuyerOrdersGroupValue[]) {
      const selections = request.Filters.filter(f => f.Field === k.Field)
      if (!choices.has(buyerOrdersValueKey(k)) || selections.length > 0 && !selections.some(f => buyerOrdersValueKey(f) === buyerOrdersValueKey(k))) return invalid()
    }
  }
  if (!sumEquals(v.BaseTotals, v.Rows.map(row => row.Base as BuyerOrdersMeasure), false)
    || !sumEquals(v.StoredTotals, v.Rows.map(row => row.Stored as BuyerOrdersMeasure), true)) return invalid()
  return structuredClone(v) as BuyerOrdersResult
}
