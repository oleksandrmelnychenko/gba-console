import type { ReportCatalogueEntry } from '../types'
import { statementPeriodError } from './originalCounterpartyStatement'

export const GOODS_ANALYSIS_SOURCE = '5ec8b517-58d5-4309-9d31-381d89acdcad'
export const GOODS_ANALYSIS_DEFINITION = '6016c3c1511f11e455fa6d0e5a818af34b16656a227b7e16a5dd74a7f3c4f0c1'
export const goodsAnalysisMeasures = ['КоличествоНачальныйОстаток', 'КоличествоКонечныйОстаток'] as const
export const goodsAnalysisFilters = ['Склад', 'Номенклатура'] as const
export type GoodsAnalysisMeasure = typeof goodsAnalysisMeasures[number]
export type GoodsAnalysisValues = Record<GoodsAnalysisMeasure, string>
export type GoodsAnalysisChoice = { Key: string; Caption: string }
export type GoodsAnalysisPolicies = { MoneyPolicy: 'NoMoneyResourceInOriginalDefault'; DatePolicy: 'StrictBeforeStartOpeningAndInclusiveBusinessDaysThroughLastWholeSecond';
  OpeningRowPolicy: 'NonzeroFullFiveDimensionOpeningQuantityJoinOnWarehouseProductCharacteristicQualityWithoutSeries';
  AntiSalesPolicy: 'GlobalRecorderPeriodFull13SalesGrainPositiveQuantityNoWarehouseFilter';
  AppliesFxConversion: false; ManagementCurrencyPresentationVerified: false; SourceParityVerified: false; OriginalFullTaskAccepted: false }
type GoodsAnalysisIdentity = { Version: 1; World: 'fenix'; SourceId: string; DefinitionSha256: string }
export type GoodsAnalysisCapability = GoodsAnalysisIdentity & GoodsAnalysisPolicies & { ModuleSha256: string; QuerySha256: string;
  Executable: boolean; DefaultRows: string[]; Filters: string[]; DefaultMeasures: string[]; Measures: string[];
  DefaultScopeCode: 'original_goods_stock_analysis_default_v1'; SourceSyncEnabled: boolean; NativeVirtualBoundaryParityVerified: boolean }
export type GoodsAnalysisRequest = GoodsAnalysisIdentity & { From: string; Through: string; Warehouses: string[]; Products: string[] }
export type GoodsAnalysisProduct = { Product: string; Caption: string; CaptionAvailable: boolean; Values: GoodsAnalysisValues }
export type GoodsAnalysisWarehouse = { Warehouse: string; Caption: string; CaptionAvailable: boolean; Values: GoodsAnalysisValues; Products: GoodsAnalysisProduct[] }
export type GoodsAnalysisResult = GoodsAnalysisRequest & GoodsAnalysisPolicies & { Measures: GoodsAnalysisMeasure[]; Available: boolean; Code: string;
  NormalInputsComplete: boolean; OurSnapshotVerified: true; InputWitnessSha256: string | null; ResultSha256: string | null;
  Rows: GoodsAnalysisWarehouse[]; Totals: GoodsAnalysisValues | null; Choices: Record<typeof goodsAnalysisFilters[number], GoodsAnalysisChoice[]>;
  MissingCaptionMappings: string[]; Dependency: null | { Kind: string; MissingMonth: string | null }; QuantityPolicy: 'NativeStoredQuantityNoCoefficientConversion' }
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const ref = (v: unknown): v is string => typeof v === 'string' && /^[0-9A-F]{32}$/.test(v)
const digest = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v) && !/^0+$/.test(v)
const quantityPattern = /^-?(0|[1-9]\d*)\.\d{3}$/
const caption = (v: unknown): v is string => typeof v === 'string' && !!v.trim() && !/\p{Cc}/u.test(v)
const exact = (v: unknown, expected: readonly string[]) => Array.isArray(v) && v.length === expected.length && v.every((x, i) => x === expected[i])
const identity = (v: Record<string, unknown>) => v.Version === 1 && v.World === 'fenix' && v.SourceId === GOODS_ANALYSIS_SOURCE && v.DefinitionSha256 === GOODS_ANALYSIS_DEFINITION
const policies = (v: Record<string, unknown>) => v.MoneyPolicy === 'NoMoneyResourceInOriginalDefault'
  && v.DatePolicy === 'StrictBeforeStartOpeningAndInclusiveBusinessDaysThroughLastWholeSecond' && v.OpeningRowPolicy === 'NonzeroFullFiveDimensionOpeningQuantityJoinOnWarehouseProductCharacteristicQualityWithoutSeries'
  && v.AntiSalesPolicy === 'GlobalRecorderPeriodFull13SalesGrainPositiveQuantityNoWarehouseFilter'
  && v.AppliesFxConversion === false && v.ManagementCurrencyPresentationVerified === false && v.SourceParityVerified === false && v.OriginalFullTaskAccepted === false
export function isGoodsAnalysisCapability(v: unknown): v is GoodsAnalysisCapability {
  return object(v) && identity(v) && policies(v) && v.ModuleSha256 === '5accca51ad486a2834ed6c138c95fa5d97bc4b5839fc9123026c54b62f3a5b55'
    && v.QuerySha256 === 'e27581b8b470d0be638f1dab05392559d21ceb8d9c742c44ceae57a8665280e2' && typeof v.Executable === 'boolean'
    && exact(v.DefaultRows, goodsAnalysisFilters) && exact(v.Filters, goodsAnalysisFilters) && exact(v.DefaultMeasures, goodsAnalysisMeasures)
    && exact(v.Measures, goodsAnalysisMeasures) && v.DefaultScopeCode === 'original_goods_stock_analysis_default_v1'
    && typeof v.SourceSyncEnabled === 'boolean' && typeof v.NativeVirtualBoundaryParityVerified === 'boolean'
}
export { statementPeriodError as goodsAnalysisPeriodError }
export function goodsAnalysisRequest(capability: GoodsAnalysisCapability, from: string, through: string,
  warehouses: readonly string[] = [], products: readonly string[] = []): GoodsAnalysisRequest {
  if (!isGoodsAnalysisCapability(capability) || !capability.Executable || statementPeriodError(from, through)
    || [warehouses, products].some(keys => keys.length > 256 || !keys.every(ref) || new Set(keys).size !== keys.length))
    throw new Error('Некоректний запит аналізу товарних залишків.')
  return { Version: 1, World: 'fenix', SourceId: GOODS_ANALYSIS_SOURCE, DefinitionSha256: GOODS_ANALYSIS_DEFINITION,
    From: from, Through: through, Warehouses: [...warehouses].sort(), Products: [...products].sort() }
}
export function goodsAnalysisScaled(value: unknown, measure: GoodsAnalysisMeasure): bigint {
  if (!goodsAnalysisMeasures.includes(measure)) throw new Error('Некоректний показник товарних залишків.')
  const scale = 3
  if (typeof value !== 'string' || value.length > 400 || !quantityPattern.test(value)
    || value === `-0.${'0'.repeat(scale)}`) throw new Error('Некоректне значення аналізу товарних залишків.')
  return BigInt(value.replace('.', ''))
}
function values(v: unknown): v is GoodsAnalysisValues {
  return object(v) && Object.keys(v).length === goodsAnalysisMeasures.length && goodsAnalysisMeasures.every(m => {
    goodsAnalysisScaled(v[m], m); return true
  })
}
const sumEquals = (total: GoodsAnalysisValues, parts: GoodsAnalysisValues[]) => goodsAnalysisMeasures.every(m =>
  goodsAnalysisScaled(total[m], m) === parts.reduce((sum, row) => sum + goodsAnalysisScaled(row[m], m), 0n))
function choices(v: unknown): v is GoodsAnalysisChoice[] {
  return Array.isArray(v) && v.every(c => object(c) && ref(c.Key) && caption(c.Caption))
    && new Set(v.map(c => c.Key)).size === v.length
}
/** Bind the one complete server result to the current caller's exact original and filters before display or export. */
export function normalizeGoodsAnalysis(v: unknown, request: GoodsAnalysisRequest): GoodsAnalysisResult {
  const fail = () => { throw new Error('Сервер не підтвердив повний аналіз товарних залишків для поточних параметрів.') }
  if (!identity(request) || !object(v) || !identity(v) || !policies(v) || v.From !== request.From || v.Through !== request.Through
    || !exact(v.Warehouses, request.Warehouses) || !exact(v.Products, request.Products) || !exact(v.Measures, goodsAnalysisMeasures)
    || typeof v.Available !== 'boolean' || v.NormalInputsComplete !== v.Available || v.OurSnapshotVerified !== true
    || v.QuantityPolicy !== 'NativeStoredQuantityNoCoefficientConversion' || typeof v.Code !== 'string' || !v.Code.startsWith('original_goods_stock_analysis_')
    || !Array.isArray(v.Rows) || !object(v.Choices) || !exact(Object.keys(v.Choices).sort(), [...goodsAnalysisFilters].sort())
    || !goodsAnalysisFilters.every(field => choices((v.Choices as Record<string, unknown>)[field]))
    || !Array.isArray(v.MissingCaptionMappings) || !v.MissingCaptionMappings.every(f => goodsAnalysisFilters.includes(f))
    || new Set(v.MissingCaptionMappings).size !== v.MissingCaptionMappings.length) return fail()
  if (!v.Available) {
    if (v.Rows.length || v.Totals !== null || v.InputWitnessSha256 !== null || v.ResultSha256 !== null
      || !goodsAnalysisFilters.every(f => (v.Choices as Record<string, GoodsAnalysisChoice[]>)[f].length === 0)
      || !object(v.Dependency) || !caption(v.Dependency.Kind) || v.Dependency.MissingMonth !== null
        && (typeof v.Dependency.MissingMonth !== 'string' || !/^20\d{2}-(0[1-9]|1[0-2])-01$/.test(v.Dependency.MissingMonth))) return fail()
    return structuredClone(v) as GoodsAnalysisResult
  }
  if (v.Code !== 'original_goods_stock_analysis_complete' || v.Dependency !== null || !digest(v.InputWitnessSha256) || !digest(v.ResultSha256)
    || !values(v.Totals) || v.Rows.length > 200_000) return fail()
  const selectedWarehouses = new Set(request.Warehouses), selectedProducts = new Set(request.Products)
  const warehouses = new Set<string>(); let productRows = 0
  for (const row of v.Rows) {
    if (!object(row) || !ref(row.Warehouse) || warehouses.has(row.Warehouse) || selectedWarehouses.size && !selectedWarehouses.has(row.Warehouse)
      || !caption(row.Caption) || typeof row.CaptionAvailable !== 'boolean' || !values(row.Values) || !Array.isArray(row.Products) || !row.Products.length) return fail()
    warehouses.add(row.Warehouse); const products = new Set<string>()
    for (const product of row.Products) {
      if (!object(product) || !ref(product.Product) || products.has(product.Product) || selectedProducts.size && !selectedProducts.has(product.Product)
        || !caption(product.Caption) || typeof product.CaptionAvailable !== 'boolean' || !values(product.Values) || ++productRows > 200_000) return fail()
      products.add(product.Product)
    }
    if (!sumEquals(row.Values, row.Products.map(product => (product as GoodsAnalysisProduct).Values))) return fail()
  }
  if (!sumEquals(v.Totals, v.Rows.map(row => (row as GoodsAnalysisWarehouse).Values))) return fail()
  return structuredClone(v) as GoodsAnalysisResult
}
export function isGoodsAnalysisCatalogueEntry(report: ReportCatalogueEntry, worlds: readonly string[]) {
  return report.Id === 'builtin:АнализОстатковТоваровНаСкладах' && worlds.includes('fenix')
    && report.Sources.some(s => s.World === 'fenix' && s.SourceId === GOODS_ANALYSIS_SOURCE && s.DefinitionSha256 === GOODS_ANALYSIS_DEFINITION)
}
