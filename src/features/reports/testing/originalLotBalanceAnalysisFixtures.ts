import { LOT_ANALYSIS_DEFINITION, LOT_ANALYSIS_SOURCE, lotAnalysisFilters, lotAnalysisMeasures, type LotAnalysisCapability,
  type LotAnalysisResult, type LotAnalysisValues } from '../data/originalLotBalanceAnalysis'
export const lotWarehouse = '00000000000000000000000000000015', lotProduct = '00000000000000000000000000000001'
export const lotAnalysisCapability: LotAnalysisCapability = { Version: 1, World: 'fenix', SourceId: LOT_ANALYSIS_SOURCE, DefinitionSha256: LOT_ANALYSIS_DEFINITION,
  ModuleSha256: 'f86e1793f36b1ced8bf531c16ffaa8106262eeb32509d4200738bf675b50d781', QuerySha256: '35d7c5117690b1ff7f9f81ba335808907b4c9d0fbaa776ad32791099711ff4b2',
  Executable: true, DefaultRows: [...lotAnalysisFilters], Filters: [...lotAnalysisFilters], DefaultMeasures: [...lotAnalysisMeasures], Measures: [...lotAnalysisMeasures],
  UnsupportedBuyerPolicy: 'NonemptySelectorRejectedUntilEffectiveOriginalUiRecovered', MoneyPolicy: 'NativeManagementCostPlusVatNoFxConversion',
  DatePolicy: 'InclusiveBusinessDaysThroughLastWholeSecond', OpeningRowPolicy: 'FullLotGrainOpeningQuantityOrNetOrVatNonzeroBeforeDisplayGrouping',
  AntiSalesPolicy: 'GlobalFull13ComponentSalesGrainAnyNonzeroSignedResourceNoWarehouseOrBuyerFilter', AppliesFxConversion: false,
  ManagementCurrencyPresentationVerified: false, SourceParityVerified: false, OriginalFullTaskAccepted: false }
export const lotValues: LotAnalysisValues = { КоличествоНачальныйОстаток: '-5.000', СтоимостьНачальныйОстаток: '-12.00', КоличествоКонечныйОстаток: '-4.000', СтоимостьКонечныйОстаток: '-10.00' }
export function lotAnalysisResponse(): LotAnalysisResult {
  return { Version: 1, World: 'fenix', SourceId: LOT_ANALYSIS_SOURCE, DefinitionSha256: LOT_ANALYSIS_DEFINITION,
    From: '2026-09-10', Through: '2026-09-12', Warehouses: [], Products: [], Buyers: [], Measures: [...lotAnalysisMeasures], Available: true,
    Code: 'original_lot_balance_analysis_complete', NormalInputsComplete: true, OurSnapshotVerified: true, InputWitnessSha256: 'a'.repeat(64), ResultSha256: 'b'.repeat(64),
    Rows: [{ Warehouse: lotWarehouse, Caption: 'Наш склад', CaptionAvailable: true, Values: { ...lotValues },
      Products: [{ Product: lotProduct, Caption: 'Наш товар', CaptionAvailable: true, Values: { ...lotValues } }] }], Totals: { ...lotValues },
    Choices: { Склад: [{ Key: lotWarehouse, Caption: 'Наш склад' }], Номенклатура: [{ Key: lotProduct, Caption: 'Наш товар' }] }, MissingCaptionMappings: [], Dependency: null,
    MoneyPolicy: lotAnalysisCapability.MoneyPolicy, DatePolicy: lotAnalysisCapability.DatePolicy, OpeningRowPolicy: lotAnalysisCapability.OpeningRowPolicy,
    AntiSalesPolicy: lotAnalysisCapability.AntiSalesPolicy, QuantityPolicy: 'NativeStoredQuantityNoCoefficientConversion', AppliesFxConversion: false,
    ManagementCurrencyPresentationVerified: false, SourceParityVerified: false, OriginalFullTaskAccepted: false }
}
export function emptyLotAnalysis(): LotAnalysisResult {
  return { ...lotAnalysisResponse(), Rows: [], Totals: { КоличествоНачальныйОстаток: '0.000', СтоимостьНачальныйОстаток: '0.00', КоличествоКонечныйОстаток: '0.000', СтоимостьКонечныйОстаток: '0.00' }, Choices: { Склад: [], Номенклатура: [] } }
}
export function missingLotAnalysis(): LotAnalysisResult {
  return { ...emptyLotAnalysis(), Available: false, NormalInputsComplete: false, Code: 'original_lot_balance_analysis_sales_month_unavailable',
    InputWitnessSha256: null, ResultSha256: null, Totals: null, Dependency: { Kind: 'sales_month_unavailable', MissingMonth: '2026-09-01' } }
}
