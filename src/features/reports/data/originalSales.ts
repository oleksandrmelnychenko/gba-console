import type { ReportCatalogueEntry } from '../types'
export const SALES_SOURCE = '1d3b4053-a6fa-4c32-83be-269e93f7e853'
export const SALES_DEFINITION = '981f54bc951d7c07426f6313c8a563a7d0a7f181f36ab80b311c759df3fffdd0'
export const salesFilters = ['Контрагент', 'Номенклатура', 'Проект', 'Подразделение'] as const
export const salesMeasures = ['СтоимостьОборот', 'НДСОборот', 'СтоимостьСНДСОборот', 'КоличествоОборот', 'КоличествоЕдиницОтчетов', 'КоличествоБазовыхЕд', 'СуммаСкидки', 'ПроцентСкидки', 'СтоимостьБезСкидокОборот'] as const
export const salesDefaults = ['СтоимостьСНДСОборот', 'КоличествоБазовыхЕд']
export type SalesFilter = typeof salesFilters[number]
export type SalesMeasure = typeof salesMeasures[number]
export type SalesCapability = { Version: 1; World: 'fenix'; SourceId: string; DefinitionSha256: string; ModuleSha256: string; QuerySha256: string;
  Executable: boolean; DefaultRows: string[]; Filters: string[]; DefaultMeasures: string[]; Measures: string[]; MoneyPolicy: string; DatePolicy: string;
 AppliesFxConversion: false; ManagementCurrencyPresentationVerified: false; BaseUnitPresentationVerified: false; SourceParityVerified: false; OriginalFullTaskAccepted: false }
export type SalesRequest = { Version: 1; World: 'fenix'; SourceId: string; DefinitionSha256: string; From: string; Through: string;
  Counterparties: string[]; Products: string[]; Projects: string[]; Divisions: string[]; Measures: SalesMeasure[] }
export type SalesChoice = { Key: string; Caption: string }
export type SalesValues = Partial<Record<SalesMeasure, string | null>>
export type SalesProduct = { Product: string; Caption: string; CaptionAvailable: boolean; Values: SalesValues }
export type SalesParty = { Counterparty: string; Caption: string; CaptionAvailable: boolean; Values: SalesValues; Products: SalesProduct[] }
export type SalesResult = SalesRequest & { Available: boolean; Code: string; NormalInputsComplete: boolean; OurSnapshotVerified: true;
  InputWitnessSha256: string | null; ResultSha256: string | null; Rows: SalesParty[]; Totals: SalesValues | null; Choices: Record<SalesFilter, SalesChoice[]>;
  MissingCaptionMappings: SalesFilter[]; Dependency: null | { Kind: string; MissingMonth: string | null; ProductKeys: string[]; MissingKeyCount: number; HasMoreKeys: boolean };
  MoneyPolicy: string; DatePolicy: string; AppliesFxConversion: false; ManagementCurrencyPresentationVerified: false; BaseUnitPresentationVerified: false; SourceParityVerified: false; OriginalFullTaskAccepted: false }
export type SalesSelection = { Counterparties: string[]; Products: string[]; Projects: string[]; Divisions: string[] }
export const salesField = { 'Контрагент': 'Counterparties', 'Номенклатура': 'Products', 'Проект': 'Projects', 'Подразделение': 'Divisions' } as const
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const ref = (v: unknown): v is string => typeof v === 'string' && /^[0-9A-F]{32}$/.test(v)
const digest = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v) && !/^0+$/.test(v)
const label = (v: unknown): v is string => typeof v === 'string' && !!v && v === v.trim() && !/\p{Cc}/u.test(v)
const exact = (v: unknown, expected: readonly string[]) => Array.isArray(v) && v.length === expected.length && v.every((x, i) => x === expected[i])
const identity = (v: Record<string, unknown>) => v.Version === 1 && v.World === 'fenix' && v.SourceId === SALES_SOURCE && v.DefinitionSha256 === SALES_DEFINITION
  && v.MoneyPolicy === 'NativeStoredManagementSalesNoFxConversion' && v.DatePolicy === 'InclusiveBusinessDaysThroughLastWholeSecond'
  && v.AppliesFxConversion === false && v.ManagementCurrencyPresentationVerified === false && v.BaseUnitPresentationVerified === false && v.SourceParityVerified === false && v.OriginalFullTaskAccepted === false
export function isSalesCapability(v: unknown): v is SalesCapability {
  return obj(v) && identity(v) && v.ModuleSha256 === '458578c3b5a09cea2b7847672fb930d4e16645d77fedeed328283fc2921ea0a8'
    && v.QuerySha256 === '58052f01eb6814a6c92483085033c116e34cc4a89506fb4bafae87faf788d717' && typeof v.Executable === 'boolean'
    && exact(v.DefaultRows, ['Контрагент', 'Номенклатура']) && exact(v.Filters, salesFilters) && exact(v.DefaultMeasures, salesDefaults)
    && exact(v.Measures, salesMeasures)
}
export { statementPeriodError as salesPeriodError } from './originalCounterpartyStatement'
import { statementPeriodError } from './originalCounterpartyStatement'
export function salesRequest(cap: SalesCapability, from: string, through: string, selection: SalesSelection,
  measures: readonly SalesMeasure[] = salesDefaults as SalesMeasure[]): SalesRequest {
  if (!isSalesCapability(cap) || statementPeriodError(from, through) || !measures.length
    || new Set(measures).size !== measures.length || measures.some(m => !salesMeasures.includes(m))
    || Object.values(selection).some(a => a.length > 256 || !a.every(ref) || new Set(a).size !== a.length)) throw new Error('Некоректний запит продажів.')
  return { Version: 1, World: 'fenix', SourceId: SALES_SOURCE, DefinitionSha256: SALES_DEFINITION, From: from, Through: through,
    Counterparties: [...selection.Counterparties].sort(), Products: [...selection.Products].sort(), Projects: [...selection.Projects].sort(), Divisions: [...selection.Divisions].sort(),
    Measures: salesMeasures.filter(m => measures.includes(m)) }
}
export function isSalesChoices(v: unknown): v is SalesChoice[] { return Array.isArray(v) && v.every(c => obj(c) && ref(c.Key) && !/^0+$/.test(c.Key) && label(c.Caption)) && new Set(v.map(c => c.Key)).size === v.length }
function values(v: unknown, measures: readonly SalesMeasure[]): v is SalesValues {
  return obj(v) && exact(Object.keys(v), measures) && measures.every(m => {
    const s = v[m]
    const scale = m.startsWith('Количество') ? 3 : 2
    return typeof s === 'string' && s.length <= 400 && new RegExp(`^-?(0|[1-9]\\d*)\\.\\d{${scale}}$`).test(s) && s !== `-0.${'0'.repeat(scale)}`
  })
}
export function normalizeSales(v: unknown, request: SalesRequest): SalesResult {
  const fail = () => { throw new Error('Сервер не підтвердив повний оригінал продажів для поточних параметрів.') }
  if (!obj(v) || !identity(v) || v.From !== request.From || v.Through !== request.Through || !exact(v.Measures, request.Measures)
    || (['Counterparties', 'Products', 'Projects', 'Divisions'] as const).some(k => !exact(v[k], request[k])) || typeof v.Available !== 'boolean'
    || v.NormalInputsComplete !== v.Available || v.OurSnapshotVerified !== true || typeof v.Code !== 'string' || !v.Code.startsWith('original_sales_')
    || !Array.isArray(v.Rows) || !obj(v.Choices) || !salesFilters.every(f => isSalesChoices((v.Choices as Record<string, unknown>)[f]))
    || !Array.isArray(v.MissingCaptionMappings) || !v.MissingCaptionMappings.every(f => salesFilters.includes(f)) || new Set(v.MissingCaptionMappings).size !== v.MissingCaptionMappings.length) return fail()
  if (!v.Available) {
    const d = v.Dependency
    if (v.Rows.length || v.Totals !== null || v.InputWitnessSha256 !== null || v.ResultSha256 !== null || !salesFilters.every(f => (v.Choices as Record<string, SalesChoice[]>)[f].length === 0)
      || !obj(d) || !label(d.Kind) || d.MissingMonth !== null && (typeof d.MissingMonth !== 'string' || !/^20\d{2}-(0[1-9]|1[0-2])-01$/.test(d.MissingMonth))
      || !Array.isArray(d.ProductKeys) || d.ProductKeys.length > 64 || !d.ProductKeys.every(ref) || new Set(d.ProductKeys).size !== d.ProductKeys.length
      || !Number.isSafeInteger(d.MissingKeyCount) || (d.MissingKeyCount as number) < d.ProductKeys.length || d.HasMoreKeys !== ((d.MissingKeyCount as number) > d.ProductKeys.length)) return fail()
    return v as unknown as SalesResult
  }
  if (v.Code !== 'original_sales_complete' || v.Dependency !== null || !digest(v.InputWitnessSha256) || !digest(v.ResultSha256) || !values(v.Totals, request.Measures)) return fail()
  const parties = new Set<string>()
  for (const p of v.Rows) {
    if (!obj(p) || !ref(p.Counterparty) || parties.has(p.Counterparty) || request.Counterparties.length && !request.Counterparties.includes(p.Counterparty)
      || !label(p.Caption) || typeof p.CaptionAvailable !== 'boolean' || !values(p.Values, request.Measures) || !Array.isArray(p.Products) || !p.Products.length) return fail()
    parties.add(p.Counterparty); const products = new Set<string>()
    for (const r of p.Products) {
      if (!obj(r) || !ref(r.Product) || products.has(r.Product) || request.Products.length && !request.Products.includes(r.Product)
        || !label(r.Caption) || typeof r.CaptionAvailable !== 'boolean' || !values(r.Values, request.Measures)) return fail()
      products.add(r.Product)
    }
  }
  // Child cells are individually rounded by native ЧДЦ; no false sum-equality requirement is imposed on rounded optional ratios.
  return v as unknown as SalesResult
}
export function isSalesCatalogueEntry(report: ReportCatalogueEntry, worlds: readonly string[]) {
  return report.Id === 'builtin:Продажи' && worlds.includes('fenix') && report.Sources.some(s => s.World === 'fenix' && s.SourceId === SALES_SOURCE && s.DefinitionSha256 === SALES_DEFINITION)
}
