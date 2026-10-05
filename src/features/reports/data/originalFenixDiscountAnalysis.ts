import type { ReportCatalogueEntry } from '../types'

export const fenixDiscountIdentity = {
  Version: 1, World: 'fenix', SourceId: '0ac4605f-8ff9-4d0e-b694-8bdc55dc485a',
  DefinitionSha256: '168e4ef5787e1ec5e6d4a6a3ebfe5f9a002a6e28996661e550a5bc2778e7696a',
} as const
const moduleSha = '850a4e7c39315436f11ac9edfc89787145d7ab1a7218008eade8b24d5c25c5bf'
const querySha = '360d7b09d5f43108134e445030842ffe7820779816146742d56add5dbc1d9962'
const emptyRef = '00000000000000000000000000000000'
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const reference = (v: unknown): v is string => typeof v === 'string' && /^[0-9A-F]{32}$/.test(v)
const digest = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v) && /[1-9a-f]/.test(v)
const equal = (v: unknown, expected: readonly unknown[]) => Array.isArray(v) && v.length === expected.length && expected.every((item, i) => item === v[i])
const caption = (v: unknown): v is string => typeof v === 'string' && v.length <= 4096
const numberText = (v: unknown): v is string => typeof v === 'string' && /^-?(?:0|[1-9]\d{0,2})\.\d{3}$/.test(v) && v !== '-0.000'
const refusal = () => new Error('Сервер не підтвердив власний результат аналізу знижок Fenix.')
const unverified = ['AppliesFxConversion', 'NativeDateParametersVerified', 'NativeReferenceMaximumOrderingVerified',
  'NativeTypePriorityCompatibilityVerified', 'NativeTypedPercentageMaximumVerified', 'SourceParityVerified', 'OriginalFullTaskAccepted'] as const
const policy = {
  DatePolicy: 'DeclaredAsOfBusinessDayThroughLastWholeSecond',
  ReferenceMaximumPolicy: 'UniqueReferenceOnlyMultipleReferencesRequireNativeOrdering',
  TypedPercentageMaximumPolicy: 'DeclaredReferenceBeforeNumberUniqueHighestReferenceOnly',
} as const
export type FenixDiscountCapability = typeof fenixDiscountIdentity & typeof policy & {
  ModuleSha256: string; QuerySha256: string; Executable: boolean; HumanChoicesAvailable: false;
  NormalInputsReadinessVerified: false; SourceSyncEnabled: false
}
export type FenixDiscountRequest = typeof fenixDiscountIdentity & { Through: string; Counterparties: string[]; Products: string[]; ChoicesWitnessSha256?: string | null }
export type FenixDiscountCell = {
  CounterpartyRef: string; CounterpartyCaption: string | null; CounterpartyCaptionAvailable: boolean;
  ProductRef: string; ProductCaption: string | null; ProductCaptionAvailable: boolean;
  PriceTypeRef: string | null; PriceTypeCaption: string | null; PriceTypeAvailable: boolean;
  PriceTypeCandidates: { Reference: string; Caption: string | null; CaptionAvailable: boolean }[];
  Percentage: string | null; PercentageRef: string | null; PercentageReferenceCaption: string | null; PercentageAvailable: boolean;
  MissingPriceType: string | null; MissingPercentage: string | null; AgreementRefs: string[]; CharacteristicRefs: string[]; FactRows: number
}
export type FenixDiscountResult = FenixDiscountRequest & typeof policy & {
  Available: boolean; Code: string; NormalInputsComplete: boolean; OurSnapshotVerified: boolean;
  InputWitnessSha256: string | null; ResultSha256: string | null; Cells: FenixDiscountCell[]; Dependency: string | null
}
function identity(v: Record<string, unknown>) { return Object.entries(fenixDiscountIdentity).every(([k, expected]) => v[k] === expected) }
function policies(v: Record<string, unknown>) {
  return Object.entries(policy).every(([k, expected]) => v[k] === expected) && unverified.every(k => v[k] === false)
    && v.IncludesGeneralTotals === false && equal(v.DefaultMeasures, ['ТипЦен', 'ПроцентСкидкиНаценки'])
}
export function isFenixDiscountCatalogueEntry(report: ReportCatalogueEntry, worlds: readonly string[]) {
  return report.Id === 'builtin:АнализСкидокНаценокНоменклатуры' && worlds.includes('fenix')
    && report.Sources.some(s => s.World === 'fenix' && s.SourceId === fenixDiscountIdentity.SourceId && s.DefinitionSha256 === fenixDiscountIdentity.DefinitionSha256)
}
export function normalizeFenixDiscountCapability(value: unknown): FenixDiscountCapability {
  if (!record(value) || !identity(value) || !policies(value) || value.ModuleSha256 !== moduleSha || value.QuerySha256 !== querySha
    || value.Executable !== true || value.DefaultScopeCode !== 'original_discount_analysis_default_v1'
    || value.Aggregation !== 'MaximumAtCounterpartyProductGrouping' || !equal(value.DefaultRows, ['Контрагент'])
    || !equal(value.DefaultColumns, ['Номенклатура']) || !equal(value.Filters, ['Контрагент', 'Номенклатура'])
    || value.HumanChoicesAvailable !== false || value.SourceSyncEnabled !== false || value.NormalInputsReadinessVerified !== false) throw refusal()
  return structuredClone(value) as FenixDiscountCapability
}
export function fenixDiscountDateError(through: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(through)) return 'Оберіть дату зрізу.'
  const year = Number(through.slice(0, 4)), date = new Date(`${through}T00:00:00Z`)
  return year < 1753 || year > 7999 || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== through ? 'Дата зрізу недійсна.' : null
}
export function fenixDiscountRequest(through: string): FenixDiscountRequest {
  return validateFenixDiscountRequest({ ...fenixDiscountIdentity, Through: through, Counterparties: [], Products: [] })
}
function references(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(reference) && new Set(value).size === value.length
}
export function validateFenixDiscountRequest(value: unknown): FenixDiscountRequest {
  if (!record(value) || Object.keys(value).filter(k => k !== 'ChoicesWitnessSha256').sort().join(',') !== 'Counterparties,DefinitionSha256,Products,SourceId,Through,Version,World'
    || !identity(value) || typeof value.Through !== 'string' || fenixDiscountDateError(value.Through)
    || !references(value.Counterparties) || !references(value.Products) || value.Counterparties.length > 256 || value.Products.length > 256
    || value.ChoicesWitnessSha256 !== undefined && value.ChoicesWitnessSha256 !== null && !digest(value.ChoicesWitnessSha256)) throw refusal()
  const witness = value.ChoicesWitnessSha256 === undefined ? {} : { ChoicesWitnessSha256: value.ChoicesWitnessSha256 as string | null }
  return { ...fenixDiscountIdentity, Through: value.Through, Counterparties: [...value.Counterparties].sort(), Products: [...value.Products].sort(), ...witness }
}
function named(ref: unknown, text: unknown, available: unknown) {
  return reference(ref) && (available === true ? caption(text) && (ref === emptyRef ? text === '' : !!text.trim()) : available === false && text === null)
}
function price(value: Record<string, unknown>) {
  if (!Array.isArray(value.PriceTypeCandidates) || !value.PriceTypeCandidates.length || value.PriceTypeCandidates.length > 500_000) return false
  const seen = new Set<string>()
  for (const c of value.PriceTypeCandidates) {
    if (!record(c) || !reference(c.Reference) || seen.has(c.Reference) || !named(c.Reference, c.Caption, c.CaptionAvailable) || c.Reference === emptyRef && c.CaptionAvailable !== false) return false
    seen.add(c.Reference)
  }
  const only = value.PriceTypeCandidates[0]
  if (value.PriceTypeAvailable === true) return value.PriceTypeCandidates.length === 1 && only.CaptionAvailable === true
    && only.Reference !== emptyRef && value.PriceTypeRef === only.Reference && value.PriceTypeCaption === only.Caption && value.MissingPriceType === null
  return value.PriceTypeAvailable === false && value.PriceTypeRef === null && value.PriceTypeCaption === null
    && ['price_type_reference_maximum_ordering_unverified', 'price_type_empty_reference_presentation_unverified', 'price_type_caption_unavailable'].some(code => code === value.MissingPriceType)
}
function percentage(value: Record<string, unknown>) {
  if (value.PercentageAvailable === true) {
    if (value.MissingPercentage !== null) return false
    if (numberText(value.Percentage)) return value.PercentageRef === null && value.PercentageReferenceCaption === null
    return value.Percentage === null && reference(value.PercentageRef) && value.PercentageRef !== emptyRef
      && caption(value.PercentageReferenceCaption) && !!value.PercentageReferenceCaption.trim()
  }
  return value.PercentageAvailable === false && value.Percentage === null
    && (value.PercentageRef === null || value.PercentageRef === emptyRef) && value.PercentageReferenceCaption === null
    && ['typed_percentage_kind_unverified', 'percentage_reference_maximum_ordering_unverified', 'percentage_empty_reference_presentation_unverified', 'percentage_reference_caption_unavailable'].some(code => code === value.MissingPercentage)
}
function cells(value: unknown, request: FenixDiscountRequest): value is FenixDiscountCell[] {
  if (!Array.isArray(value) || value.length > 500_000) return false
  const parties = new Set(request.Counterparties), products = new Set(request.Products), keys = new Set<string>(), names = new Map<string, string>()
  for (const c of value) {
    if (!record(c) || !named(c.CounterpartyRef, c.CounterpartyCaption, c.CounterpartyCaptionAvailable)
      || !named(c.ProductRef, c.ProductCaption, c.ProductCaptionAvailable) || !price(c) || !percentage(c)
      || !references(c.AgreementRefs) || !references(c.CharacteristicRefs) || !Number.isSafeInteger(c.FactRows) || Number(c.FactRows) < 1
      || Number(c.FactRows) > 500_000 || parties.size > 0 && !parties.has(String(c.CounterpartyRef)) || products.size > 0 && !products.has(String(c.ProductRef))) return false
    const key = JSON.stringify([c.CounterpartyRef, c.ProductRef]); if (keys.has(key)) return false; keys.add(key)
    for (const field of ['Counterparty', 'Product']) {
      const nameKey = `${field}:${c[`${field}Ref`]}`, text = JSON.stringify([c[`${field}Caption`], c[`${field}CaptionAvailable`]])
      if (names.has(nameKey) && names.get(nameKey) !== text) return false
      names.set(nameKey, text)
    }
  }
  return true
}
export function normalizeFenixDiscountResult(value: unknown, request: FenixDiscountRequest): FenixDiscountResult {
  const scope = validateFenixDiscountRequest(request)
  if (!record(value) || !identity(value) || !policies(value) || !equal(value.Rows, ['Контрагент']) || !equal(value.Columns, ['Номенклатура'])
    || value.Through !== scope.Through || !equal(value.Counterparties, scope.Counterparties) || !equal(value.Products, scope.Products)
    || (value.ChoicesWitnessSha256 ?? null) !== (scope.ChoicesWitnessSha256 ?? null)
    || !cells(value.Cells, scope) || typeof value.Available !== 'boolean') throw refusal()
  if (value.NormalInputsComplete === false) {
    if (value.OurSnapshotVerified !== false || value.Available || value.Cells.length || value.InputWitnessSha256 !== null || value.ResultSha256 !== null
      || value.Code !== 'original_discount_analysis_input_unavailable' || typeof value.Dependency !== 'string') throw refusal()
  } else if (value.NormalInputsComplete === true && value.OurSnapshotVerified === true && digest(value.InputWitnessSha256) && digest(value.ResultSha256)) {
    const available = value.Cells.every(c => c.PriceTypeAvailable && c.PercentageAvailable && c.CounterpartyCaptionAvailable && c.ProductCaptionAvailable)
    if (value.Available !== available || value.Code !== (available ? 'original_discount_analysis_complete_supported_values' : 'original_discount_analysis_resource_unavailable')
      || value.Dependency !== (available ? null : 'default_resource_or_caption_unresolved')) throw refusal()
  } else throw refusal()
  return structuredClone(value) as FenixDiscountResult
}
export function fenixDiscountResultRequest(result: FenixDiscountResult): FenixDiscountRequest {
  return validateFenixDiscountRequest({ ...fenixDiscountIdentity, Through: result.Through, Counterparties: [...result.Counterparties], Products: [...result.Products],
    ...(result.ChoicesWitnessSha256 === undefined ? {} : { ChoicesWitnessSha256: result.ChoicesWitnessSha256 }) })
}
export type FenixDiscountIndex = {
  parties: { key: string; caption: string }[]; products: { key: string; caption: string }[]; cells: Map<string, FenixDiscountCell>
}
export function fenixDiscountIndex(result: FenixDiscountResult): FenixDiscountIndex {
  const parties = new Map<string, string>(), products = new Map<string, string>(), values = new Map<string, FenixDiscountCell>()
  for (const c of result.Cells) {
    parties.set(c.CounterpartyRef, c.CounterpartyCaptionAvailable ? c.CounterpartyCaption ?? '' : 'Назва контрагента недоступна')
    products.set(c.ProductRef, c.ProductCaptionAvailable ? c.ProductCaption ?? '' : 'Назва номенклатури недоступна')
    values.set(JSON.stringify([c.CounterpartyRef, c.ProductRef]), c)
  }
  const ordered = (map: Map<string, string>) => [...map].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, text]) => ({ key, caption: text }))
  return { parties: ordered(parties), products: ordered(products), cells: values }
}
export function fenixDiscountValues(cell: FenixDiscountCell | undefined): string[] {
  if (!cell) return ['', '']
  return [cell.PriceTypeAvailable ? cell.PriceTypeCaption ?? '' : 'Недоступно',
    cell.PercentageAvailable ? cell.Percentage ?? cell.PercentageReferenceCaption ?? '' : 'Недоступно']
}
