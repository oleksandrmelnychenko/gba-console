import type { ReportCatalogueEntry } from '../types'
export const DEBT_SOURCE = '0e9ed1d2-a9c6-4865-89bc-2f25c8b7ebd3'
export const DEBT_DEFINITION = '2e5619aa270ff24982eeec7b6bb40dd5e1098466b15cba20e2481a073945bfda'
export const debtMoneyPolicy = 'NativeStoredManagementAndSettlementResourcesNoFxConversion'
const moduleHash = '33f194d65ae6ccfec4e51ef071d32c460c8a0e3e71747e2b3422c8454a8de3ba'
const queryHash = '657766f9456936f55b5c517bfc6f50ef6fb6301de9f6929c03738d81e9acd629'
export type DebtAmounts = { Management: string; Settlement: string }
export type DebtChoice = { Key: string; Caption: string }
export type DebtCapability = { Version: 1; World: 'fenix'; SourceId: string; DefinitionSha256: string; ModuleSha256: string; QuerySha256: string;
  Executable: true; RequiresCompleteNormalInputs: true; DefaultRows: string[]; DefaultFilters: string[]; DefaultMeasures: string[]; OptionalMeasures: string[];
  DatePolicy: 'OURBalanceBeforeExplicitWholeSecond'; MoneyPolicy: typeof debtMoneyPolicy; EffectiveNativeDateAndSwitchVerified: false;
  ManagementCurrencyPresentationVerified: false; AppliesFxConversion: false; SourceParityVerified: false; OriginalFullTaskAccepted: false }
export type DebtRequest = { Version: 1; World: 'fenix'; SourceId: string; DefinitionSha256: string; AsOf: string; DebtSwitch: number;
  IncludeSettlement: boolean; Organizations: string[]; Counterparties: string[] }
export type DebtPartyRow = { Counterparty: string; Caption: string; CaptionAvailable: boolean; Amounts: DebtAmounts }
export type DebtOrgRow = { Organization: string; Caption: string; CaptionAvailable: boolean; Amounts: DebtAmounts; Counterparties: DebtPartyRow[] }
export type DebtResult = { Version: 1; World: 'fenix'; SourceId: string; DefinitionSha256: string; AsOf: string; DebtSwitch: number; IncludeSettlement: boolean;
  Organizations: string[]; Counterparties: string[];
  Available: boolean; Code: string; NormalInputsComplete: boolean; OurSnapshotVerified: true; InputWitnessSha256: string | null; ResultSha256: string | null;
  Rows: DebtOrgRow[]; Totals: DebtAmounts | null; OrganizationChoices: DebtChoice[]; CounterpartyChoices: DebtChoice[]; MissingCaptionMappings: string[];
  FilterSummary: string[]; Dependency: { OpeningRegister: 0; MovementBranch: 0; RequestedEndpoint: string; MissingMonth: string | null } | null;
  DatePolicy: 'OURBalanceBeforeExplicitWholeSecond'; MoneyPolicy: typeof debtMoneyPolicy; EffectiveNativeDateAndSwitchVerified: false;
  ManagementCurrencyPresentationVerified: false; AppliesFxConversion: false; SourceParityVerified: false; OriginalFullTaskAccepted: false }
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const ref = (v: unknown): v is string => typeof v === 'string' && /^[0-9A-F]{32}$/.test(v)
const hash = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v)
const label = (v: unknown): v is string => typeof v === 'string' && !!v.trim() && v === v.trim() && !/[\p{Cc}]/u.test(v)
const exact = (v: unknown, a: string[]) => Array.isArray(v) && v.length === a.length && v.every((e, i) => e === a[i])
const identity = (v: Record<string, unknown>) => v.Version === 1 && v.World === 'fenix' && v.SourceId === DEBT_SOURCE && v.DefinitionSha256 === DEBT_DEFINITION
  && v.DatePolicy === 'OURBalanceBeforeExplicitWholeSecond' && v.MoneyPolicy === debtMoneyPolicy && v.EffectiveNativeDateAndSwitchVerified === false
  && v.ManagementCurrencyPresentationVerified === false && v.AppliesFxConversion === false && v.SourceParityVerified === false && v.OriginalFullTaskAccepted === false
export function isDebtCapability(v: unknown): v is DebtCapability {
  return object(v) && identity(v) && v.ModuleSha256 === moduleHash && v.QuerySha256 === queryHash && v.Executable === true && v.RequiresCompleteNormalInputs === true
    && exact(v.DefaultRows, ['Организация', 'Контрагент']) && exact(v.DefaultFilters, ['Организация', 'Контрагент'])
    && exact(v.DefaultMeasures, ['СуммаУпр']) && exact(v.OptionalMeasures, ['СуммаВзаиморасчетов'])
}
export function isDebtCatalogueEntry(report: ReportCatalogueEntry, worlds: readonly string[]) {
  return report.Id === 'builtin:ЗадолженностьПоКонтрагентам' && worlds.includes('fenix')
    && report.Sources.some(s => s.World === 'fenix' && s.SourceId === DEBT_SOURCE && s.DefinitionSha256 === DEBT_DEFINITION)
}
export function debtInstantError(value: string): string | null {
  if (!/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)) return 'Оберіть явний момент залишку з точністю до секунди.'
  const d = new Date(`${value}Z`)
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 19) === value ? null : 'Оберіть коректний момент залишку.'
}
export function debtRequest(capability: DebtCapability, asOf: string, debtSwitch = 0, includeSettlement = false, organizations: string[] = [], counterparties: string[] = []): DebtRequest {
  if (!isDebtCapability(capability) || debtInstantError(asOf) || ![0, 1, 2].includes(debtSwitch)
    || typeof includeSettlement !== 'boolean' || [organizations, counterparties].some(a => a.length > 256 || !a.every(ref) || new Set(a).size !== a.length)) throw new Error('Некоректний запит заборгованості за контрагентами.')
  return { Version: 1, World: 'fenix', SourceId: DEBT_SOURCE, DefinitionSha256: DEBT_DEFINITION, AsOf: asOf, DebtSwitch: debtSwitch,
    IncludeSettlement: includeSettlement, Organizations: [...organizations].sort(), Counterparties: [...counterparties].sort() }
}
export function debtCents(v: unknown): bigint {
  if (typeof v !== 'string' || v.length > 100 || !/^-?(0|[1-9]\d*)\.\d{2}$/.test(v) || v === '-0.00') throw new Error('Некоректна точна сума.')
  return BigInt(v.replace('.', ''))
}
function amounts(v: unknown): v is DebtAmounts {
  if (!object(v)) return false
  debtCents(v.Management); debtCents(v.Settlement); return true
}
const sameSum = (total: DebtAmounts, rows: DebtAmounts[]) => (['Management', 'Settlement'] as const).every(k =>
  debtCents(total[k]) === rows.reduce((s, r) => s + debtCents(r[k]), 0n))
const choices = (v: unknown): v is DebtChoice[] => Array.isArray(v) && v.every(c => object(c) && ref(c.Key) && label(c.Caption))
  && new Set(v.map(c => c.Key)).size === v.length
export function normalizeDebt(v: unknown, request: DebtRequest): DebtResult {
  const fail = () => { throw new Error('Сервер не підтвердив повний результат заборгованості за контрагентами.') }
  if (!object(v) || !identity(v) || v.AsOf !== request.AsOf || v.DebtSwitch !== request.DebtSwitch || v.IncludeSettlement !== request.IncludeSettlement
    || !exact(v.Organizations, request.Organizations) || !exact(v.Counterparties, request.Counterparties)
    || typeof v.Available !== 'boolean' || v.NormalInputsComplete !== v.Available || v.OurSnapshotVerified !== true
    || typeof v.Code !== 'string' || !v.Code.startsWith('original_counterparty_debt_') || !Array.isArray(v.Rows)
    || !choices(v.OrganizationChoices) || !choices(v.CounterpartyChoices) || !Array.isArray(v.FilterSummary) || !v.FilterSummary.every(label)
    || !Array.isArray(v.MissingCaptionMappings) || !v.MissingCaptionMappings.every(k => k === 'Organization' || k === 'Counterparty')
    || new Set(v.MissingCaptionMappings).size !== v.MissingCaptionMappings.length) return fail()
  if (!v.Available) {
    if (v.Rows.length || v.Totals !== null || v.InputWitnessSha256 !== null || v.ResultSha256 !== null || v.OrganizationChoices.length
      || v.CounterpartyChoices.length || !object(v.Dependency) || v.Dependency.OpeningRegister !== 0 || v.Dependency.MovementBranch !== 0
      || v.Dependency.RequestedEndpoint !== request.AsOf || (v.Dependency.MissingMonth !== null && (typeof v.Dependency.MissingMonth !== 'string'
        || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(v.Dependency.MissingMonth)))) return fail()
    return v as unknown as DebtResult
  }
  if (v.Code !== 'original_counterparty_debt_complete' || v.Dependency !== null || !hash(v.InputWitnessSha256) || !hash(v.ResultSha256) || !amounts(v.Totals)) return fail()
  const orgs = new Set<string>()
  for (const r of v.Rows) {
    if (!object(r) || !ref(r.Organization) || orgs.has(r.Organization) || !label(r.Caption) || typeof r.CaptionAvailable !== 'boolean'
      || !amounts(r.Amounts) || !Array.isArray(r.Counterparties) || !r.Counterparties.length) return fail()
    orgs.add(r.Organization); const parties = new Set<string>()
    for (const p of r.Counterparties) {
      if (!object(p) || !ref(p.Counterparty) || parties.has(p.Counterparty) || !label(p.Caption) || typeof p.CaptionAvailable !== 'boolean' || !amounts(p.Amounts)) return fail()
      parties.add(p.Counterparty)
    }
    if (!sameSum(r.Amounts, (r.Counterparties as DebtPartyRow[]).map(p => p.Amounts))) return fail()
  }
  if (!sameSum(v.Totals, (v.Rows as DebtOrgRow[]).map(r => r.Amounts))) return fail()
  return v as unknown as DebtResult
}
