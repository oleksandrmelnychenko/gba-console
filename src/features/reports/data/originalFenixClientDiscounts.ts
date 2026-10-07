import type { ReportCatalogueEntry } from '../types'

export const FENIX_DISCOUNTS_SOURCE = '56e2ad4b-9f75-4461-a742-eb54ae01823f'
export const FENIX_DISCOUNTS_DEFINITION = 'e355fd45fed1b64f52704baa92f09755b91bea96be74953c182f65b1c8fcc637'
export const fenixDiscountFields = ['Номенклатура', 'ПолучательСкидки', 'КодПоРегиону'] as const
export type FenixDiscountField = typeof fenixDiscountFields[number]
export const fenixDiscountLabels: Record<FenixDiscountField, string> = { Номенклатура: 'Номенклатура', ПолучательСкидки: 'Отримувач знижки', КодПоРегиону: 'Прямий код регіону' }
export type FenixRecipient = { Type: string; Table: string; Reference: string }
export type FenixDiscountRequest = { Version: 1; World: 'fenix'; SourceId: string; DefinitionSha256: string; Through: string; Products: string[]; Recipients: FenixRecipient[]; RegionCodes: string[]; ChoicesWitnessSha256: string | null }
export type FenixDiscountReadiness = {
  Version: 1; World: 'fenix'; SourceId: string; DefinitionSha256: string; ModuleSha256: string; QuerySha256: string;
  DefaultRows: string[]; DefaultColumns: string[]; DefaultMeasures: string[]; Filters: string[]; Aggregation: string; DecimalPlaces: 2;
  SupportedRecipientTable: '00000044'; SupportedPercentageType: '03'; Executable: boolean; OrdinaryPublicationAvailable: boolean;
  OurSnapshotVerified: boolean; Dependency: string | null; InputWitnessSha256: string | null; NativeRecipientUniverseVerified: false;
  OriginalFullTaskAccepted: false; SourceSyncEnabled: false; HumanChoicesAvailable: false; CurrentSourceVerified: false; SourceParityVerified: false; NativeDateParametersVerified: false;
}
export type FenixDiscountCell = { Recipient: FenixRecipient; RecipientName: string; RegionCode: string | null; Product: string; ProductName: string; Percentage: string; FactRows: number }
export type FenixDiscountResult = Pick<FenixDiscountRequest, 'Version' | 'World' | 'SourceId' | 'DefinitionSha256' | 'Through' | 'Products' | 'Recipients' | 'RegionCodes' | 'ChoicesWitnessSha256'> & {
  InputAvailable: boolean; OrdinaryPublicationAvailable: boolean; OurSnapshotVerified: boolean; Dependency: string | null;
  Cells: FenixDiscountCell[]; MaximumPercentage: string | null; InputWitnessSha256: string | null; ResultSha256: string;
  PeriodPolicy: 'DeclaredLastWholeSecond'; SourceParityVerified: false; NativeDateParametersVerified: false; NativeStringComparisonVerified: false; AppliesFxConversion: false;
}
export type FenixDiscountChoice = { Field: FenixDiscountField; Type: string; TableReference: string | null; Key: string; Caption: string; Deleted: boolean }
export type FenixDiscountChoices = Pick<FenixDiscountRequest, 'Version' | 'World' | 'SourceId' | 'DefinitionSha256' | 'Through'> & {
  RequestedProducts: string[]; RequestedRecipients: FenixRecipient[]; RequestedRegionCodes: string[];
  OrdinaryPublicationAvailable: boolean; OurSnapshotVerified: boolean; Dependency: string | null;
  FieldAvailability: Record<FenixDiscountField, boolean>; Choices: Record<FenixDiscountField, FenixDiscountChoice[]>; MissingFamilies: FenixDiscountField[];
  InputWitnessSha256: string | null; ChoicesWitnessSha256: string | null; ResultSha256: string; HumanChoicesAvailable: boolean;
  NativeRecipientUniverseVerified: false; CurrentSourceVerified: false; SourceParityVerified: false;
}
export type FenixDiscountSelection = Record<FenixDiscountField, string[]>
export const emptyFenixSelection = (): FenixDiscountSelection => ({ Номенклатура: [], ПолучательСкидки: [], КодПоРегиону: [] })
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)
const ref = (v: unknown): v is string => typeof v === 'string' && /^[A-F0-9]{32}$/.test(v)
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
function human(v: unknown): v is string {
  if (typeof v !== 'string' || !v.trim().length || v.length > 512) return false
  for (let i = 0; i < v.length; i++) {
    const unit = v.charCodeAt(i)
    if (unit >= 0xd800 && unit <= 0xdbff) { const low = v.charCodeAt(++i); if (!(low >= 0xdc00 && low <= 0xdfff)) return false }
    else if (unit >= 0xdc00 && unit <= 0xdfff) return false
  }
  return true
}
const identity = (v: Record<string, unknown>) => v.Version === 1 && v.World === 'fenix' && v.SourceId === FENIX_DISCOUNTS_SOURCE && v.DefinitionSha256 === FENIX_DISCOUNTS_DEFINITION
const dependency = (v: unknown) => v === null || typeof v === 'string' && /^[a-z][a-z0-9_]{0,200}$/.test(v)
export const fenixRecipientKey = (v: FenixRecipient) => `${v.Type}:${v.Table}:${v.Reference}`
function recipient(v: unknown): v is FenixRecipient { return object(v) && typeof v.Type === 'string' && /^[A-F0-9]{2}$/.test(v.Type) && typeof v.Table === 'string' && /^[A-F0-9]{8}$/.test(v.Table) && ref(v.Reference) }
export function fenixDateError(through: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(through) || through < '1753-01-01' || through > '7999-12-31') return 'Виберіть коректну дату зрізу.'
  const date = new Date(`${through}T00:00:00Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== through ? 'Виберіть коректну дату зрізу.' : null
}
export function fenixDiscountRequest(through: string): FenixDiscountRequest {
  return { Version: 1, World: 'fenix', SourceId: FENIX_DISCOUNTS_SOURCE, DefinitionSha256: FENIX_DISCOUNTS_DEFINITION, Through: through, Products: [], Recipients: [], RegionCodes: [], ChoicesWitnessSha256: null }
}
export function validateFenixDiscountRequest(input: FenixDiscountRequest): FenixDiscountRequest {
  if (!identity(input) || fenixDateError(input.Through) || !Array.isArray(input.Products) || !Array.isArray(input.Recipients) || !Array.isArray(input.RegionCodes)
    || [input.Products, input.Recipients, input.RegionCodes].some(v => v.length > 256)
    || !input.Products.every(ref) || !input.Recipients.every(recipient) || !input.RegionCodes.every(v => typeof v === 'string' && v.length <= 25)
    || new Set(input.Products).size !== input.Products.length || new Set(input.Recipients.map(fenixRecipientKey)).size !== input.Recipients.length
    || new Set(input.RegionCodes).size !== input.RegionCodes.length || !(input.ChoicesWitnessSha256 === null || digest(input.ChoicesWitnessSha256))) throw new Error('Некоректні параметри оригінального звіту FENIX.')
  return { Version: 1, World: 'fenix', SourceId: FENIX_DISCOUNTS_SOURCE, DefinitionSha256: FENIX_DISCOUNTS_DEFINITION, Through: input.Through,
    Products: [...input.Products].sort(), Recipients: input.Recipients.map(v => ({ Type: v.Type, Table: v.Table, Reference: v.Reference })).sort((a, b) => fenixRecipientKey(a) < fenixRecipientKey(b) ? -1 : fenixRecipientKey(a) > fenixRecipientKey(b) ? 1 : 0), RegionCodes: [...input.RegionCodes].sort(), ChoicesWitnessSha256: input.ChoicesWitnessSha256 }
}
export function normalizeFenixReadiness(v: unknown): FenixDiscountReadiness {
  if (!object(v) || !identity(v) || v.ModuleSha256 !== '7bd692b383d5a2dc52645e4d1316bb292abb5904944bb686b3075db6e5795967'
    || v.QuerySha256 !== '6176122623be4ad0696ff2b614943d645c9290b094f9babe7f0f48854e13e2b8'
    || !same(v.DefaultRows, ['ПолучательСкидки']) || !same(v.DefaultColumns, ['Номенклатура']) || !same(v.DefaultMeasures, ['ПроцентСкидкиНаценки'])
    || !same(v.Filters, fenixDiscountFields) || v.Aggregation !== 'MaximumAtRecipientProductGrain' || v.DecimalPlaces !== 2 || v.SupportedRecipientTable !== '00000044' || v.SupportedPercentageType !== '03'
    || typeof v.OrdinaryPublicationAvailable !== 'boolean' || typeof v.OurSnapshotVerified !== 'boolean' || v.Executable !== (v.OrdinaryPublicationAvailable && v.OurSnapshotVerified)
    || !dependency(v.Dependency) || !(v.InputWitnessSha256 === null || digest(v.InputWitnessSha256)) || v.OrdinaryPublicationAvailable && (!digest(v.InputWitnessSha256) || v.Dependency !== null)
    || ['NativeRecipientUniverseVerified', 'OriginalFullTaskAccepted', 'SourceSyncEnabled', 'HumanChoicesAvailable', 'CurrentSourceVerified', 'SourceParityVerified', 'NativeDateParametersVerified'].some(k => v[k] !== false)) throw new Error('Сервер не підтвердив готовність оригінального звіту FENIX.')
  return structuredClone(v) as FenixDiscountReadiness
}
/** The stored numeric(5,2) percentage is exact text. Percentages are never summed. */
export function fenixPercentage(v: unknown): bigint {
  if (typeof v !== 'string' || !/^-?(0|[1-9]\d{0,2})\.\d{2}$/.test(v) || v === '-0.00') throw new Error('Некоректний точний відсоток FENIX.')
  return BigInt(v.replace('.', ''))
}
function echo(v: Record<string, unknown>, scope: FenixDiscountRequest, choices = false) {
  return identity(v) && v.Through === scope.Through && same(v[choices ? 'RequestedProducts' : 'Products'], scope.Products)
    && same(v[choices ? 'RequestedRecipients' : 'Recipients'], scope.Recipients) && same(v[choices ? 'RequestedRegionCodes' : 'RegionCodes'], scope.RegionCodes)
}
function checkedFenixDiscounts(v: unknown, request: FenixDiscountRequest): FenixDiscountResult {
  const scope = validateFenixDiscountRequest(request), fail = () => { throw new Error('Сервер не підтвердив результат для поточних параметрів FENIX.') }
  if (!object(v) || !echo(v, scope) || v.ChoicesWitnessSha256 !== scope.ChoicesWitnessSha256 || !digest(v.ResultSha256)
    || typeof v.InputAvailable !== 'boolean' || typeof v.OrdinaryPublicationAvailable !== 'boolean' || typeof v.OurSnapshotVerified !== 'boolean'
    || !dependency(v.Dependency) || !Array.isArray(v.Cells) || v.Cells.length > 500_000 || v.PeriodPolicy !== 'DeclaredLastWholeSecond'
    || ['SourceParityVerified', 'NativeDateParametersVerified', 'NativeStringComparisonVerified', 'AppliesFxConversion'].some(k => v[k] !== false)) return fail()
  if (!v.InputAvailable) {
    if (v.Cells.length || v.MaximumPercentage !== null || v.InputWitnessSha256 !== null || v.Dependency === null) return fail()
    return v as FenixDiscountResult
  }
  if (!v.OrdinaryPublicationAvailable || !v.OurSnapshotVerified || v.Dependency !== null || !digest(v.InputWitnessSha256)) return fail()
  const products = new Set(scope.Products), recipients = new Set(scope.Recipients.map(fenixRecipientKey)), regions = new Set(scope.RegionCodes)
  const keys = new Set<string>(); let maximum: bigint | null = null
  for (const cell of v.Cells) {
    if (!object(cell) || !recipient(cell.Recipient) || cell.Recipient.Type !== '08' || cell.Recipient.Table !== '00000044'
      || !human(cell.RecipientName) || !ref(cell.Product) || !human(cell.ProductName) || !(cell.RegionCode === null || typeof cell.RegionCode === 'string' && cell.RegionCode.length <= 25)
      || typeof cell.FactRows !== 'number' || !Number.isSafeInteger(cell.FactRows) || cell.FactRows < 1 || products.size && !products.has(cell.Product)
      || recipients.size && !recipients.has(fenixRecipientKey(cell.Recipient))
      || regions.size && !regions.has(cell.RegionCode as string)) return fail()
    const key = `${fenixRecipientKey(cell.Recipient)}:${cell.Product}`
    if (keys.has(key)) return fail(); keys.add(key)
    const percentage = fenixPercentage(cell.Percentage); maximum = maximum === null || percentage > maximum ? percentage : maximum
  }
  if (maximum === null ? v.MaximumPercentage !== null : fenixPercentage(v.MaximumPercentage) !== maximum) return fail()
  return v as FenixDiscountResult
}
/** API responses are detached after complete validation. Export validation does not duplicate the full result. */
export function normalizeFenixDiscounts(v: unknown, request: FenixDiscountRequest): FenixDiscountResult { return structuredClone(checkedFenixDiscounts(v, request)) }
export function validateFenixDiscountResult(v: unknown, request: FenixDiscountRequest): void { checkedFenixDiscounts(v, request) }

function choice(v: unknown, field: FenixDiscountField): v is FenixDiscountChoice {
  if (!object(v) || v.Field !== field || !human(v.Caption) || typeof v.Deleted !== 'boolean' || typeof v.Key !== 'string') return false
  if (field === 'КодПоРегиону') return v.Type === 'string' && v.TableReference === null && v.Key.length > 0 && v.Key.length <= 25 && v.Caption === v.Key && !v.Deleted
  return v.Type === '08' && (field === 'Номенклатура' ? v.TableReference === '00000054' && ref(v.Key) : v.TableReference === '00000044' && /^08:00000044:[A-F0-9]{32}$/.test(v.Key))
}
export function normalizeFenixChoices(v: unknown, request: FenixDiscountRequest): FenixDiscountChoices {
  const scope = validateFenixDiscountRequest(request), fail = () => { throw new Error('Сервер не підтвердив актуальні назви FENIX для цього зрізу.') }
  if (!object(v) || !echo(v, scope, true) || !object(v.FieldAvailability) || !object(v.Choices)
    || !same(Object.keys(v.FieldAvailability).sort(), [...fenixDiscountFields].sort()) || !same(Object.keys(v.Choices).sort(), [...fenixDiscountFields].sort())
    || typeof v.OrdinaryPublicationAvailable !== 'boolean' || typeof v.OurSnapshotVerified !== 'boolean' || !dependency(v.Dependency) || !digest(v.ResultSha256)
    || !(v.InputWitnessSha256 === null || digest(v.InputWitnessSha256)) || !(v.ChoicesWitnessSha256 === null || digest(v.ChoicesWitnessSha256))
    || ['NativeRecipientUniverseVerified', 'CurrentSourceVerified', 'SourceParityVerified'].some(k => v[k] !== false)) return fail()
  const availability = v.FieldAvailability, offered = v.Choices
  let count = 0
  for (const field of fenixDiscountFields) {
    const rows = offered[field]
    if (typeof availability[field] !== 'boolean' || !Array.isArray(rows) || !availability[field] && rows.length > 0
      || !rows.every(row => choice(row, field)) || new Set(rows.map(row => row.Key)).size !== rows.length || (count += rows.length) > 1_500_000) return fail()
  }
  if (!same(v.MissingFamilies, fenixDiscountFields.filter(f => !availability[f])) || v.HumanChoicesAvailable !== (v.OurSnapshotVerified && fenixDiscountFields.every(f => availability[f]))) return fail()
  if (fenixDiscountFields.some(f => availability[f]) && (!v.OrdinaryPublicationAvailable || !v.OurSnapshotVerified || !digest(v.InputWitnessSha256) || !digest(v.ChoicesWitnessSha256))) return fail()
  if (!v.OrdinaryPublicationAvailable && (v.OurSnapshotVerified || fenixDiscountFields.some(f => availability[f]) || v.InputWitnessSha256 !== null || v.ChoicesWitnessSha256 !== null)) return fail()
  return structuredClone(v) as FenixDiscountChoices
}
export function selectedFenixRequest(through: string, selected: FenixDiscountSelection, names: FenixDiscountChoices | null): FenixDiscountRequest {
  const request = fenixDiscountRequest(through)
  for (const field of fenixDiscountFields) {
    if (!selected[field].length) continue
    if (!names || names.Through !== through || !names.OurSnapshotVerified || !names.FieldAvailability[field] || !digest(names.ChoicesWitnessSha256)) throw new Error('Завантажте актуальні назви та повторіть відбір.')
    const offered = new Set(names.Choices[field].map(c => c.Key))
    if (selected[field].some(key => !offered.has(key))) throw new Error('Завантажте актуальні назви та повторіть відбір.')
  }
  request.Products = [...selected.Номенклатура]
  request.Recipients = selected.ПолучательСкидки.map(key => { const [Type, Table, Reference] = key.split(':'); return { Type, Table, Reference } })
  request.RegionCodes = [...selected.КодПоРегиону]
  request.ChoicesWitnessSha256 = names?.Through === through && names.OurSnapshotVerified ? names.ChoicesWitnessSha256 : null
  return validateFenixDiscountRequest(request)
}
export function fenixResultRequest(v: FenixDiscountResult): FenixDiscountRequest { return validateFenixDiscountRequest({ Version: v.Version, World: v.World, SourceId: v.SourceId, DefinitionSha256: v.DefinitionSha256, Through: v.Through, Products: v.Products, Recipients: v.Recipients, RegionCodes: v.RegionCodes, ChoicesWitnessSha256: v.ChoicesWitnessSha256 }) }
export function isFenixDiscountCatalogueEntry(report: ReportCatalogueEntry, worlds: readonly string[]) {
  return report.Id === 'builtin:ОтчетПоСкидкам' && worlds.includes('fenix') && report.Sources.some(s => s.World === 'fenix' && s.SourceId === FENIX_DISCOUNTS_SOURCE && s.DefinitionSha256 === FENIX_DISCOUNTS_DEFINITION)
}

/** Shared strict typed caption/key validation for bounded public pages. */
export { choice as isFenixDiscountChoice }
