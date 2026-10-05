import { PURCHASES_DEFINITION, PURCHASES_SOURCE, purchasesDefaultMeasures, purchasesFilters, purchasesMeasures, purchasesRows, type PurchasesCapability, type PurchasesMeasure, type PurchasesPolicies, type PurchasesResult, type PurchasesRow } from '../data/originalPurchases'
const policies: PurchasesPolicies = {
  DatePolicy: 'DeclaredInclusiveBusinessDaysThroughLastWholeSecond', QuantityPolicy: 'SignedStoredPurchasesQuantityWithObservedProductOwnedUnitCoefficients',
  ZeroRowPolicy: 'RetainContributingNormalRowsIncludingCancellationNativeVirtualSuppressionUnverified', HumanChoicesAvailable: false,
  AppliesFxConversion: false, NativeDateParametersVerified: false, NativeVirtualRegistrarTotalsVerified: false, NativeZeroGroupSuppressionVerified: false,
  NativeNullNumericSemanticsVerified: false, SourceParityVerified: false, OriginalFullTaskAccepted: false,
}
export const purchasesCapability: PurchasesCapability = {
  Version: 1, World: 'fenix', SourceId: PURCHASES_SOURCE, DefinitionSha256: PURCHASES_DEFINITION, ...policies,
  ModuleSha256: '01f65a3bdf8e7768e5c91619196a6fb1c0afe1da04b2e6b569b7a4449376d37a',
  UniversalReportModuleSha256: 'c34895f1904a5af9fb80223ba12ef5dd8c9fc422ff5ed6caee7d73529a531a17', RegisterUuid: '7a7763d1-6dbb-4f9d-abc7-75a12ad42db3',
  QueryPolicy: 'OwnRegisterUniversalReportDynamicTurnoversRegistrarPeriodicity', DefaultScopeCode: 'original_purchases_declared_calendar_v1',
  Executable: true, SourceSyncEnabled: false, NormalInputsReadinessVerified: false, DefaultRows: [...purchasesRows], DefaultColumns: [],
  Filters: [...purchasesFilters], Measures: [...purchasesMeasures], DefaultMeasures: [...purchasesDefaultMeasures],
}
export const purchasesStatus = 'A'.repeat(32), purchasesParty = 'B'.repeat(32), purchasesProduct = 'C'.repeat(32), purchasesSecondProduct = 'D'.repeat(32)
export function purchasesResponse(measures: readonly PurchasesMeasure[] = purchasesDefaultMeasures): PurchasesResult {
  const selected = purchasesMeasures.filter(m => measures.includes(m))
  const total = { КоличествоОборот: '2.000', КоличествоЕдиницОтчетов: '0.667', КоличествоБазовыхЕд: '2.000', СтоимостьОборот: '123.46', НДСОборот: '24.70', ВесОборот: '3.126' }
  const leaf = { КоличествоОборот: '1.000', КоличествоЕдиницОтчетов: '0.333', КоличествоБазовыхЕд: '1.000', СтоимостьОборот: '61.73', НДСОборот: '12.35', ВесОборот: '1.563' }
  const values = Object.fromEntries(selected.map(m => [m, total[m]])), children = Object.fromEntries(selected.map(m => [m, leaf[m]]))
  return { Version: 1, World: 'fenix', SourceId: PURCHASES_SOURCE, DefinitionSha256: PURCHASES_DEFINITION, ...policies,
    From: '2026-09-10', Through: '2026-09-12', Selectors: { СтатусПартии: [], Контрагент: [], Номенклатура: [], Подразделение: [], Проект: [] }, Measures: selected,
    Available: true, Code: 'original_purchases_declared_calendar_complete', NormalInputsComplete: true, OurSnapshotVerified: true,
    InputWitnessSha256: 'a'.repeat(64), ResultSha256: 'b'.repeat(64), Totals: { ...values }, Dependency: null,
    Rows: [{ Field: 'СтатусПартии', Key: purchasesStatus, Caption: 'Назва недоступна', CaptionAvailable: false, Values: { ...values },
      Children: [{ Field: 'Контрагент', Key: purchasesParty, Caption: 'Назва недоступна', CaptionAvailable: false, Values: { ...values },
        Children: [purchasesProduct, purchasesSecondProduct].map<PurchasesRow>(Key => ({ Field: 'Номенклатура', Key, Caption: 'Назва недоступна', CaptionAvailable: false, Values: { ...children }, Children: [] })) }] }],
  }
}
export function emptyPurchases(): PurchasesResult {
  const result = purchasesResponse()
  return { ...result, Code: 'original_purchases_declared_calendar_empty', Rows: [], Totals: Object.fromEntries(result.Measures.map(m => [m, m === 'СтоимостьОборот' || m === 'НДСОборот' ? '0.00' : '0.000'])) }
}
export function missingPurchases(): PurchasesResult {
  return { ...purchasesResponse(), Available: false, Code: 'original_purchases_normal_month_incomplete', NormalInputsComplete: false,
    InputWitnessSha256: null, ResultSha256: null, Rows: [], Totals: null, Dependency: { Kind: 'normal_month_incomplete', MissingMonth: '2026-09', Product: null } }
}
