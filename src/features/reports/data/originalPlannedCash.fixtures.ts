import { plannedDefinitions, plannedDefaultRows, plannedFields, plannedFilterFields, plannedMeasures, type PlannedCapability, type PlannedVariant, type OriginalPlannedResult } from './originalPlannedCash'
export function plannedCapabilityFixture(variant: PlannedVariant = 'receipts'): PlannedCapability {
  const definition = plannedDefinitions[variant]
  return { Version: 1, World: 'fenix', Variant: variant, SourceId: definition.source, DefinitionSha256: definition.definition, ModuleSha256: definition.module,
    RegisterSourceId: definition.register, RegisterConfigSha256: definition.config, CommonBuilderModuleSha256: 'c34895f1904a5af9fb80223ba12ef5dd8c9fc422ff5ed6caee7d73529a531a17',
    Executable: true, PeriodRequired: true, MaximumInclusiveDays: 366, RequiresCompleteNormalInputs: true, DefaultRows: [...plannedDefaultRows], SelectableRows: [...plannedFields], FilterFields: [...plannedFilterFields],
    DefaultMeasures: [...plannedMeasures], PeriodPolicy: 'InclusiveCalendarWholeSeconds', MoneyUnitPolicy: 'NativeStoredResourcesNoCurrencyIdentityAssumption', AppliesFxConversion: false,
    NativeVirtualTableVerified: false, SourceParityVerified: false, OriginalFullTaskAccepted: false }
}
export function plannedResultFixture(variant: PlannedVariant = 'receipts'): OriginalPlannedResult {
  const definition = plannedDefinitions[variant], measure = { Opening: '-900719925474099300.01', Incoming: '7.03', Outgoing: '-2.01', Closing: '-900719925474099290.97' }
  const resources = { Settlement: measure, Management: measure, Cash: measure }, key = { Field: 'Counterparty' as const, Type: null, Table: null, Reference: 'A'.repeat(32), Caption: 'Наш контрагент' }
  return { Version: 1, World: 'fenix', Variant: variant, SourceId: definition.source, DefinitionSha256: definition.definition, From: '2026-09-01', Through: '2026-09-30', Grouping: ['Counterparty'], Filters: [],
    Available: true, Code: 'original_planned_cash_OUR_complete', NormalInputsComplete: true, OurSnapshotVerified: true, InputWitnessSha256: 'a'.repeat(64), ResultSha256: 'b'.repeat(64),
    Rows: [{ Key: [key], ...resources }], Totals: resources, Choices: [key], MissingCaptionMappings: ['FormOfPayment', 'CashCurrency', 'BankAccountCash', 'Responsible', 'Department', 'Project'],
    OriginalDefaultDocumentFieldsAvailable: false, OperationalHeaderWitnessSha256: null, MoneyUnitPolicy: 'NativeStoredResourcesNoCurrencyIdentityAssumption', AppliesFxConversion: false,
    NativeVirtualTableVerified: false, SourceParityVerified: false, OriginalFullTaskAccepted: false }
}
