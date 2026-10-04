import type { ReportCatalogueEntry } from '../types'

export const plannedFields = ['PlanningDocument', 'Counterparty', 'CashFlowArticle', 'Project', 'FormOfPayment', 'CashCurrency', 'BankAccountCash', 'Responsible', 'Department'] as const
export type PlannedField = typeof plannedFields[number]
export type PlannedVariant = 'receipts' | 'payout-requests'
export const plannedFieldLabels: Record<PlannedField, string> = { PlanningDocument: 'Документ планування', Counterparty: 'Контрагент', CashFlowArticle: 'Стаття руху коштів', Project: 'Проєкт',
  FormOfPayment: 'Форма оплати', CashCurrency: 'Валюта коштів', BankAccountCash: 'Банківський рахунок / каса', Responsible: 'Відповідальний', Department: 'Підрозділ' }
export const plannedDefaultRows: PlannedField[] = ['FormOfPayment', 'CashCurrency', 'BankAccountCash', 'PlanningDocument']
export const plannedFilterFields: PlannedField[] = ['FormOfPayment', 'CashCurrency', 'BankAccountCash', 'Responsible', 'Counterparty', 'CashFlowArticle', 'Department', 'Project']
export const plannedDefinitions = {
  receipts: { source: 'd6123498-7f66-49a5-a873-09d51e7bbdbb', name: 'ПланируемыеПоступленияДенежныхСредств', definition: '09e24ff1e33cafc542a533edd943747d7bb6707cbeeaf433a776f602eb3b3b5d', module: '154042e4690b83aab178b45134139d0b6633c2c38bc7c253feb19559178dd8bf', register: '6c3ac8b6-ab93-460a-8cbc-4eed844da245', config: 'c759e9faa38052a431d017ff1c0c12c6adf522021ecc5872e47648a03f650417', title: 'Плановані надходження коштів' },
  'payout-requests': { source: '52f41b8c-2893-4472-87cf-9ae5eab56e9b', name: 'ЗаявкиНаРасходованиеСредств', definition: '830ebd1c843e189d6c484057eb318cde0dd64bad15f85f8ef5528305eca1a379', module: 'a45ffca5fa5f9a5cc04fbee00023363e3e4837fd56a21ca06d09ff1c9e356386', register: 'aaa6e963-608c-4bce-a66d-0c114e63fbc3', config: '7c2e8025ae82ff0c9003d73467a9a9f26469e3d2c2744436947edf0b74c895fc', title: 'Заявки на витрачання коштів' },
} as const
export const plannedMeasures = ['СуммаВзаиморасчетов', 'СуммаУпр', 'Сумма'].flatMap(resource => ['НачальныйОстаток', 'Приход', 'Расход', 'КонечныйОстаток'].map(stage => resource + stage))
export type PlannedFilter = { Field: PlannedField; Reference: string; Type: string | null; Table: string | null }
export type PlannedCapability = { Version: 1; World: 'fenix' | 'amg'; Variant: PlannedVariant; SourceId: string; DefinitionSha256: string; ModuleSha256: string;
  RegisterSourceId: string; RegisterConfigSha256: string; CommonBuilderModuleSha256: string; Executable: boolean; PeriodRequired: true; MaximumInclusiveDays: 366;
  RequiresCompleteNormalInputs: true; DefaultRows: PlannedField[]; SelectableRows: PlannedField[]; FilterFields: PlannedField[]; DefaultMeasures: string[];
  PeriodPolicy: 'InclusiveCalendarWholeSeconds'; MoneyUnitPolicy: 'NativeStoredResourcesNoCurrencyIdentityAssumption'; AppliesFxConversion: false;
  NativeVirtualTableVerified: false; SourceParityVerified: false; OriginalFullTaskAccepted: false }
export type PlannedRequest = { Version: 1; World: 'fenix' | 'amg'; Variant: PlannedVariant; SourceId: string; DefinitionSha256: string; From: string; Through: string; Rows: PlannedField[]; Filters: PlannedFilter[] }
export type PlannedMeasure = { Opening: string; Incoming: string; Outgoing: string; Closing: string }
export type PlannedAmounts = { Settlement: PlannedMeasure; Management: PlannedMeasure; Cash: PlannedMeasure }
export type PlannedChoice = PlannedFilter & { Caption: string }
export type OriginalPlannedResult = { Version: 1; World: 'fenix' | 'amg'; Variant: PlannedVariant; SourceId: string; DefinitionSha256: string; From: string; Through: string;
  Grouping: PlannedField[]; Filters: PlannedFilter[]; Available: boolean; Code: string; NormalInputsComplete: boolean; OurSnapshotVerified: boolean;
  InputWitnessSha256: string | null; ResultSha256: string | null; Rows: Array<PlannedAmounts & { Key: Array<PlannedFilter & { Caption: string | null }> }>;
  Totals: PlannedAmounts | null; Choices: PlannedChoice[]; MissingCaptionMappings: PlannedField[]; OriginalDefaultDocumentFieldsAvailable: boolean; OperationalHeaderWitnessSha256: string | null;
  MoneyUnitPolicy: 'NativeStoredResourcesNoCurrencyIdentityAssumption'; AppliesFxConversion: false; NativeVirtualTableVerified: false; SourceParityVerified: false; OriginalFullTaskAccepted: false }
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const hash = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)
const ref = (v: unknown, width: number) => typeof v === 'string' && new RegExp(`^[A-F0-9]{${width}}$`).test(v)
const fieldNames = new Set<string>(plannedFields)
const filterNames = new Set<string>(plannedFilterFields)
const intrinsicNames = new Set<string>(['PlanningDocument', 'Counterparty', 'CashFlowArticle', 'Project'])
const field = (v: unknown): v is PlannedField => typeof v === 'string' && fieldNames.has(v)
const variant = (v: unknown): v is PlannedVariant => v === 'receipts' || v === 'payout-requests'
const equal = (left: readonly unknown[], right: readonly unknown[]) => left.length === right.length && left.every((value, i) => value === right[i])
const policy = (v: Record<string, unknown>) => v.MoneyUnitPolicy === 'NativeStoredResourcesNoCurrencyIdentityAssumption' && v.AppliesFxConversion === false
  && v.NativeVirtualTableVerified === false && v.SourceParityVerified === false && v.OriginalFullTaskAccepted === false
const identity = (v: Record<string, unknown>) => v.Version === 1 && (v.World === 'fenix' || v.World === 'amg') && variant(v.Variant)
  && v.SourceId === plannedDefinitions[v.Variant].source && v.DefinitionSha256 === plannedDefinitions[v.Variant].definition && policy(v)
export function isPlannedCapability(v: unknown): v is PlannedCapability {
  if (!object(v) || !identity(v) || !variant(v.Variant)) return false
  const definition = plannedDefinitions[v.Variant]
  return v.ModuleSha256 === definition.module && v.RegisterSourceId === definition.register && v.RegisterConfigSha256 === definition.config
    && v.CommonBuilderModuleSha256 === 'c34895f1904a5af9fb80223ba12ef5dd8c9fc422ff5ed6caee7d73529a531a17' && v.Executable === (v.World === 'fenix')
    && v.PeriodRequired === true && v.MaximumInclusiveDays === 366 && v.RequiresCompleteNormalInputs === true && v.PeriodPolicy === 'InclusiveCalendarWholeSeconds'
    && Array.isArray(v.DefaultRows) && equal(v.DefaultRows, plannedDefaultRows) && Array.isArray(v.SelectableRows) && equal(v.SelectableRows, plannedFields)
    && Array.isArray(v.FilterFields) && equal(v.FilterFields, plannedFilterFields) && Array.isArray(v.DefaultMeasures) && equal(v.DefaultMeasures, plannedMeasures)
}
export function plannedCatalogueVariant(report: ReportCatalogueEntry, worlds: readonly string[]): PlannedVariant | null {
  if (!worlds.includes('fenix')) return null
  return (Object.keys(plannedDefinitions) as PlannedVariant[]).find(key => report.Id === `builtin:${plannedDefinitions[key].name}`
    && report.Sources.some(source => source.World === 'fenix' && source.SourceId === plannedDefinitions[key].source && source.DefinitionSha256 === plannedDefinitions[key].definition)) ?? null
}
export function plannedPeriodError(from: string, through: string): string | null {
  const date = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-02' || value >= '3999-01-01') return null
    const ms = Date.parse(`${value}T00:00:00Z`)
    return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value ? ms : null
  }
  const first = date(from), last = date(through)
  return first === null || last === null || first > last || (last - first) / 86_400_000 >= 366 ? 'Оберіть явний період до 366 календарних днів.' : null
}
export const plannedFilterKey = (v: PlannedFilter) => JSON.stringify([v.Field, v.Type, v.Table, v.Reference])
function validFilter(v: unknown): v is PlannedFilter {
  if (!object(v) || !field(v.Field) || !ref(v.Reference, 32)) return false
  return v.Field === 'Project' || v.Field === 'BankAccountCash' ? ref(v.Type, 2) && ref(v.Table, 8) : v.Type === null && v.Table === null
}
export function plannedRequest(capability: PlannedCapability, from: string, through: string, rows: readonly PlannedField[] = plannedDefaultRows, filters: readonly PlannedFilter[] = []): PlannedRequest {
  if (!isPlannedCapability(capability) || !capability.Executable || plannedPeriodError(from, through) || rows.length > 9 || rows.some(v => !field(v))
    || new Set(rows).size !== rows.length || filters.length > 256 || filters.some(v => !validFilter(v) || !filterNames.has(v.Field))
    || new Set(filters.map(plannedFilterKey)).size !== filters.length) throw new Error('Некоректний запит планового звіту.')
  return { Version: 1, World: capability.World, Variant: capability.Variant, SourceId: capability.SourceId, DefinitionSha256: capability.DefinitionSha256,
    From: from, Through: through, Rows: [...rows], Filters: structuredClone([...filters]) }
}
export function plannedScaled(v: unknown): bigint {
  if (typeof v !== 'string' || v.length > 100 || !/^-?(0|[1-9]\d*)\.\d{2}$/.test(v) || v === '-0.00') throw new Error('Некоректна сума планового звіту.')
  return BigInt(v.replace('.', ''))
}
const stages = ['Opening', 'Incoming', 'Outgoing', 'Closing'] as const
const resources = ['Settlement', 'Management', 'Cash'] as const
const amounts = (v: unknown): v is PlannedAmounts => object(v) && resources.every(resource => {
  const measure = v[resource]
  return object(measure) && plannedScaled(measure.Closing) === plannedScaled(measure.Opening) + plannedScaled(measure.Incoming) - plannedScaled(measure.Outgoing)
})
function choicesValid(choices: unknown[], keys: Set<string>): boolean {
  for (const choice of choices) {
    if (!validFilter(choice) || !object(choice) || (choice.Field !== 'Counterparty' && choice.Field !== 'CashFlowArticle')
      || choice.Reference === '0'.repeat(32) || typeof choice.Caption !== 'string' || !choice.Caption.trim() || keys.has(plannedFilterKey(choice))) return false
    keys.add(plannedFilterKey(choice))
  }
  return true
}
/** Refuse foreign identity, partial parents, duplicate full keys or inconsistent totals before screen and export. */
export function normalizePlannedResult(v: unknown, request: PlannedRequest): OriginalPlannedResult {
  const invalid = () => { throw new Error('Сервер не підтвердив повний плановий звіт.') }
  if (!object(v) || !identity(v) || v.World !== request.World || v.Variant !== request.Variant || v.SourceId !== request.SourceId || v.DefinitionSha256 !== request.DefinitionSha256
    || v.From !== request.From || v.Through !== request.Through || !Array.isArray(v.Grouping) || !equal(v.Grouping, request.Rows)
    || !Array.isArray(v.Filters) || v.Filters.length !== request.Filters.length || v.Filters.some((filter, i) => !validFilter(filter) || plannedFilterKey(filter) !== plannedFilterKey(request.Filters[i]))
    || typeof v.Available !== 'boolean' || typeof v.NormalInputsComplete !== 'boolean' || typeof v.OurSnapshotVerified !== 'boolean'
    || typeof v.OriginalDefaultDocumentFieldsAvailable !== 'boolean' || typeof v.Code !== 'string' || !v.Code.startsWith('original_planned_cash_')
    || !Array.isArray(v.Rows) || !Array.isArray(v.Choices) || !Array.isArray(v.MissingCaptionMappings) || v.MissingCaptionMappings.some(name => !field(name))) return invalid()
  if (!v.Available) {
    if (v.Rows.length || v.Choices.length || v.Totals !== null || v.InputWitnessSha256 !== null || v.ResultSha256 !== null || v.OperationalHeaderWitnessSha256 !== null) return invalid()
    return structuredClone(v) as OriginalPlannedResult
  }
  if (request.World !== 'fenix' || !v.NormalInputsComplete || !v.OurSnapshotVerified || !hash(v.InputWitnessSha256) || !hash(v.ResultSha256)
    || equal(request.Rows, plannedDefaultRows) && !v.OriginalDefaultDocumentFieldsAvailable
    || v.Code !== 'original_planned_cash_OUR_complete' || v.Rows.length > 200_000 || v.Choices.length > 400_000 || !choicesValid(v.Choices, new Set())) return invalid()
  if (request.Rows.some(name => !intrinsicNames.has(name))
    || request.Filters.some(filter => !intrinsicNames.has(filter.Field))) {
    if (!hash(v.OperationalHeaderWitnessSha256)) return invalid()
  }
  const captionNames = new Map((v.Choices as PlannedChoice[]).map(choice => [plannedFilterKey(choice), choice.Caption]))
  const keys = new Set<string>(), parts: PlannedAmounts[] = []
  for (const row of v.Rows) {
    if (!object(row) || !Array.isArray(row.Key) || row.Key.length !== request.Rows.length || !amounts(row)) return invalid()
    const tuple: string[] = []
    for (let i = 0; i < row.Key.length; i++) {
      const value = row.Key[i]
      if (!validFilter(value) || !object(value) || value.Field !== request.Rows[i] || value.Caption !== null && (typeof value.Caption !== 'string' || !value.Caption.trim())) return invalid()
      if (value.Caption !== null && captionNames.get(plannedFilterKey(value)) !== value.Caption) return invalid()
      tuple.push(plannedFilterKey(value))
    }
    const key = JSON.stringify(tuple)
    if (keys.has(key)) return invalid()
    keys.add(key); parts.push(row)
  }
  if (parts.length === 0 ? v.Totals !== null : !amounts(v.Totals) || resources.some(resource => stages.some(stage =>
    plannedScaled((v.Totals as PlannedAmounts)[resource][stage]) !== parts.reduce((sum, row) => sum + plannedScaled(row[resource][stage]), 0n)))) return invalid()
  return structuredClone(v) as OriginalPlannedResult
}
