import { CLIENT_REPORT_DEFINITION, CLIENT_REPORT_SOURCE, clientFields, clientMeasures, emptyClientSelection, type ClientCapability, type ClientResult, type ClientRow, type ClientValues } from '../data/originalClientReport'
import { PLANNED_FLOW_DEFINITION, PLANNED_FLOW_SOURCE, plannedFlowDefaults, plannedFlowMeasures, type PlannedFlowCapability, type PlannedFlowResult } from '../data/originalPlannedCashFlow'

export const flowCapability: PlannedFlowCapability = { World: 'fenix', SourceId: PLANNED_FLOW_SOURCE, DefinitionSha256: PLANNED_FLOW_DEFINITION,
  ModuleSha256: 'a412b81d5055763fb2b66638485e9437b6e39d25f071c057c897f27fa6798b50', QuerySha256: '8264b082c5b33081f258e04d5a8fbe507d35fb5a81d9d19add2c12c58b0ae6c6',
  Implemented: true, CurrentDataReadinessVerified: false, DefaultRows: ['СтатьяДвиженияДенежныхСредств'], DefaultColumns: [], Measures: [...plannedFlowMeasures], DefaultMeasures: [...plannedFlowDefaults],
  FilterFields: ['Сценарий', 'Проект', 'Подразделение'], HumanChoicesAvailable: false, SavedVariantsAvailable: false, NativeVirtualTableVerified: false,
  NativeHierarchyAndPeriodicityVerified: false, SourceParityVerified: false, AppliesFxConversion: false, OriginalFullTaskAccepted: false }
export const clientCapability: ClientCapability = { Version: 1, World: 'fenix', SourceId: CLIENT_REPORT_SOURCE, DefinitionSha256: CLIENT_REPORT_DEFINITION,
  ModuleSha256: '805274e8127587045902233f9478502fbef080a66b66313861ed48b48dd29d46', QuerySha256: '5d4d2d0965a86f558061510fdcdae7df9842b5e80b4d948b977eebec226c563f',
  Executable: true, DefaultLayoutOnly: true, RequiresCompleteNormalInputs: true, RequiresAllParentSourceIdentities: true, DefaultRows: [...clientFields], Filters: [...clientFields], DefaultMeasures: [...clientMeasures],
  MoneyPolicy: 'SignedStoredManagementNetAndPaymentsNoVatAdditionOrFx', DatePolicy: 'DeclaredInclusiveBusinessDaysThroughLastWholeSecond', ZeroRowPolicy: 'RetainedNormalContributionsNativeVirtualZeroSuppressionUnverified',
  OptionalReportUnitResourcesImplemented: false, NativeDateParametersVerified: false, NativeVirtualZeroSuppressionVerified: false, SourceParityVerified: false, OriginalFullTaskAccepted: false }
export const clientOrg = '1'.repeat(32), clientParty = '2'.repeat(32), clientAgreement = '3'.repeat(32)
export function flowResult(): PlannedFlowResult {
  const values = { СуммаПриходВал: '-2.00', СуммаРасходВал: '3.00', ДенежныйПотокВал: '-5.00', СуммаПриходУпр: '4.00', СуммаРасходУпр: '-1.00', ДенежныйПотокУпр: '5.00' }
  return { Version: 1, World: 'fenix', SourceId: PLANNED_FLOW_SOURCE, DefinitionSha256: PLANNED_FLOW_DEFINITION, From: '2026-10-01', Through: '2026-10-04',
    Scenarios: [], Projects: [], Departments: [], Measures: [...plannedFlowDefaults], Grouping: ['СтатьяДвиженияДенежныхСредств'], Available: true, Code: 'available', NormalInputsComplete: true,
    OurSnapshotVerified: true, InputWitnessSha256: 'a'.repeat(64), ResultSha256: 'b'.repeat(64), Rows: [{ ArticleReference: 'A'.repeat(32), Caption: 'Операційний план', Values: values }],
    Totals: { ...values }, AppliesFxConversion: false, SourceParityVerified: false, OriginalFullTaskAccepted: false }
}
export function missingFlow(): PlannedFlowResult {
  return { ...flowResult(), Available: false, Code: 'planned_cash_flow_department_unobserved', NormalInputsComplete: false, Rows: [], Totals: null, InputWitnessSha256: null, ResultSha256: null }
}
export function clientValues(): ClientValues {
  return { СуммаНачальныйДолг: '10.00', СуммаОплаченоДеб: '-2.00', СуммаПриход: '3.00', СуммаРасход: '-4.00', КоличествоПриход: '-2.500', ЦенаПриход: '0.00',
    СуммаОплаченоКред: '5.00', КоличествоРасход: '1.250', ЦенаРасход: '0.00', СуммаКонечныйДолг: '6.00' }
}
export function clientResult(): ClientResult {
  const names = ['Наша організація', 'Наш клієнт', 'Наш договір'], keys = [clientOrg, clientParty, clientAgreement]
  let child: ClientRow[] = []
  for (let depth = 2; depth >= 0; depth--) child = [{ Field: clientFields[depth], Key: keys[depth], Caption: names[depth], CaptionAvailable: true, Values: clientValues(), Children: child }]
  return { Version: 1, World: 'fenix', SourceId: CLIENT_REPORT_SOURCE, DefinitionSha256: CLIENT_REPORT_DEFINITION, From: '2026-10-01', Through: '2026-10-04', Selectors: emptyClientSelection(),
    Available: true, Code: 'original_client_report_declared_calendar_complete', NormalInputsComplete: true, OurSnapshotVerified: true, InputWitnessSha256: 'c'.repeat(64), ResultSha256: 'd'.repeat(64), Rows: child, Totals: clientValues(),
    Choices: Object.fromEntries(clientFields.map((field, depth) => [field, [{ Key: keys[depth], Caption: names[depth], CaptionAvailable: true }]])), MissingMonth: null,
    MoneyPolicy: clientCapability.MoneyPolicy, ZeroRowPolicy: clientCapability.ZeroRowPolicy, NativeDateParametersVerified: false, NativeVirtualZeroSuppressionVerified: false, SourceParityVerified: false, OriginalFullTaskAccepted: false }
}
export function missingClient(): ClientResult {
  return { ...clientResult(), Available: false, Code: 'original_client_report_debt_movement_source_generation_unavailable', NormalInputsComplete: false,
    Rows: [], Totals: null, Choices: {}, InputWitnessSha256: null, ResultSha256: null, MissingMonth: '2026-10' }
}
