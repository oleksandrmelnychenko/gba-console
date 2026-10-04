import type { ReportCatalogueEntry } from '../types'
export const PRICE_SALES_SOURCE = '5543ce7d-61fa-45e2-8b85-5cd40abaccb6'
export const PRICE_SALES_DEFINITION = '255142468c4718edab44f93f32c39b39b4262e536263b156f3bbdb87cddfd38b'
export const priceSalesFilters = ['Контрагент', 'Номенклатура', 'Проект', 'Подразделение'] as const
export const priceSalesMeasures = ['СтоимостьОборот', 'НДСОборот', 'СтоимостьСНДСОборот', 'СтоимостьПоТипуЦен', 'РазницаМеждуСтоимостями', 'КоличествоОборот', 'КоличествоЕдиницОтчетов', 'КоличествоБазовыхЕд', 'СуммаСкидки', 'ПроцентСкидки', 'СтоимостьБезСкидокОборот'] as const
export const priceSalesDefaults = ['СтоимостьСНДСОборот', 'СтоимостьПоТипуЦен', 'РазницаМеждуСтоимостями', 'КоличествоБазовыхЕд']
const priceSalesMeasureSet: ReadonlySet<string> = new Set(priceSalesMeasures)
export type PriceSalesFilter = typeof priceSalesFilters[number]
export type PriceSalesMeasure = typeof priceSalesMeasures[number]
export type PriceSalesCapability = { Version: 1; World: 'fenix'; SourceId: string; DefinitionSha256: string; ModuleSha256: string; QuerySha256: string;
  Executable: boolean; DefaultRows: string[]; Filters: string[]; DefaultMeasures: string[]; Measures: string[]; MoneyPolicy: string; DatePolicy: string;
  PriceSelection: string; AppliesFxConversion: false; ManagementCurrencyPresentationVerified: false; SourceParityVerified: false; OriginalFullTaskAccepted: false }
export type PriceSalesRequest = { Version: 1; World: 'fenix'; SourceId: string; DefinitionSha256: string; From: string; Through: string; PriceType: string;
  Counterparties: string[]; Products: string[]; Projects: string[]; Divisions: string[]; Measures: PriceSalesMeasure[] }
export type PriceSalesChoice = { Key: string; Caption: string }
export type PriceSalesValues = Partial<Record<PriceSalesMeasure, string | null>>
export type PriceSalesProduct = { Product: string; Caption: string; CaptionAvailable: boolean; Values: PriceSalesValues }
export type PriceSalesParty = { Counterparty: string; Caption: string; CaptionAvailable: boolean; Values: PriceSalesValues; Products: PriceSalesProduct[] }
export type PriceSalesResult = PriceSalesRequest & { Available: boolean; Code: string; NormalInputsComplete: boolean; OurSnapshotVerified: true;
  InputWitnessSha256: string | null; ResultSha256: string | null; Rows: PriceSalesParty[]; Totals: PriceSalesValues | null; Choices: Record<PriceSalesFilter, PriceSalesChoice[]>;
  MissingCaptionMappings: PriceSalesFilter[]; Dependency: null | { Kind: string; MissingMonth: string | null; ProductKeys: string[]; MissingKeyCount: number; HasMoreKeys: boolean };
  MoneyPolicy: string; DatePolicy: string; AppliesFxConversion: false; ManagementCurrencyPresentationVerified: false; SourceParityVerified: false; OriginalFullTaskAccepted: false }
export type PriceSalesSelection = { Counterparties: string[]; Products: string[]; Projects: string[]; Divisions: string[] }
export const priceSalesField = { 'Контрагент': 'Counterparties', 'Номенклатура': 'Products', 'Проект': 'Projects', 'Подразделение': 'Divisions' } as const
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const ref = (v: unknown): v is string => typeof v === 'string' && /^[0-9A-F]{32}$/.test(v)
const digest = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v) && !/^0+$/.test(v)
const label = (v: unknown): v is string => typeof v === 'string' && !!v && v === v.trim() && !/\p{Cc}/u.test(v)
const exact = (v: unknown, expected: readonly string[]) => Array.isArray(v) && v.length === expected.length && v.every((x, i) => x === expected[i])
const identity = (v: Record<string, unknown>) => v.Version === 1 && v.World === 'fenix' && v.SourceId === PRICE_SALES_SOURCE && v.DefinitionSha256 === PRICE_SALES_DEFINITION
  && v.MoneyPolicy === 'NativeStoredManagementSalesAndRawGlobalPriceNoFxConversion' && v.DatePolicy === 'InclusiveBusinessDaysThroughLastWholeSecond'
  && v.AppliesFxConversion === false && v.ManagementCurrencyPresentationVerified === false && v.SourceParityVerified === false && v.OriginalFullTaskAccepted === false
export function isPriceSalesCapability(v: unknown): v is PriceSalesCapability {
  return obj(v) && identity(v) && v.ModuleSha256 === '6a0f7b79a80d76bb3990d43e18796bb620fa13822f1e8e162010c8c9800b02bd'
    && v.QuerySha256 === '095974888cc5320a8a9d186cbf7f748be3926dadc3898c525f6b898e0d3a93aa' && typeof v.Executable === 'boolean'
    && exact(v.DefaultRows, ['Контрагент', 'Номенклатура']) && exact(v.Filters, priceSalesFilters) && exact(v.DefaultMeasures, priceSalesDefaults)
    && exact(v.Measures, priceSalesMeasures) && v.PriceSelection === 'DailyLatestExactPriceThenSourceOuterJoinWithoutDay'
}
export { statementPeriodError as priceSalesPeriodError } from './originalCounterpartyStatement'
import { statementPeriodError } from './originalCounterpartyStatement'
export function priceSalesRequest(cap: PriceSalesCapability, from: string, through: string, priceType: string, selection: PriceSalesSelection,
  measures: readonly PriceSalesMeasure[] = priceSalesDefaults as PriceSalesMeasure[]): PriceSalesRequest {
  if (!isPriceSalesCapability(cap) || statementPeriodError(from, through) || !ref(priceType) || /^0+$/.test(priceType) || !measures.length
    || new Set(measures).size !== measures.length || measures.some(m => !priceSalesMeasureSet.has(m))
    || Object.values(selection).some(a => a.length > 256 || !a.every(ref) || new Set(a).size !== a.length)) throw new Error('Некоректний запит порівняння продажів за типом цін.')
  const selectedMeasures = new Set(measures)
  return { Version: 1, World: 'fenix', SourceId: PRICE_SALES_SOURCE, DefinitionSha256: PRICE_SALES_DEFINITION, From: from, Through: through, PriceType: priceType,
    Counterparties: [...selection.Counterparties].sort(), Products: [...selection.Products].sort(), Projects: [...selection.Projects].sort(), Divisions: [...selection.Divisions].sort(),
    Measures: priceSalesMeasures.filter(m => selectedMeasures.has(m)) }
}
export function isPriceSalesChoices(v: unknown): v is PriceSalesChoice[] { return Array.isArray(v) && v.every(c => obj(c) && ref(c.Key) && !/^0+$/.test(c.Key) && label(c.Caption)) && new Set(v.map(c => c.Key)).size === v.length }
function values(v: unknown, measures: readonly PriceSalesMeasure[]): v is PriceSalesValues {
  return obj(v) && exact(Object.keys(v), measures) && measures.every(m => {
    const s = v[m]; if (s === null) return ['СтоимостьПоТипуЦен', 'РазницаМеждуСтоимостями'].includes(m)
    const scale = m.startsWith('Количество') ? 3 : 2
    return typeof s === 'string' && s.length <= 400 && new RegExp(`^-?(0|[1-9]\\d*)\\.\\d{${scale}}$`).test(s) && s !== `-0.${'0'.repeat(scale)}`
  })
}
export function normalizePriceSales(v: unknown, request: PriceSalesRequest): PriceSalesResult {
  const fail = () => { throw new Error('Сервер не підтвердив повний оригінал порівняння продажів для поточних параметрів.') }
  if (!obj(v) || !identity(v) || v.From !== request.From || v.Through !== request.Through || v.PriceType !== request.PriceType || !exact(v.Measures, request.Measures)
    || (['Counterparties', 'Products', 'Projects', 'Divisions'] as const).some(k => !exact(v[k], request[k])) || typeof v.Available !== 'boolean'
    || v.NormalInputsComplete !== v.Available || v.OurSnapshotVerified !== true || typeof v.Code !== 'string' || !v.Code.startsWith('original_price_type_sales_')
    || !Array.isArray(v.Rows) || !obj(v.Choices) || !priceSalesFilters.every(f => isPriceSalesChoices((v.Choices as Record<string, unknown>)[f]))
    || !Array.isArray(v.MissingCaptionMappings) || !v.MissingCaptionMappings.every(f => priceSalesFilters.includes(f)) || new Set(v.MissingCaptionMappings).size !== v.MissingCaptionMappings.length) return fail()
  if (!v.Available) {
    const d = v.Dependency
    if (v.Rows.length || v.Totals !== null || v.InputWitnessSha256 !== null || v.ResultSha256 !== null || !priceSalesFilters.every(f => (v.Choices as Record<string, PriceSalesChoice[]>)[f].length === 0)
      || !obj(d) || !label(d.Kind) || d.MissingMonth !== null && (typeof d.MissingMonth !== 'string' || !/^20\d{2}-(0[1-9]|1[0-2])-01$/.test(d.MissingMonth))
      || !Array.isArray(d.ProductKeys) || d.ProductKeys.length > 64 || !d.ProductKeys.every(ref) || new Set(d.ProductKeys).size !== d.ProductKeys.length
      || !Number.isSafeInteger(d.MissingKeyCount) || (d.MissingKeyCount as number) < d.ProductKeys.length || d.HasMoreKeys !== ((d.MissingKeyCount as number) > d.ProductKeys.length)) return fail()
    return v as unknown as PriceSalesResult
  }
  if (v.Code !== 'original_price_type_sales_complete' || v.Dependency !== null || !digest(v.InputWitnessSha256) || !digest(v.ResultSha256) || !values(v.Totals, request.Measures)) return fail()
  const selectedParties = new Set(request.Counterparties), selectedProducts = new Set(request.Products)
  const parties = new Set<string>()
  for (const p of v.Rows) {
    if (!obj(p) || !ref(p.Counterparty) || parties.has(p.Counterparty) || request.Counterparties.length && !selectedParties.has(p.Counterparty)
      || !label(p.Caption) || typeof p.CaptionAvailable !== 'boolean' || !values(p.Values, request.Measures) || !Array.isArray(p.Products) || !p.Products.length) return fail()
    parties.add(p.Counterparty); const products = new Set<string>()
    for (const r of p.Products) {
      if (!obj(r) || !ref(r.Product) || products.has(r.Product) || request.Products.length && !selectedProducts.has(r.Product)
        || !label(r.Caption) || typeof r.CaptionAvailable !== 'boolean' || !values(r.Values, request.Measures)) return fail()
      products.add(r.Product)
    }
  }
  // Child cells are individually rounded by native ЧДЦ; no false sum-equality requirement is imposed on rounded optional ratios.
  return v as unknown as PriceSalesResult
}
export function isPriceSalesCatalogueEntry(report: ReportCatalogueEntry, worlds: readonly string[]) {
  return report.Id === 'builtin:ПродажиСравнениеПоТипуЦен' && worlds.includes('fenix') && report.Sources.some(s => s.World === 'fenix' && s.SourceId === PRICE_SALES_SOURCE && s.DefinitionSha256 === PRICE_SALES_DEFINITION)
}
