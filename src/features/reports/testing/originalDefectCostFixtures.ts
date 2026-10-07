import { DEFECT_COST_SOURCE, DEFECT_COST_DEFINITION, defectCostDefaultMeasures, defectCostMeasures, type DefectCostCapability, type DefectCostMeasure, type DefectCostResult, type DefectCostChoicesResult, type DefectCostRequest } from '../data/originalDefectCost'
export const defectDivision = 'A'.repeat(32), defectArticle = 'B'.repeat(32)
export const defectCostCapability: DefectCostCapability = {
  Version: 1, World: 'fenix', SourceId: DEFECT_COST_SOURCE, DefinitionSha256: DEFECT_COST_DEFINITION,
  ModuleSha256: '904223eb90566808807ae7d5979178994b790b90bfe59301428470e01639ea8a', QuerySha256: '6554eff394bbd7bef569f6ffedc5b32a1ac6bc4dbef71c62d1dcd8557c51a505',
  Executable: true, DefaultRows: ['Подразделение', 'СтатьяЗатрат'], Filters: ['Подразделение', 'СтатьяЗатрат'],
  DefaultMeasures: [...defectCostDefaultMeasures], Measures: [...defectCostMeasures], DefaultScopeCode: 'original_defect_cost_default_v1',
  SourceSyncEnabled: false, NormalInputsReadinessVerified: false, ScopedNamedChoicesSupported: true, MoneyPolicy: 'NativeStoredManagementDefectCostNoFxConversion', DatePolicy: 'InclusiveBusinessDaysThroughLastWholeSecond',
  AppliesFxConversion: false, ManagementCurrencyPresentationVerified: false, HumanChoicesAvailable: false, NativeDateParametersVerified: false,
  NativeVirtualRegistrarTotalsVerified: false, NativeZeroGroupSuppressionVerified: false, SourceParityVerified: false, OriginalFullTaskAccepted: false,
}
const sampleValues: Record<DefectCostMeasure, string> = {
  НачОст: '-10.00', НачОстНДС: '-2.00', Приход: '30.00', ПриходНДС: '6.00',
  Расход: '-4.00', РасходНДС: '-0.80', КонОст: '24.00', КонОстНДС: '4.80',
}
export function defectCostResponse(measures: readonly DefectCostMeasure[] = defectCostDefaultMeasures): DefectCostResult {
  const selected = defectCostMeasures.filter(m => measures.includes(m)), values = Object.fromEntries(selected.map(m => [m, sampleValues[m]]))
  return { Version: 1, World: 'fenix', SourceId: DEFECT_COST_SOURCE, DefinitionSha256: DEFECT_COST_DEFINITION,
    From: '2026-09-10', Through: '2026-09-12', Divisions: [], CostArticles: [], Measures: selected,
    Available: true, Code: 'original_defect_cost_declared_calendar_complete', NormalInputsComplete: true, OurSnapshotVerified: true,
    InputWitnessSha256: 'a'.repeat(64), ResultSha256: 'b'.repeat(64), Choices: { Подразделение: [], СтатьяЗатрат: [] }, MissingNamedFamilies: ['Подразделение', 'СтатьяЗатрат'], NamedChoicesWitnessSha256: null,
    Rows: [{ Division: defectDivision, Caption: null, CaptionAvailable: false, Values: { ...values },
      Articles: [{ CostArticle: defectArticle, Caption: null, CaptionAvailable: false, Values: { ...values } }] }], Totals: { ...values }, Dependency: null,
    MoneyPolicy: 'NativeStoredManagementDefectCostNoFxConversion', DatePolicy: 'InclusiveBusinessDaysThroughLastWholeSecond',
    AppliesFxConversion: false, ManagementCurrencyPresentationVerified: false, HumanChoicesAvailable: false, NativeDateParametersVerified: false,
    NativeVirtualRegistrarTotalsVerified: false, NativeZeroGroupSuppressionVerified: false, SourceParityVerified: false, OriginalFullTaskAccepted: false }
}
export function emptyDefectCost(): DefectCostResult {
  const result = defectCostResponse()
  return { ...result, Rows: [], Totals: Object.fromEntries(result.Measures.map(m => [m, '0.00'])) }
}
export function missingDefectCost(): DefectCostResult {
  return { ...defectCostResponse(), Available: false, Code: 'original_defect_cost_month_publication_unavailable', NormalInputsComplete: false,
    Rows: [], Totals: null, InputWitnessSha256: null, ResultSha256: null, Dependency: { Kind: 'month_publication_unavailable', MissingMonth: '2026-09-01' } }
}

export function defectCostChoices(request: DefectCostRequest): DefectCostChoicesResult {
  return { ...structuredClone(request), Available: true, NormalInputsComplete: true, OurSnapshotVerified: true,
    InputWitnessSha256: 'a'.repeat(64), NamedChoicesWitnessSha256: 'd'.repeat(64), MissingFamilies: [], Dependency: null,
    Choices: { Подразделение: [{ Field: 'Подразделение', Type: '08', TableReference: '00000061', Key: defectDivision, Caption: 'Цех', Deleted: false }],
      СтатьяЗатрат: [{ Field: 'СтатьяЗатрат', Type: '08', TableReference: '00000081', Key: defectArticle, Caption: 'Потери', Deleted: false }] } }
}
export function namedDefectCost(request: DefectCostRequest): DefectCostResult {
  const names = defectCostChoices(request), result = defectCostResponse(request.Measures)
  return { ...result, ...structuredClone(request), Choices: names.Choices, MissingNamedFamilies: [], NamedChoicesWitnessSha256: names.NamedChoicesWitnessSha256,
    HumanChoicesAvailable: true, Rows: result.Rows.map(row => ({ ...row, Caption: 'Цех', CaptionAvailable: true,
      Articles: row.Articles.map(article => ({ ...article, Caption: 'Потери', CaptionAvailable: true })) })) }
}
