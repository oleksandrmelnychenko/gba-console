// Synthetic wire fixtures only; these hashes do not represent a captured report result or current publication.
import { amgDiscountAnalysisIdentity, amgDiscountAnalysisRequest, normalizeAmgDiscountAnalysisCapability, type AmgDiscountAnalysisCell, type AmgDiscountAnalysisRequest, type AmgDiscountAnalysisResult } from '../data/originalAmgDiscountAnalysis'
export const amgParty = '1'.repeat(32), amgProduct = '2'.repeat(32), amgPrice = '3'.repeat(32), amgWitness = 'a'.repeat(64)
export const amgPolicies = {
  IncludesGeneralTotals: false, DatePolicy: 'DeclaredAsOfBusinessDayThroughLastWholeSecond',
  ReferenceMaximumPolicy: 'UniqueReferenceOnlyMultipleReferencesRequireNativeOrdering',
  TypedPercentageMaximumPolicy: 'DeclaredReferenceBeforeNumberUniqueHighestReferenceOnly',
  AppliesFxConversion: false, NativeDateParametersVerified: false, NativeReferenceMaximumOrderingVerified: false,
  NativeTypePriorityCompatibilityVerified: false, NativeTypedPercentageMaximumVerified: false, SourceParityVerified: false, OriginalFullTaskAccepted: false,
} as const
export const amgCapability = normalizeAmgDiscountAnalysisCapability({ ...amgDiscountAnalysisIdentity, ...amgPolicies,
  ModuleSha256: '850a4e7c39315436f11ac9edfc89787145d7ab1a7218008eade8b24d5c25c5bf',
  QuerySha256: '360d7b09d5f43108134e445030842ffe7820779816146742d56add5dbc1d9962',
  DefaultScopeCode: 'original_amg_discount_analysis_default_v1', Executable: true, DefaultRows: ['Контрагент'], DefaultColumns: ['Номенклатура'],
  Filters: ['Контрагент', 'Номенклатура'], DefaultMeasures: ['ТипЦен', 'ПроцентСкидкиНаценки'], Aggregation: 'MaximumAtCounterpartyProductGrouping',
  HumanChoicesAvailable: false, SourceSyncEnabled: false, NormalInputsReadinessVerified: false })
export const amgScope = () => amgDiscountAnalysisRequest('2026-09-30')
export function amgCell(): AmgDiscountAnalysisCell {
  return { CounterpartyRef: amgParty, CounterpartyCaption: 'Клієнт AMG', CounterpartyCaptionAvailable: true,
    ProductRef: amgProduct, ProductCaption: 'Товар AMG', ProductCaptionAvailable: true,
    PriceTypeRef: amgPrice, PriceTypeCaption: 'Роздрібна', PriceTypeAvailable: true,
    PriceTypeCandidates: [{ Reference: amgPrice, Caption: 'Роздрібна', CaptionAvailable: true }],
    Percentage: '-12.340', PercentageRef: null, PercentageReferenceCaption: null, PercentageAvailable: true,
    MissingPriceType: null, MissingPercentage: null, AgreementRefs: ['4'.repeat(32)], CharacteristicRefs: ['5'.repeat(32)], FactRows: 2 }
}
export function amgResult(request: AmgDiscountAnalysisRequest = amgScope()): AmgDiscountAnalysisResult {
  return { ...request, ...amgPolicies, DefaultMeasures: ['ТипЦен', 'ПроцентСкидкиНаценки'], Rows: ['Контрагент'], Columns: ['Номенклатура'],
    Available: true, Code: 'original_amg_discount_analysis_complete_supported_values', NormalInputsComplete: true, OurSnapshotVerified: true,
    InputWitnessSha256: amgWitness, ResultSha256: 'b'.repeat(64), Cells: [amgCell()], Dependency: null } as AmgDiscountAnalysisResult
}
export function amgEmpty(): AmgDiscountAnalysisResult { return { ...amgResult(), Cells: [] } }
export function amgMissing(): AmgDiscountAnalysisResult {
  return { ...amgResult(), Available: false, Code: 'original_amg_discount_analysis_input_unavailable', NormalInputsComplete: false,
    OurSnapshotVerified: false, InputWitnessSha256: null, ResultSha256: 'c'.repeat(64), Cells: [], Dependency: 'ordinary_discount_publication_unavailable' }
}
export function amgUnresolved(): AmgDiscountAnalysisResult {
  const result = amgResult(), cell = result.Cells[0]
  cell.PriceTypeAvailable = false; cell.PriceTypeRef = null; cell.PriceTypeCaption = null; cell.MissingPriceType = 'price_type_reference_maximum_ordering_unverified'
  cell.PriceTypeCandidates.push({ Reference: '6'.repeat(32), Caption: 'Оптова', CaptionAvailable: true })
  return { ...result, Available: false, Code: 'original_amg_discount_analysis_resource_unavailable', Dependency: 'default_resource_or_caption_unresolved' }
}
