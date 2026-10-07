import type { ReportCatalogueEntry } from '../types'
import { statementPeriodError } from './originalCounterpartyStatement'

export const LOT_ANALYSIS_SOURCE = 'a820d1c6-3eb2-4283-9aa2-de7e80ad0c42'
export const LOT_ANALYSIS_DEFINITION = '0a4eaf2df279934e70ca0eb9ea921fb969aaf1d0ce64364539870ee981154b6b'
export const lotAnalysisMeasures = ['КоличествоНачальныйОстаток', 'СтоимостьНачальныйОстаток', 'КоличествоКонечныйОстаток', 'СтоимостьКонечныйОстаток'] as const
export const lotAnalysisFilters = ['Склад', 'Номенклатура'] as const
export type LotAnalysisMeasure = typeof lotAnalysisMeasures[number]
export type LotAnalysisValues = Record<LotAnalysisMeasure, string>
export type LotAnalysisChoice = { Key: string; Caption: string }
export type LotAnalysisPolicies = { MoneyPolicy: 'NativeManagementCostPlusVatNoFxConversion'; DatePolicy: 'InclusiveBusinessDaysThroughLastWholeSecond';
  OpeningRowPolicy: 'FullLotGrainOpeningQuantityOrNetOrVatNonzeroBeforeDisplayGrouping';
  AntiSalesPolicy: 'GlobalFull13ComponentSalesGrainAnyNonzeroSignedResourceNoWarehouseOrBuyerFilter';
  AppliesFxConversion: false; ManagementCurrencyPresentationVerified: false; SourceParityVerified: false; OriginalFullTaskAccepted: false }
type LotAnalysisIdentity = { Version: 1; World: 'fenix'; SourceId: string; DefinitionSha256: string }
export type LotAnalysisCapability = LotAnalysisIdentity & LotAnalysisPolicies & { ModuleSha256: string; QuerySha256: string;
  Executable: boolean; DefaultRows: string[]; Filters: string[]; DefaultMeasures: string[]; Measures: string[];
  UnsupportedBuyerPolicy: 'NonemptySelectorRejectedUntilEffectiveOriginalUiRecovered' }
export type LotAnalysisRequest = LotAnalysisIdentity & { From: string; Through: string; Warehouses: string[]; Products: string[]; Buyers: [] }
export type LotAnalysisProduct = { Product: string; Caption: string; CaptionAvailable: boolean; Values: LotAnalysisValues }
export type LotAnalysisWarehouse = { Warehouse: string; Caption: string; CaptionAvailable: boolean; Values: LotAnalysisValues; Products: LotAnalysisProduct[] }
export type LotAnalysisResult = LotAnalysisRequest & LotAnalysisPolicies & { Measures: LotAnalysisMeasure[]; Available: boolean; Code: string;
  NormalInputsComplete: boolean; OurSnapshotVerified: true; InputWitnessSha256: string | null; ResultSha256: string | null;
  Rows: LotAnalysisWarehouse[]; Totals: LotAnalysisValues | null; Choices: Record<typeof lotAnalysisFilters[number], LotAnalysisChoice[]>;
  MissingCaptionMappings: string[]; Dependency: null | { Kind: string; MissingMonth: string | null }; QuantityPolicy: 'NativeStoredQuantityNoCoefficientConversion' }
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const ref = (v: unknown): v is string => typeof v === 'string' && /^[0-9A-F]{32}$/.test(v)
const digest = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v) && !/^0+$/.test(v)
const resourcePatterns = { 2: /^-?(0|[1-9]\d*)\.\d{2}$/, 3: /^-?(0|[1-9]\d*)\.\d{3}$/ }
const caption = (v: unknown): v is string => typeof v === 'string' && !!v.trim() && !/\p{Cc}/u.test(v)
const exact = (v: unknown, expected: readonly string[]) => Array.isArray(v) && v.length === expected.length && v.every((x, i) => x === expected[i])
const identity = (v: Record<string, unknown>) => v.Version === 1 && v.World === 'fenix' && v.SourceId === LOT_ANALYSIS_SOURCE && v.DefinitionSha256 === LOT_ANALYSIS_DEFINITION
const policies = (v: Record<string, unknown>) => v.MoneyPolicy === 'NativeManagementCostPlusVatNoFxConversion'
  && v.DatePolicy === 'InclusiveBusinessDaysThroughLastWholeSecond' && v.OpeningRowPolicy === 'FullLotGrainOpeningQuantityOrNetOrVatNonzeroBeforeDisplayGrouping'
  && v.AntiSalesPolicy === 'GlobalFull13ComponentSalesGrainAnyNonzeroSignedResourceNoWarehouseOrBuyerFilter'
  && v.AppliesFxConversion === false && v.ManagementCurrencyPresentationVerified === false && v.SourceParityVerified === false && v.OriginalFullTaskAccepted === false
export function isLotAnalysisCapability(v: unknown): v is LotAnalysisCapability {
  return object(v) && identity(v) && policies(v) && v.ModuleSha256 === 'f86e1793f36b1ced8bf531c16ffaa8106262eeb32509d4200738bf675b50d781'
    && v.QuerySha256 === '35d7c5117690b1ff7f9f81ba335808907b4c9d0fbaa776ad32791099711ff4b2' && typeof v.Executable === 'boolean'
    && exact(v.DefaultRows, lotAnalysisFilters) && exact(v.Filters, lotAnalysisFilters) && exact(v.DefaultMeasures, lotAnalysisMeasures)
    && exact(v.Measures, lotAnalysisMeasures) && v.UnsupportedBuyerPolicy === 'NonemptySelectorRejectedUntilEffectiveOriginalUiRecovered'
}
export { statementPeriodError as lotAnalysisPeriodError }
export function lotAnalysisRequest(capability: LotAnalysisCapability, from: string, through: string,
  warehouses: readonly string[] = [], products: readonly string[] = []): LotAnalysisRequest {
  if (!isLotAnalysisCapability(capability) || !capability.Executable || statementPeriodError(from, through)
    || [warehouses, products].some(keys => keys.length > 256 || !keys.every(ref) || new Set(keys).size !== keys.length))
    throw new Error('Некоректний запит аналізу залишків партій.')
  return { Version: 1, World: 'fenix', SourceId: LOT_ANALYSIS_SOURCE, DefinitionSha256: LOT_ANALYSIS_DEFINITION,
    From: from, Through: through, Warehouses: [...warehouses].sort(), Products: [...products].sort(), Buyers: [] }
}
export function lotAnalysisScaled(value: unknown, measure: LotAnalysisMeasure): bigint {
  const scale = measure.startsWith('Количество') ? 3 : 2
  if (typeof value !== 'string' || value.length > 400 || !resourcePatterns[scale].test(value)
    || value === `-0.${'0'.repeat(scale)}`) throw new Error('Некоректне значення аналізу залишків партій.')
  return BigInt(value.replace('.', ''))
}
function values(v: unknown): v is LotAnalysisValues {
  return object(v) && Object.keys(v).length === lotAnalysisMeasures.length && lotAnalysisMeasures.every(m => {
    lotAnalysisScaled(v[m], m); return true
  })
}
const sumEquals = (total: LotAnalysisValues, parts: LotAnalysisValues[]) => lotAnalysisMeasures.every(m =>
  lotAnalysisScaled(total[m], m) === parts.reduce((sum, row) => sum + lotAnalysisScaled(row[m], m), 0n))
function choices(v: unknown): v is LotAnalysisChoice[] {
  return Array.isArray(v) && v.every(c => object(c) && ref(c.Key) && !/^0+$/.test(c.Key) && caption(c.Caption))
    && new Set(v.map(c => c.Key)).size === v.length
}
/** Bind the one complete server result to the current caller's exact original and filters before display or export. */
export function normalizeLotAnalysis(v: unknown, request: LotAnalysisRequest): LotAnalysisResult {
  const fail = () => { throw new Error('Сервер не підтвердив повний аналіз залишків партій для поточних параметрів.') }
  if (!identity(request) || request.Buyers.length || !object(v) || !identity(v) || !policies(v) || v.From !== request.From || v.Through !== request.Through
    || !exact(v.Warehouses, request.Warehouses) || !exact(v.Products, request.Products) || !exact(v.Buyers, []) || !exact(v.Measures, lotAnalysisMeasures)
    || typeof v.Available !== 'boolean' || v.NormalInputsComplete !== v.Available || v.OurSnapshotVerified !== true
    || v.QuantityPolicy !== 'NativeStoredQuantityNoCoefficientConversion' || typeof v.Code !== 'string' || !v.Code.startsWith('original_lot_balance_analysis_')
    || !Array.isArray(v.Rows) || !object(v.Choices) || !exact(Object.keys(v.Choices).sort(), [...lotAnalysisFilters].sort())
    || !lotAnalysisFilters.every(field => choices((v.Choices as Record<string, unknown>)[field]))
    || !Array.isArray(v.MissingCaptionMappings) || !v.MissingCaptionMappings.every(f => lotAnalysisFilters.includes(f))
    || new Set(v.MissingCaptionMappings).size !== v.MissingCaptionMappings.length) return fail()
  if (!v.Available) {
    if (v.Rows.length || v.Totals !== null || v.InputWitnessSha256 !== null || v.ResultSha256 !== null
      || !lotAnalysisFilters.every(f => (v.Choices as Record<string, LotAnalysisChoice[]>)[f].length === 0)
      || !object(v.Dependency) || !caption(v.Dependency.Kind) || v.Dependency.MissingMonth !== null
        && (typeof v.Dependency.MissingMonth !== 'string' || !/^20\d{2}-(0[1-9]|1[0-2])-01$/.test(v.Dependency.MissingMonth))) return fail()
    return structuredClone(v) as LotAnalysisResult
  }
  if (v.Code !== 'original_lot_balance_analysis_complete' || v.Dependency !== null || !digest(v.InputWitnessSha256) || !digest(v.ResultSha256)
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
    if (!sumEquals(row.Values, row.Products.map(product => (product as LotAnalysisProduct).Values))) return fail()
  }
  if (!sumEquals(v.Totals, v.Rows.map(row => (row as LotAnalysisWarehouse).Values))) return fail()
  return structuredClone(v) as LotAnalysisResult
}
export function isLotAnalysisCatalogueEntry(report: ReportCatalogueEntry, worlds: readonly string[]) {
  return report.Id === 'builtin:АнализОстатковПартийТоваровНаСкладах' && worlds.includes('fenix')
    && report.Sources.some(s => s.World === 'fenix' && s.SourceId === LOT_ANALYSIS_SOURCE && s.DefinitionSha256 === LOT_ANALYSIS_DEFINITION)
}
