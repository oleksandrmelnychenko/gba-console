import { SALES_SOURCE, SALES_DEFINITION, salesDefaults, salesMeasures, type SalesCapability, type SalesMeasure, type SalesResult, type SalesValues } from '../data/originalSales'
export const salesParty = '00000000000000000000000000000015', salesProduct = '00000000000000000000000000000001', salesProject = '0000000000000000000000000000001F', salesDivision = '00000000000000000000000000000029'
export const salesCapability: SalesCapability = { Version: 1, World: 'fenix', SourceId: SALES_SOURCE, DefinitionSha256: SALES_DEFINITION,
  ModuleSha256: '458578c3b5a09cea2b7847672fb930d4e16645d77fedeed328283fc2921ea0a8', QuerySha256: '58052f01eb6814a6c92483085033c116e34cc4a89506fb4bafae87faf788d717', Executable: true,
  DefaultRows: ['Контрагент', 'Номенклатура'], Filters: ['Контрагент', 'Номенклатура', 'Проект', 'Подразделение'], DefaultMeasures: salesDefaults,
  Measures: [...salesMeasures], MoneyPolicy: 'NativeStoredManagementSalesNoFxConversion', DatePolicy: 'InclusiveBusinessDaysThroughLastWholeSecond',
   AppliesFxConversion: false, ManagementCurrencyPresentationVerified: false, BaseUnitPresentationVerified: false, SourceParityVerified: false, OriginalFullTaskAccepted: false }
const allValues: SalesValues = { 'СтоимостьОборот': '-10.00', 'НДСОборот': '-2.00', 'СтоимостьСНДСОборот': '-12.00', 'КоличествоОборот': '-2.000', 'КоличествоЕдиницОтчетов': '-4.000', 'КоличествоБазовыхЕд': '-5.000', 'СуммаСкидки': '-5.00', 'ПроцентСкидки': '33.33', 'СтоимостьБезСкидокОборот': '-15.00' }
export function salesResponse(measures: SalesMeasure[] = salesDefaults as SalesMeasure[]): SalesResult {
  const values = Object.fromEntries(measures.map(m => [m, allValues[m]])) as SalesValues
  return { Version: 1, World: 'fenix', SourceId: SALES_SOURCE, DefinitionSha256: SALES_DEFINITION, From: '2026-09-10', Through: '2026-09-12',
    Counterparties: [], Products: [], Projects: [], Divisions: [], Measures: measures, Available: true, Code: 'original_sales_complete', NormalInputsComplete: true, OurSnapshotVerified: true,
    InputWitnessSha256: 'a'.repeat(64), ResultSha256: 'b'.repeat(64), Rows: [{ Counterparty: salesParty, Caption: 'Наш контрагент', CaptionAvailable: true, Values: { ...values },
      Products: [{ Product: salesProduct, Caption: 'Наш товар', CaptionAvailable: true, Values: { ...values } }] }], Totals: { ...values },
    Choices: { 'Контрагент': [{ Key: salesParty, Caption: 'Наш контрагент' }], 'Номенклатура': [{ Key: salesProduct, Caption: 'Наш товар' }], 'Проект': [{ Key: salesProject, Caption: 'Наш проєкт' }], 'Подразделение': [{ Key: salesDivision, Caption: 'Наш підрозділ' }] },
    MissingCaptionMappings: [], Dependency: null, MoneyPolicy: salesCapability.MoneyPolicy, DatePolicy: salesCapability.DatePolicy, AppliesFxConversion: false, ManagementCurrencyPresentationVerified: false, BaseUnitPresentationVerified: false, SourceParityVerified: false, OriginalFullTaskAccepted: false }
}
export function emptySales(): SalesResult {
  const r = salesResponse(), zero = { 'СтоимостьСНДСОборот': '0.00', 'КоличествоБазовыхЕд': '0.000' }
  return { ...r, Rows: [], Totals: zero, Choices: { 'Контрагент': [], 'Номенклатура': [], 'Проект': [], 'Подразделение': [] } }
}
export function missingSales(): SalesResult {
  return { ...emptySales(), Available: false, NormalInputsComplete: false, Code: 'original_sales_selected_product_roles_incomplete', Totals: null, InputWitnessSha256: null, ResultSha256: null,
    Dependency: { Kind: 'SelectedSalesProductRolesV1', MissingMonth: null, ProductKeys: [salesProduct], MissingKeyCount: 1, HasMoreKeys: false } }
}
