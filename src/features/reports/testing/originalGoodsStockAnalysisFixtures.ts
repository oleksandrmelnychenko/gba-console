import { GOODS_ANALYSIS_DEFINITION, GOODS_ANALYSIS_SOURCE, goodsAnalysisFilters, goodsAnalysisMeasures, type GoodsAnalysisCapability,
  type GoodsAnalysisResult, type GoodsAnalysisValues } from '../data/originalGoodsStockAnalysis'
export const goodsWarehouse = '00000000000000000000000000000015', goodsProduct = '00000000000000000000000000000001'
export const goodsAnalysisCapability: GoodsAnalysisCapability = { Version: 1, World: 'fenix', SourceId: GOODS_ANALYSIS_SOURCE, DefinitionSha256: GOODS_ANALYSIS_DEFINITION,
  ModuleSha256: '5accca51ad486a2834ed6c138c95fa5d97bc4b5839fc9123026c54b62f3a5b55', QuerySha256: 'e27581b8b470d0be638f1dab05392559d21ceb8d9c742c44ceae57a8665280e2',
  Executable: true, DefaultRows: [...goodsAnalysisFilters], Filters: [...goodsAnalysisFilters], DefaultMeasures: [...goodsAnalysisMeasures], Measures: [...goodsAnalysisMeasures],
  DefaultScopeCode: 'original_goods_stock_analysis_default_v1', SourceSyncEnabled: false, NativeVirtualBoundaryParityVerified: false,
  MoneyPolicy: 'NoMoneyResourceInOriginalDefault', DatePolicy: 'StrictBeforeStartOpeningAndInclusiveBusinessDaysThroughLastWholeSecond',
  OpeningRowPolicy: 'NonzeroFullFiveDimensionOpeningQuantityJoinOnWarehouseProductCharacteristicQualityWithoutSeries',
  AntiSalesPolicy: 'GlobalRecorderPeriodFull13SalesGrainPositiveQuantityNoWarehouseFilter', AppliesFxConversion: false,
  ManagementCurrencyPresentationVerified: false, SourceParityVerified: false, OriginalFullTaskAccepted: false }
export const goodsValues: GoodsAnalysisValues = { КоличествоНачальныйОстаток: '-5.000', КоличествоКонечныйОстаток: '-4.000' }
export function goodsAnalysisResponse(): GoodsAnalysisResult {
  return { Version: 1, World: 'fenix', SourceId: GOODS_ANALYSIS_SOURCE, DefinitionSha256: GOODS_ANALYSIS_DEFINITION,
    From: '2026-09-10', Through: '2026-09-12', Warehouses: [], Products: [], Measures: [...goodsAnalysisMeasures], Available: true,
    Code: 'original_goods_stock_analysis_complete', NormalInputsComplete: true, OurSnapshotVerified: true, InputWitnessSha256: 'a'.repeat(64), ResultSha256: 'b'.repeat(64),
    Rows: [{ Warehouse: goodsWarehouse, Caption: 'Наш склад', CaptionAvailable: true, Values: { ...goodsValues },
      Products: [{ Product: goodsProduct, Caption: 'Наш товар', CaptionAvailable: true, Values: { ...goodsValues } }] }], Totals: { ...goodsValues },
    Choices: { Склад: [{ Key: goodsWarehouse, Caption: 'Наш склад' }], Номенклатура: [{ Key: goodsProduct, Caption: 'Наш товар' }] }, MissingCaptionMappings: [], Dependency: null,
    MoneyPolicy: goodsAnalysisCapability.MoneyPolicy, DatePolicy: goodsAnalysisCapability.DatePolicy, OpeningRowPolicy: goodsAnalysisCapability.OpeningRowPolicy,
    AntiSalesPolicy: goodsAnalysisCapability.AntiSalesPolicy, QuantityPolicy: 'NativeStoredQuantityNoCoefficientConversion', AppliesFxConversion: false,
    ManagementCurrencyPresentationVerified: false, SourceParityVerified: false, OriginalFullTaskAccepted: false }
}
export function emptyGoodsAnalysis(): GoodsAnalysisResult {
  return { ...goodsAnalysisResponse(), Rows: [], Totals: { КоличествоНачальныйОстаток: '0.000', КоличествоКонечныйОстаток: '0.000' }, Choices: { Склад: [], Номенклатура: [] } }
}
export function missingGoodsAnalysis(): GoodsAnalysisResult {
  return { ...emptyGoodsAnalysis(), Available: false, NormalInputsComplete: false, Code: 'original_goods_stock_analysis_sales_month_unavailable',
    InputWitnessSha256: null, ResultSha256: null, Totals: null, Dependency: { Kind: 'sales_month_unavailable', MissingMonth: '2026-09-01' } }
}
