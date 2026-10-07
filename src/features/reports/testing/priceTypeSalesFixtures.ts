import { PRICE_SALES_SOURCE, PRICE_SALES_DEFINITION, priceSalesDefaults, priceSalesMeasures, type PriceSalesCapability, type PriceSalesMeasure, type PriceSalesResult, type PriceSalesValues } from '../data/originalPriceTypeSales'
export const salesParty = '00000000000000000000000000000015', salesProduct = '00000000000000000000000000000001', salesProject = '0000000000000000000000000000001F', salesDivision = '00000000000000000000000000000029', salesType = '00000000000000000000000000000009'
export const salesCapability: PriceSalesCapability = { Version: 1, World: 'fenix', SourceId: PRICE_SALES_SOURCE, DefinitionSha256: PRICE_SALES_DEFINITION,
  ModuleSha256: '6a0f7b79a80d76bb3990d43e18796bb620fa13822f1e8e162010c8c9800b02bd', QuerySha256: '095974888cc5320a8a9d186cbf7f748be3926dadc3898c525f6b898e0d3a93aa', Executable: true,
  DefaultRows: ['Контрагент', 'Номенклатура'], Filters: ['Контрагент', 'Номенклатура', 'Проект', 'Подразделение'], DefaultMeasures: priceSalesDefaults,
  Measures: [...priceSalesMeasures], MoneyPolicy: 'NativeStoredManagementSalesAndRawGlobalPriceNoFxConversion', DatePolicy: 'InclusiveBusinessDaysThroughLastWholeSecond',
  PriceSelection: 'DailyLatestExactPriceThenSourceOuterJoinWithoutDay', AppliesFxConversion: false, ManagementCurrencyPresentationVerified: false, SourceParityVerified: false, OriginalFullTaskAccepted: false }
const allValues: PriceSalesValues = { 'СтоимостьОборот': '-10.00', 'НДСОборот': '-2.00', 'СтоимостьСНДСОборот': '-12.00', 'СтоимостьПоТипуЦен': '-8.00',
  'РазницаМеждуСтоимостями': '-4.00', 'КоличествоОборот': '-2.000', 'КоличествоЕдиницОтчетов': '-4.000', 'КоличествоБазовыхЕд': '-5.000', 'СуммаСкидки': '-5.00', 'ПроцентСкидки': '33.33', 'СтоимостьБезСкидокОборот': '-15.00' }
export function salesResponse(measures: PriceSalesMeasure[] = priceSalesDefaults as PriceSalesMeasure[]): PriceSalesResult {
  const values = Object.fromEntries(measures.map(m => [m, allValues[m]])) as PriceSalesValues
  return { Version: 1, World: 'fenix', SourceId: PRICE_SALES_SOURCE, DefinitionSha256: PRICE_SALES_DEFINITION, From: '2026-09-10', Through: '2026-09-12', PriceType: salesType,
    Counterparties: [], Products: [], Projects: [], Divisions: [], Measures: measures, Available: true, Code: 'original_price_type_sales_complete', NormalInputsComplete: true, OurSnapshotVerified: true,
    InputWitnessSha256: 'a'.repeat(64), ResultSha256: 'b'.repeat(64), Rows: [{ Counterparty: salesParty, Caption: 'Наш контрагент', CaptionAvailable: true, Values: { ...values },
      Products: [{ Product: salesProduct, Caption: 'Наш товар', CaptionAvailable: true, Values: { ...values } }] }], Totals: { ...values },
    Choices: { 'Контрагент': [{ Key: salesParty, Caption: 'Наш контрагент' }], 'Номенклатура': [{ Key: salesProduct, Caption: 'Наш товар' }], 'Проект': [{ Key: salesProject, Caption: 'Наш проєкт' }], 'Подразделение': [{ Key: salesDivision, Caption: 'Наш підрозділ' }] },
    MissingCaptionMappings: [], Dependency: null, MoneyPolicy: salesCapability.MoneyPolicy, DatePolicy: salesCapability.DatePolicy, AppliesFxConversion: false, ManagementCurrencyPresentationVerified: false, SourceParityVerified: false, OriginalFullTaskAccepted: false }
}
export function emptySales(): PriceSalesResult {
  const r = salesResponse(), zero = { 'СтоимостьСНДСОборот': '0.00', 'СтоимостьПоТипуЦен': null, 'РазницаМеждуСтоимостями': null, 'КоличествоБазовыхЕд': '0.000' }
  return { ...r, Rows: [], Totals: zero, Choices: { 'Контрагент': [], 'Номенклатура': [], 'Проект': [], 'Подразделение': [] } }
}
export function missingSales(): PriceSalesResult {
  return { ...emptySales(), Available: false, NormalInputsComplete: false, Code: 'original_price_type_sales_selected_product_roles_incomplete', Totals: null, InputWitnessSha256: null, ResultSha256: null,
    Dependency: { Kind: 'SelectedSalesProductRolesV1', MissingMonth: null, ProductKeys: [salesProduct], MissingKeyCount: 1, HasMoreKeys: false } }
}
