import { cashDefaultMeasures, cashDefinition, cashFields, cashTurnoverMeasures, type CashCapability, type CashChoice, type CashResult } from './originalCashStatement'
export function cashCapabilityFixture(): CashCapability {
  return { Version: 1, World: 'fenix', SourceId: cashDefinition.source, DefinitionSha256: cashDefinition.definition, ModuleSha256: cashDefinition.module,
    CommonBuilderModuleSha256: 'c34895f1904a5af9fb80223ba12ef5dd8c9fc422ff5ed6caee7d73529a531a17', Executable: true, DefaultRow: 'BankAccountCash',
    FilterFields: [...cashFields], DefaultMeasures: [...cashDefaultMeasures], TurnoverMeasures: [...cashTurnoverMeasures], RequiresCompleteNormalInputs: true,
    PeriodPolicy: 'InclusiveCalendarWholeSeconds', MoneyUnitPolicy: 'NativeStoredOwnAndManagementResourcesNoFx', AppliesFxConversion: false, NativeVirtualTableVerified: false,
    SourceParityVerified: false, OriginalFullTaskAccepted: false }
}
export function cashChoicesFixture(): CashChoice[] {
  return [{ Value: { Field: 'BankAccountCash', Type: '08', Table: '0000000F', Reference: 'B'.repeat(32) }, Caption: 'Наш рахунок', WitnessSha256: 'a'.repeat(64) },
    { Value: { Field: 'CashKind', Type: null, Table: null, Reference: 'A'.repeat(32) }, Caption: 'Наличные', WitnessSha256: 'b'.repeat(64) },
    { Value: { Field: 'CashCurrency', Type: null, Table: null, Reference: 'E'.repeat(32) }, Caption: 'Злотий', WitnessSha256: 'a'.repeat(64) },
    { Value: { Field: 'Organization', Type: null, Table: null, Reference: 'C'.repeat(32) }, Caption: 'Наша організація', WitnessSha256: 'a'.repeat(64) }]
}
export function cashResultFixture(): CashResult {
  const own = { Opening: '9007199254740992.98', Incoming: '-3.02', Outgoing: '-1.01', Closing: '9007199254740990.97', Turnover: '-2.01' },
    management = { Opening: '-8.00', Incoming: '2.04', Outgoing: '-0.02', Closing: '-5.94', Turnover: '2.06' }, amounts = { Own: own, Management: management }
  return { Version: 1, World: 'fenix', SourceId: cashDefinition.source, DefinitionSha256: cashDefinition.definition, From: '2026-09-01', Through: '2026-09-30', Filters: [], IncludeTurnover: false,
    Available: true, Code: 'original_cash_statement_OUR_complete', NormalInputsComplete: true, OurSnapshotVerified: true, InputWitnessSha256: 'c'.repeat(64), ResultSha256: 'd'.repeat(64),
    Rows: [{ Account: { Type: '08', Table: '0000000F', Reference: 'B'.repeat(32) }, Caption: 'Наш рахунок', Amounts: amounts }], Totals: amounts,
    Choices: cashChoicesFixture(), MissingCaptionMappings: [], CurrencyAttributeScopeComplete: true, MoneyUnitPolicy: 'NativeStoredOwnAndManagementResourcesNoFx', AppliesFxConversion: false,
    NativeVirtualTableVerified: false, SourceParityVerified: false, OriginalFullTaskAccepted: false }
}
