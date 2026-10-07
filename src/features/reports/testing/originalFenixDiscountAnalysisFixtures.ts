import { fenixDiscountIdentity, fenixDiscountRequest, normalizeFenixDiscountCapability, type FenixDiscountCell, type FenixDiscountRequest, type FenixDiscountResult } from '../data/originalFenixDiscountAnalysis'
export const fenixParty = '1'.repeat(32), fenixProduct = '2'.repeat(32), fenixPrice = '3'.repeat(32), fenixWitness = 'a'.repeat(64)
export const fenixPolicies = {
  IncludesGeneralTotals: false, DatePolicy: 'DeclaredAsOfBusinessDayThroughLastWholeSecond',
  ReferenceMaximumPolicy: 'UniqueReferenceOnlyMultipleReferencesRequireNativeOrdering',
  TypedPercentageMaximumPolicy: 'DeclaredReferenceBeforeNumberUniqueHighestReferenceOnly',
  AppliesFxConversion: false, NativeDateParametersVerified: false, NativeReferenceMaximumOrderingVerified: false,
  NativeTypePriorityCompatibilityVerified: false, NativeTypedPercentageMaximumVerified: false, SourceParityVerified: false, OriginalFullTaskAccepted: false,
} as const
export const fenixCapability = normalizeFenixDiscountCapability({ ...fenixDiscountIdentity, ...fenixPolicies,
  ModuleSha256: '850a4e7c39315436f11ac9edfc89787145d7ab1a7218008eade8b24d5c25c5bf',
  QuerySha256: '360d7b09d5f43108134e445030842ffe7820779816146742d56add5dbc1d9962',
  DefaultScopeCode: 'original_discount_analysis_default_v1', Executable: true, DefaultRows: ['Контрагент'], DefaultColumns: ['Номенклатура'],
  Filters: ['Контрагент', 'Номенклатура'], DefaultMeasures: ['ТипЦен', 'ПроцентСкидкиНаценки'], Aggregation: 'MaximumAtCounterpartyProductGrouping',
  HumanChoicesAvailable: false, SourceSyncEnabled: false, NormalInputsReadinessVerified: false })
export const fenixScope = () => fenixDiscountRequest('2026-09-30')
export function fenixCell(): FenixDiscountCell {
  return { CounterpartyRef: fenixParty, CounterpartyCaption: 'Клієнт Fenix', CounterpartyCaptionAvailable: true,
    ProductRef: fenixProduct, ProductCaption: 'Товар Fenix', ProductCaptionAvailable: true,
    PriceTypeRef: fenixPrice, PriceTypeCaption: 'Роздрібна', PriceTypeAvailable: true,
    PriceTypeCandidates: [{ Reference: fenixPrice, Caption: 'Роздрібна', CaptionAvailable: true }],
    Percentage: '-12.340', PercentageRef: null, PercentageReferenceCaption: null, PercentageAvailable: true,
    MissingPriceType: null, MissingPercentage: null, AgreementRefs: ['4'.repeat(32)], CharacteristicRefs: ['5'.repeat(32)], FactRows: 2 }
}
export function fenixResult(request: FenixDiscountRequest = fenixScope()): FenixDiscountResult {
  return { ...request, ...fenixPolicies, DefaultMeasures: ['ТипЦен', 'ПроцентСкидкиНаценки'], Rows: ['Контрагент'], Columns: ['Номенклатура'],
    Available: true, Code: 'original_discount_analysis_complete_supported_values', NormalInputsComplete: true, OurSnapshotVerified: true,
    InputWitnessSha256: fenixWitness, ResultSha256: 'b'.repeat(64), Cells: [fenixCell()], Dependency: null } as FenixDiscountResult
}
export function fenixEmpty(): FenixDiscountResult { return { ...fenixResult(), Cells: [] } }
export function fenixMissing(): FenixDiscountResult {
  return { ...fenixResult(), Available: false, Code: 'original_discount_analysis_input_unavailable', NormalInputsComplete: false,
    OurSnapshotVerified: false, InputWitnessSha256: null, ResultSha256: null, Cells: [], Dependency: 'ordinary_discount_publication_unavailable' }
}
export function fenixUnresolved(): FenixDiscountResult {
  const result = fenixResult(), cell = result.Cells[0]
  cell.PriceTypeAvailable = false; cell.PriceTypeRef = null; cell.PriceTypeCaption = null; cell.MissingPriceType = 'price_type_reference_maximum_ordering_unverified'
  cell.PriceTypeCandidates.push({ Reference: '6'.repeat(32), Caption: 'Оптова', CaptionAvailable: true })
  return { ...result, Available: false, Code: 'original_discount_analysis_resource_unavailable', Dependency: 'default_resource_or_caption_unresolved' }
}
