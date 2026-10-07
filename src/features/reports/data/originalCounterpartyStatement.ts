import type { ReportCatalogueEntry } from '../types'
export const STATEMENT_SOURCE = '8fde42fc-6e49-4a8e-9096-74bbe14fe901'
export const STATEMENT_DEFINITION = '4c82c55dff31563af9562e61b8858644949010490fa77dc3be9ac9703a3a23ea'
export const statementMoneyPolicy = 'NativeStoredManagementAndSettlementResourcesNoFxConversion'
export const statementDatePolicy = 'InclusiveBusinessDaysThroughLastWholeSecond'
const rows = ['Организация', 'Контрагент', 'ДоговорКонтрагента']
const measures = ['СуммаВзаиморасчетов', 'СуммаУпр'].flatMap(resource => ['НачальныйОстаток', 'Приход', 'Расход', 'КонечныйОстаток'].map(measure => resource + measure))
export type StatementCapability = { Version: 1; World: 'fenix'; SourceId: string; DefinitionSha256: string; ModuleSha256: string; QuerySha256: string;
  Executable: boolean; DefaultRows: string[]; DefaultFilters: string[]; DefaultMeasures: string[]; RequiresCompleteNormalInputs: true;
  RequiresWorldBoundAgreementByDocuments: true; DatePolicy: string; MoneyPolicy: string; ManagementCurrencyPresentationVerified: false;
  AppliesFxConversion: false; SourceParityVerified: false; OriginalFullTaskAccepted: false }
export type StatementRequest = { Version: 1; World: 'fenix'; SourceId: string; DefinitionSha256: string; From: string; Through: string;
  Organizations: string[]; Counterparties: string[]; Agreements: string[] }
export type StatementFour = { Opening: string; Incoming: string; Outgoing: string; Closing: string }
export type StatementAmounts = { Settlement: StatementFour; Management: StatementFour }
export type StatementChoice = { Key: string; Caption: string }
export type StatementAgreementRow = { Agreement: string; Caption: string; CaptionAvailable: boolean; Amounts: StatementAmounts }
export type StatementPartyRow = { Counterparty: string; Caption: string; CaptionAvailable: boolean; Amounts: StatementAmounts; Agreements: StatementAgreementRow[] }
export type StatementOrganizationRow = { Organization: string; Caption: string; CaptionAvailable: boolean; Amounts: StatementAmounts; Counterparties: StatementPartyRow[] }
export type StatementDependency = { OpeningRegister: number | null; MovementRegister: number | null; MovementBranch: number | null;
  MissingMonth: string | null; AgreementKeys: string[]; MissingAgreementKeyCount: number; HasMoreAgreementKeys: boolean }
export type StatementResult = StatementRequest & { Available: boolean; Code: string; NormalInputsComplete: boolean; OurSnapshotVerified: true;
  InputWitnessSha256: string | null; ResultSha256: string | null; Rows: StatementOrganizationRow[]; Totals: StatementAmounts | null;
  OrganizationChoices: StatementChoice[]; CounterpartyChoices: StatementChoice[]; AgreementChoices: StatementChoice[];
  MissingCaptionMappings: string[]; FilterSummary: string[]; Dependency: StatementDependency | null; MoneyPolicy: string; DatePolicy: string;
  ManagementCurrencyPresentationVerified: false; AppliesFxConversion: false; SourceParityVerified: false; OriginalFullTaskAccepted: false }
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const ref = (v: unknown): v is string => typeof v === 'string' && /^[0-9A-F]{32}$/.test(v)
const hash = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v)
const label = (v: unknown): v is string => typeof v === 'string' && !!v && v === v.trim() && !/[\p{Cc}]/u.test(v)
const exact = (v: unknown, expected: string[]) => Array.isArray(v) && v.length === expected.length && v.every((x, i) => x === expected[i])
const identity = (v: Record<string, unknown>) => v.Version === 1 && v.World === 'fenix' && v.SourceId === STATEMENT_SOURCE && v.DefinitionSha256 === STATEMENT_DEFINITION
  && v.MoneyPolicy === statementMoneyPolicy && v.DatePolicy === statementDatePolicy && v.ManagementCurrencyPresentationVerified === false
  && v.AppliesFxConversion === false && v.SourceParityVerified === false && v.OriginalFullTaskAccepted === false
export function isStatementCapability(v: unknown): v is StatementCapability {
  return object(v) && identity(v) && v.ModuleSha256 === '0ca2edd180c0c9a3d398c3f7969a2ba21fa44834e645db63791316fea3c50030'
    && v.QuerySha256 === 'f09d7675ddb6dccc0247d03dba151cfd46f0542917af8fcd50c43ab082072cc1' && typeof v.Executable === 'boolean'
    && exact(v.DefaultRows, rows) && exact(v.DefaultFilters, rows) && exact(v.DefaultMeasures, measures)
    && v.RequiresCompleteNormalInputs === true && v.RequiresWorldBoundAgreementByDocuments === true
}
function day(value: string) {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(value)) return null
  const d = new Date(value + 'T00:00:00Z')
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value ? d : null
}
export function statementPeriodError(from: string, through: string): string | null {
  const a = day(from), b = day(through)
  if (!a || !b || b < a) return 'Оберіть коректні початок і кінець періоду.'
  const last = new Date(Date.UTC(a.getUTCFullYear() + 1, a.getUTCMonth() + 1, 0)).getUTCDate()
  const end = new Date(Date.UTC(a.getUTCFullYear() + 1, a.getUTCMonth(), Math.min(a.getUTCDate(), last)))
  return b >= end ? 'Період має бути коротшим за дванадцять місяців.' : null
}
export function statementRequest(capability: StatementCapability, from: string, through: string,
  organizations: string[] = [], counterparties: string[] = [], agreements: string[] = []): StatementRequest {
  if (!isStatementCapability(capability) || statementPeriodError(from, through) || [organizations, counterparties, agreements].some(a =>
    a.length > 256 || !a.every(ref) || new Set(a).size !== a.length)) throw new Error('Некоректний запит відомості взаєморозрахунків.')
  return { Version: 1, World: 'fenix', SourceId: STATEMENT_SOURCE, DefinitionSha256: STATEMENT_DEFINITION, From: from, Through: through,
    Organizations: [...organizations].sort(), Counterparties: [...counterparties].sort(), Agreements: [...agreements].sort() }
}
export function statementCents(v: unknown): bigint {
  if (typeof v !== 'string' || v.length > 100 || !/^-?(0|[1-9]\d*)\.\d{2}$/.test(v) || v === '-0.00') throw new Error('Некоректна точна сума.')
  return BigInt(v.replace('.', ''))
}
export const statementResources = ['Settlement', 'Management'] as const
export const statementMeasures = ['Opening', 'Incoming', 'Outgoing', 'Closing'] as const
function amounts(v: unknown): v is StatementAmounts {
  if (!object(v)) return false
  for (const resource of statementResources) {
    const four = v[resource]
    if (!object(four)) return false
    for (const key of statementMeasures) statementCents(four[key])
    if (statementCents(four.Closing) !== statementCents(four.Opening) + statementCents(four.Incoming) - statementCents(four.Outgoing)) return false
  }
  return true
}
const conserved = (total: StatementAmounts, children: StatementAmounts[]) => statementResources.every(r => statementMeasures.every(m =>
  statementCents(total[r][m]) === children.reduce((sum, child) => sum + statementCents(child[r][m]), 0n)))
const choices = (v: unknown): v is StatementChoice[] => Array.isArray(v) && v.every(c => object(c) && ref(c.Key) && label(c.Caption))
  && new Set(v.map(c => c.Key)).size === v.length
const allowed = (key: string, selected: string[]) => !selected.length || selected.includes(key)
export function normalizeStatement(v: unknown, request: StatementRequest): StatementResult {
  const fail = () => { throw new Error('Сервер не підтвердив повну відомість взаєморозрахунків для обраного періоду та відборів.') }
  if (!object(v) || !identity(v) || v.From !== request.From || v.Through !== request.Through || !exact(v.Organizations, request.Organizations)
    || !exact(v.Counterparties, request.Counterparties) || !exact(v.Agreements, request.Agreements) || typeof v.Available !== 'boolean'
    || v.NormalInputsComplete !== v.Available || v.OurSnapshotVerified !== true || typeof v.Code !== 'string' || !v.Code.startsWith('original_counterparty_statement_')
    || !Array.isArray(v.Rows) || !choices(v.OrganizationChoices) || !choices(v.CounterpartyChoices) || !choices(v.AgreementChoices)
    || !Array.isArray(v.FilterSummary) || !v.FilterSummary.every(label) || !Array.isArray(v.MissingCaptionMappings)
    || !v.MissingCaptionMappings.every(k => ['Organization', 'Counterparty', 'Agreement'].includes(k)) || new Set(v.MissingCaptionMappings).size !== v.MissingCaptionMappings.length) return fail()
  if (!v.Available) {
    const d = v.Dependency
    if (v.Rows.length || v.Totals !== null || v.InputWitnessSha256 !== null || v.ResultSha256 !== null || v.OrganizationChoices.length || v.CounterpartyChoices.length
      || v.AgreementChoices.length || !object(d) || ![null, 0, 1].includes(d.OpeningRegister as number | null) || ![null, 2].includes(d.MovementRegister as number | null)
      || ![null, 0].includes(d.MovementBranch as number | null) || d.MovementRegister !== (d.OpeningRegister === 1 ? 2 : null)
      || d.MovementBranch !== (d.OpeningRegister === 0 ? 0 : null) || d.MissingMonth !== null && (typeof d.MissingMonth !== 'string' || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(d.MissingMonth))
      || !Array.isArray(d.AgreementKeys) || d.AgreementKeys.length > 64 || !d.AgreementKeys.every(ref) || new Set(d.AgreementKeys).size !== d.AgreementKeys.length
      || !Number.isSafeInteger(d.MissingAgreementKeyCount) || (d.MissingAgreementKeyCount as number) < d.AgreementKeys.length
      || d.HasMoreAgreementKeys !== ((d.MissingAgreementKeyCount as number) > d.AgreementKeys.length)) return fail()
    return v as unknown as StatementResult
  }
  if (v.Code !== 'original_counterparty_statement_complete' || v.Dependency !== null || !hash(v.InputWitnessSha256) || !hash(v.ResultSha256) || !amounts(v.Totals)) return fail()
  const orgs = new Set<string>()
  for (const org of v.Rows) {
    if (!object(org) || !ref(org.Organization) || orgs.has(org.Organization) || !allowed(org.Organization, request.Organizations) || !label(org.Caption)
      || typeof org.CaptionAvailable !== 'boolean' || !amounts(org.Amounts) || !Array.isArray(org.Counterparties) || !org.Counterparties.length) return fail()
    orgs.add(org.Organization); const parties = new Set<string>()
    for (const party of org.Counterparties) {
      if (!object(party) || !ref(party.Counterparty) || parties.has(party.Counterparty) || !allowed(party.Counterparty, request.Counterparties) || !label(party.Caption)
        || typeof party.CaptionAvailable !== 'boolean' || !amounts(party.Amounts) || !Array.isArray(party.Agreements) || !party.Agreements.length) return fail()
      parties.add(party.Counterparty); const agreements = new Set<string>()
      for (const agreement of party.Agreements) {
        if (!object(agreement) || !ref(agreement.Agreement) || agreements.has(agreement.Agreement) || !allowed(agreement.Agreement, request.Agreements)
          || !label(agreement.Caption) || typeof agreement.CaptionAvailable !== 'boolean' || !amounts(agreement.Amounts)) return fail()
        agreements.add(agreement.Agreement)
      }
      if (!conserved(party.Amounts, (party.Agreements as StatementAgreementRow[]).map(a => a.Amounts))) return fail()
    }
    if (!conserved(org.Amounts, (org.Counterparties as StatementPartyRow[]).map(p => p.Amounts))) return fail()
  }
  if (!conserved(v.Totals, (v.Rows as StatementOrganizationRow[]).map(o => o.Amounts))) return fail()
  return v as unknown as StatementResult
}

export function isStatementCatalogueEntry(report: ReportCatalogueEntry, worlds: readonly string[]) {
  return report.Id === 'builtin:ВедомостьВзаиморасчетыСКонтрагентами' && worlds.includes('fenix')
    && report.Sources.some(s => s.World === 'fenix' && s.SourceId === STATEMENT_SOURCE && s.DefinitionSha256 === STATEMENT_DEFINITION)
}
