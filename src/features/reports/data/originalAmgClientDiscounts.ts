import type { ReportCatalogueEntry } from '../types'

export const AMG_DISCOUNTS_SOURCE = '56e2ad4b-9f75-4461-a742-eb54ae01823f'
export const AMG_DISCOUNTS_DEFINITION = 'e355fd45fed1b64f52704baa92f09755b91bea96be74953c182f65b1c8fcc637'
export const amgDiscountFields = ['Номенклатура', 'ПолучательСкидки', 'КодПоРегиону'] as const
export type AmgDiscountField = typeof amgDiscountFields[number]
export const amgDiscountLabels: Record<AmgDiscountField, string> = { Номенклатура: 'Номенклатура', ПолучательСкидки: 'Отримувач знижки', КодПоРегиону: 'Прямий код регіону' }
export type AmgRecipient = { Type: string; Table: string; Reference: string }
export type AmgDiscountRequest = { Version: 1; World: 'amg'; SourceId: string; DefinitionSha256: string; Through: string; Products: string[]; Recipients: AmgRecipient[]; RegionCodes: string[]; ChoicesWitnessSha256: string | null }
export type AmgDiscountReadiness = {
  Version: 1; World: 'amg'; SourceId: string; DefinitionSha256: string; ModuleSha256: string; QuerySha256: string;
  DefaultRows: string[]; DefaultColumns: string[]; DefaultMeasures: string[]; Filters: string[]; Aggregation: string; DecimalPlaces: 2;
  SupportedRecipientTable: '0000005A'; SupportedPercentageType: '03'; Executable: boolean; OrdinaryPublicationAvailable: boolean;
  OurSnapshotVerified: boolean; Dependency: string | null; InputWitnessSha256: string | null; NativeRecipientUniverseVerified: false;
  OriginalFullTaskAccepted: false; SourceSyncEnabled: false; HumanChoicesAvailable: false; CurrentSourceVerified: false; SourceParityVerified: false; NativeDateParametersVerified: false;
}
export type AmgDiscountCell = { Recipient: AmgRecipient; RecipientName: string; RegionCode: string | null; Product: string; ProductName: string; Percentage: string; FactRows: number }
export type AmgDiscountResult = Pick<AmgDiscountRequest, 'Version' | 'World' | 'SourceId' | 'DefinitionSha256' | 'Through' | 'Products' | 'Recipients' | 'RegionCodes' | 'ChoicesWitnessSha256'> & {
  InputAvailable: boolean; OrdinaryPublicationAvailable: boolean; OurSnapshotVerified: boolean; Dependency: string | null;
  Cells: AmgDiscountCell[]; MaximumPercentage: string | null; InputWitnessSha256: string | null; ResultSha256: string;
  PeriodPolicy: 'DeclaredLastWholeSecond'; SourceParityVerified: false; NativeDateParametersVerified: false; NativeStringComparisonVerified: false; AppliesFxConversion: false;
}
export type AmgDiscountChoice = { Field: AmgDiscountField; Type: string; TableReference: string | null; Key: string; Caption: string; Deleted: boolean }
export type AmgDiscountChoices = Pick<AmgDiscountRequest, 'Version' | 'World' | 'SourceId' | 'DefinitionSha256' | 'Through'> & {
  RequestedProducts: string[]; RequestedRecipients: AmgRecipient[]; RequestedRegionCodes: string[];
  OrdinaryPublicationAvailable: boolean; OurSnapshotVerified: boolean; Dependency: string | null;
  FieldAvailability: Record<AmgDiscountField, boolean>; Choices: Record<AmgDiscountField, AmgDiscountChoice[]>; MissingFamilies: AmgDiscountField[];
  InputWitnessSha256: string | null; ChoicesWitnessSha256: string | null; ResultSha256: string; HumanChoicesAvailable: boolean;
  NativeRecipientUniverseVerified: false; CurrentSourceVerified: false; SourceParityVerified: false;
}
export type AmgDiscountSelection = Record<AmgDiscountField, string[]>
export const emptyAmgSelection = (): AmgDiscountSelection => ({ Номенклатура: [], ПолучательСкидки: [], КодПоРегиону: [] })
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)
const ref = (v: unknown): v is string => typeof v === 'string' && /^[A-F0-9]{32}$/.test(v)
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const human = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= 1024 && !/[\p{Cc}]/u.test(v) && !ref(v)
const identity = (v: Record<string, unknown>) => v.Version === 1 && v.World === 'amg' && v.SourceId === AMG_DISCOUNTS_SOURCE && v.DefinitionSha256 === AMG_DISCOUNTS_DEFINITION
const dependency = (v: unknown) => v === null || typeof v === 'string' && /^[a-z][a-z0-9_]{0,200}$/.test(v)
export const amgRecipientKey = (v: AmgRecipient) => `${v.Type}:${v.Table}:${v.Reference}`
function recipient(v: unknown): v is AmgRecipient { return object(v) && typeof v.Type === 'string' && /^[A-F0-9]{2}$/.test(v.Type) && typeof v.Table === 'string' && /^[A-F0-9]{8}$/.test(v.Table) && ref(v.Reference) }
export function amgDateError(through: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(through) || through < '1753-01-01' || through > '7999-12-31') return 'Виберіть коректну дату зрізу.'
  const date = new Date(`${through}T00:00:00Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== through ? 'Виберіть коректну дату зрізу.' : null
}
export function amgDiscountRequest(through: string): AmgDiscountRequest {
  return { Version: 1, World: 'amg', SourceId: AMG_DISCOUNTS_SOURCE, DefinitionSha256: AMG_DISCOUNTS_DEFINITION, Through: through, Products: [], Recipients: [], RegionCodes: [], ChoicesWitnessSha256: null }
}
export function validateAmgDiscountRequest(input: AmgDiscountRequest): AmgDiscountRequest {
  if (!identity(input) || amgDateError(input.Through) || !Array.isArray(input.Products) || !Array.isArray(input.Recipients) || !Array.isArray(input.RegionCodes)
    || [input.Products, input.Recipients, input.RegionCodes].some(v => v.length > 256)
    || !input.Products.every(ref) || !input.Recipients.every(recipient) || !input.RegionCodes.every(v => typeof v === 'string' && v.length <= 25)
    || new Set(input.Products).size !== input.Products.length || new Set(input.Recipients.map(amgRecipientKey)).size !== input.Recipients.length
    || new Set(input.RegionCodes).size !== input.RegionCodes.length || !(input.ChoicesWitnessSha256 === null || digest(input.ChoicesWitnessSha256))) throw new Error('Некоректні параметри оригінального звіту AMG.')
  return { Version: 1, World: 'amg', SourceId: AMG_DISCOUNTS_SOURCE, DefinitionSha256: AMG_DISCOUNTS_DEFINITION, Through: input.Through,
    Products: [...input.Products].sort(), Recipients: input.Recipients.map(v => ({ Type: v.Type, Table: v.Table, Reference: v.Reference })).sort((a, b) => amgRecipientKey(a) < amgRecipientKey(b) ? -1 : amgRecipientKey(a) > amgRecipientKey(b) ? 1 : 0), RegionCodes: [...input.RegionCodes].sort(), ChoicesWitnessSha256: input.ChoicesWitnessSha256 }
}
export function normalizeAmgReadiness(v: unknown): AmgDiscountReadiness {
  if (!object(v) || !identity(v) || v.ModuleSha256 !== '7bd692b383d5a2dc52645e4d1316bb292abb5904944bb686b3075db6e5795967'
    || v.QuerySha256 !== '6176122623be4ad0696ff2b614943d645c9290b094f9babe7f0f48854e13e2b8'
    || !same(v.DefaultRows, ['ПолучательСкидки']) || !same(v.DefaultColumns, ['Номенклатура']) || !same(v.DefaultMeasures, ['ПроцентСкидкиНаценки'])
    || !same(v.Filters, amgDiscountFields) || v.Aggregation !== 'MaximumAtRecipientProductGrain' || v.DecimalPlaces !== 2 || v.SupportedRecipientTable !== '0000005A' || v.SupportedPercentageType !== '03'
    || typeof v.OrdinaryPublicationAvailable !== 'boolean' || typeof v.OurSnapshotVerified !== 'boolean' || v.Executable !== (v.OrdinaryPublicationAvailable && v.OurSnapshotVerified)
    || !dependency(v.Dependency) || !(v.InputWitnessSha256 === null || digest(v.InputWitnessSha256)) || v.OrdinaryPublicationAvailable && (!digest(v.InputWitnessSha256) || v.Dependency !== null)
    || ['NativeRecipientUniverseVerified', 'OriginalFullTaskAccepted', 'SourceSyncEnabled', 'HumanChoicesAvailable', 'CurrentSourceVerified', 'SourceParityVerified', 'NativeDateParametersVerified'].some(k => v[k] !== false)) throw new Error('Сервер не підтвердив готовність оригінального звіту AMG.')
  return structuredClone(v) as AmgDiscountReadiness
}
/** The stored numeric(5,2) percentage is exact text. Percentages are never summed. */
export function amgPercentage(v: unknown): bigint {
  if (typeof v !== 'string' || !/^-?(0|[1-9]\d{0,2})\.\d{2}$/.test(v) || v === '-0.00') throw new Error('Некоректний точний відсоток AMG.')
  return BigInt(v.replace('.', ''))
}
function echo(v: Record<string, unknown>, scope: AmgDiscountRequest, choices = false) {
  return identity(v) && v.Through === scope.Through && same(v[choices ? 'RequestedProducts' : 'Products'], scope.Products)
    && same(v[choices ? 'RequestedRecipients' : 'Recipients'], scope.Recipients) && same(v[choices ? 'RequestedRegionCodes' : 'RegionCodes'], scope.RegionCodes)
}
export function normalizeAmgDiscounts(v: unknown, request: AmgDiscountRequest): AmgDiscountResult {
  const scope = validateAmgDiscountRequest(request), fail = () => { throw new Error('Сервер не підтвердив результат для поточних параметрів AMG.') }
  if (!object(v) || !echo(v, scope) || v.ChoicesWitnessSha256 !== scope.ChoicesWitnessSha256 || !digest(v.ResultSha256)
    || typeof v.InputAvailable !== 'boolean' || typeof v.OrdinaryPublicationAvailable !== 'boolean' || typeof v.OurSnapshotVerified !== 'boolean'
    || !dependency(v.Dependency) || !Array.isArray(v.Cells) || v.Cells.length > 500_000 || v.PeriodPolicy !== 'DeclaredLastWholeSecond'
    || ['SourceParityVerified', 'NativeDateParametersVerified', 'NativeStringComparisonVerified', 'AppliesFxConversion'].some(k => v[k] !== false)) return fail()
  if (!v.InputAvailable) {
    if (v.Cells.length || v.MaximumPercentage !== null || v.InputWitnessSha256 !== null || v.Dependency === null) return fail()
    return structuredClone(v) as AmgDiscountResult
  }
  if (!v.OrdinaryPublicationAvailable || !v.OurSnapshotVerified || v.Dependency !== null || !digest(v.InputWitnessSha256)) return fail()
  const products = new Set(scope.Products), recipients = new Set(scope.Recipients.map(amgRecipientKey)), regions = new Set(scope.RegionCodes)
  const keys = new Set<string>(); let maximum: bigint | null = null
  for (const cell of v.Cells) {
    if (!object(cell) || !recipient(cell.Recipient) || cell.Recipient.Type !== '08' || cell.Recipient.Table !== '0000005A'
      || !human(cell.RecipientName) || !ref(cell.Product) || !human(cell.ProductName) || !(cell.RegionCode === null || typeof cell.RegionCode === 'string' && cell.RegionCode.length <= 25)
      || typeof cell.FactRows !== 'number' || !Number.isSafeInteger(cell.FactRows) || cell.FactRows < 1 || products.size && !products.has(cell.Product)
      || recipients.size && !recipients.has(amgRecipientKey(cell.Recipient))
      || regions.size && !regions.has(cell.RegionCode as string)) return fail()
    const key = `${amgRecipientKey(cell.Recipient)}:${cell.Product}`
    if (keys.has(key)) return fail(); keys.add(key)
    const percentage = amgPercentage(cell.Percentage); maximum = maximum === null || percentage > maximum ? percentage : maximum
  }
  if (maximum === null ? v.MaximumPercentage !== null : amgPercentage(v.MaximumPercentage) !== maximum) return fail()
  return structuredClone(v) as AmgDiscountResult
}
function choice(v: unknown, field: AmgDiscountField): v is AmgDiscountChoice {
  if (!object(v) || v.Field !== field || !human(v.Caption) || typeof v.Deleted !== 'boolean' || typeof v.Key !== 'string') return false
  if (field === 'КодПоРегиону') return v.Type === 'string' && v.TableReference === null && v.Key.length > 0 && v.Key.length <= 25 && v.Caption === v.Key && !v.Deleted
  return v.Type === '08' && (field === 'Номенклатура' ? v.TableReference === '0000006C' && ref(v.Key) : v.TableReference === '0000005A' && /^08:0000005A:[A-F0-9]{32}$/.test(v.Key))
}
export function normalizeAmgChoices(v: unknown, request: AmgDiscountRequest): AmgDiscountChoices {
  const scope = validateAmgDiscountRequest(request), fail = () => { throw new Error('Сервер не підтвердив актуальні назви AMG для цього зрізу.') }
  if (!object(v) || !echo(v, scope, true) || !object(v.FieldAvailability) || !object(v.Choices)
    || !same(Object.keys(v.FieldAvailability).sort(), [...amgDiscountFields].sort()) || !same(Object.keys(v.Choices).sort(), [...amgDiscountFields].sort())
    || typeof v.OrdinaryPublicationAvailable !== 'boolean' || typeof v.OurSnapshotVerified !== 'boolean' || !dependency(v.Dependency) || !digest(v.ResultSha256)
    || !(v.InputWitnessSha256 === null || digest(v.InputWitnessSha256)) || !(v.ChoicesWitnessSha256 === null || digest(v.ChoicesWitnessSha256))
    || ['NativeRecipientUniverseVerified', 'CurrentSourceVerified', 'SourceParityVerified'].some(k => v[k] !== false)) return fail()
  const availability = v.FieldAvailability, offered = v.Choices
  let count = 0
  for (const field of amgDiscountFields) {
    const rows = offered[field]
    if (typeof availability[field] !== 'boolean' || !Array.isArray(rows) || !availability[field] && rows.length > 0
      || !rows.every(row => choice(row, field)) || new Set(rows.map(row => row.Key)).size !== rows.length || (count += rows.length) > 1_500_000) return fail()
  }
  if (!same(v.MissingFamilies, amgDiscountFields.filter(f => !availability[f])) || v.HumanChoicesAvailable !== (v.OurSnapshotVerified && amgDiscountFields.every(f => availability[f]))) return fail()
  if (amgDiscountFields.some(f => availability[f]) && (!v.OrdinaryPublicationAvailable || !v.OurSnapshotVerified || !digest(v.InputWitnessSha256) || !digest(v.ChoicesWitnessSha256))) return fail()
  if (!v.OrdinaryPublicationAvailable && (v.OurSnapshotVerified || amgDiscountFields.some(f => availability[f]) || v.InputWitnessSha256 !== null || v.ChoicesWitnessSha256 !== null)) return fail()
  return structuredClone(v) as AmgDiscountChoices
}
export function selectedAmgRequest(through: string, selected: AmgDiscountSelection, names: AmgDiscountChoices | null): AmgDiscountRequest {
  const request = amgDiscountRequest(through)
  for (const field of amgDiscountFields) {
    if (!selected[field].length) continue
    if (!names || names.Through !== through || !names.OurSnapshotVerified || !names.FieldAvailability[field] || !digest(names.ChoicesWitnessSha256)) throw new Error('Завантажте актуальні назви та повторіть відбір.')
    const offered = new Set(names.Choices[field].map(c => c.Key))
    if (selected[field].some(key => !offered.has(key))) throw new Error('Завантажте актуальні назви та повторіть відбір.')
  }
  request.Products = [...selected.Номенклатура]
  request.Recipients = selected.ПолучательСкидки.map(key => { const [Type, Table, Reference] = key.split(':'); return { Type, Table, Reference } })
  request.RegionCodes = [...selected.КодПоРегиону]
  request.ChoicesWitnessSha256 = names?.Through === through && names.OurSnapshotVerified ? names.ChoicesWitnessSha256 : null
  return validateAmgDiscountRequest(request)
}
export function amgResultRequest(v: AmgDiscountResult): AmgDiscountRequest { return validateAmgDiscountRequest({ Version: v.Version, World: v.World, SourceId: v.SourceId, DefinitionSha256: v.DefinitionSha256, Through: v.Through, Products: v.Products, Recipients: v.Recipients, RegionCodes: v.RegionCodes, ChoicesWitnessSha256: v.ChoicesWitnessSha256 }) }
export function isAmgDiscountCatalogueEntry(report: ReportCatalogueEntry, worlds: readonly string[]) {
  return report.Id === 'builtin:ОтчетПоСкидкам' && worlds.includes('amg') && report.Sources.some(s => s.World === 'amg' && s.SourceId === AMG_DISCOUNTS_SOURCE && s.DefinitionSha256 === AMG_DISCOUNTS_DEFINITION)
}
