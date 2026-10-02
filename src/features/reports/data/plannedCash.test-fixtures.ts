import { PLANNED_CASH_FORMS, PLANNED_CASH_UNITS, plannedCashColumns, type PlannedCashCapabilities, type PlannedCashCell,
  type PlannedCashFilters, type PlannedCashKind, type PlannedCashReport, type PlannedCashRequest, type PlannedCashRelationProof } from './plannedCash'
import type { ReportCatalogueEntry } from '../types'
export const PLANNED_CASH_TEST_CALLER = '11111111-1111-1111-1111-111111111111'
export const plannedCashKinds = Object.keys(PLANNED_CASH_FORMS) as PlannedCashKind[]
export const plannedCashCalendarKinds = ['CalendarPayouts', 'NetFlow', 'CalendarReceipts'] as const
export const plannedCashDdsKinds = ['DdsPayouts', 'DdsReceipts'] as const
export function plannedCashCapability(kind: PlannedCashKind = 'CalendarPayouts'): PlannedCashCapabilities {
  const f = PLANNED_CASH_FORMS[kind]
  return { Version: 1, SourceIdentity: { World: 'fenix', SourceId: f.SourceId, DefinitionSha256: 'a'.repeat(64) }, Kind: kind, ReportName: f.ReportName,
    Grouping: f.Grouping, ScopeKind: 'ExplicitCurrentOurIntervalsAndPlan', Filters: f.Scenario ? ['CurrentPeriod', 'PreviousPeriod', 'Scenario'] : ['CurrentPeriod', 'PlanEndpoint'],
    Columns: plannedCashColumns(kind), ResourceUnits: PLANNED_CASH_UNITS.map(unit => ({ ...unit })), NativeScenarioParameterName: f.Scenario, NativePlanEndpointParameterName: f.Endpoint,
    SourceEmbeddedPeriodicity: f.Periodicity, InputBasis: 'CurrentOurSyncedCashAndPlans', RuntimeImplemented: true, RequiresCompleteNormalPublications: true,
    InputAvailability: 'CheckedByPreview', RequiresObservedScenario: Boolean(f.Scenario), ScenarioSelectionLabelsAvailable: false, GroupLabelAvailability: 'CheckedByPreview',
    UnsupportedFilters: ['AdditionalSavedFilters', 'AdditionalSavedGrouping', 'AccountCurrencyMeasures', 'DocumentAttributeProjections', 'NativeEffectivePeriodAndHorizon'],
    EffectiveSourcePeriodsVerified: false, SourceParityVerified: false, NativeVirtualTableZeroSuppressionVerified: false, AppliesFxConversion: false, NativeSavedVariantsSupported: false }
}
export function plannedCashFilters(): PlannedCashFilters { return { From: '2026-09-01', ThroughExclusive: '2026-10-01', PreviousFrom: '2026-08-01', PreviousThroughExclusive: '2026-09-01', PlanEndpoint: '2026-10-01' } }
/** Synthetic typed scenario is for decoder contract cases only; the UI supplies no raw-reference editor. */
export function plannedCashTestRequest(kind: PlannedCashKind = 'CalendarPayouts'): PlannedCashRequest {
  const cap = plannedCashCapability(kind), dds = cap.RequiresObservedScenario
  return { Version: 1, SourceIdentity: cap.SourceIdentity, CurrentPeriod: { From: '2026-09-01T00:00:00.000', ThroughExclusive: '2026-10-01T00:00:00.000' },
    PreviousPeriod: dds ? { From: '2026-08-01T00:00:00.000', ThroughExclusive: '2026-09-01T00:00:00.000' } : null,
    PlanEndpoint: dds ? null : '2026-10-01T00:00:00.000', Scenario: dds ? { Type: '08', Table: '0000008A', Value: '1'.repeat(32) } : null }
}
const relation = (): PlannedCashRelationProof => ({ Available: true, CompletePublication: true, DatedOpeningVerified: true, CompletedMovementMonths: 1 })
export function plannedCashReport(kind: PlannedCashKind = 'CalendarPayouts'): PlannedCashReport {
  const cap = plannedCashCapability(kind), req = plannedCashTestRequest(kind), dds = cap.RequiresObservedScenario
  const values = dds ? ['-2', '0', '100', '-2', '10', '-20', '-120', '-12'] : ['-2', '10']
  const cells: PlannedCashCell[] = cap.Columns.map((column, i) => ({ Key: column.Key, Value: values[i], Available: true,
    ExactValue: { Numerator: values[i], Denominator: '1' }, FormattedValue: column.DecimalPlaces === 2 ? `${values[i]}.00` : values[i] }))
  return { Version: 1, SourceIdentity: cap.SourceIdentity, Kind: kind, ReportName: cap.ReportName, Grouping: cap.Grouping,
    CurrentPeriod: req.CurrentPeriod, PreviousPeriod: req.PreviousPeriod, PlanEndpoint: req.PlanEndpoint, ScenarioBindingSha256: dds ? '9'.repeat(64) : null,
    Columns: cap.Columns, Rows: [{ Key: 'c'.repeat(64), GroupIsNull: false, Name: kind === 'DdsReceipts' ? null : 'Підтверджений контрагент', NameAvailable: kind !== 'DdsReceipts', Cells: cells }], Totals: cells.map(cell => ({ ...cell })),
    CurrentAvailable: true, PreviousAvailable: dds ? true : null, PlanAvailable: true, Complete: true, HasRows: true, Code: 'available', AvailabilityMessage: null,
    GroupLabelsAvailabilityMessage: kind === 'DdsReceipts' ? 'Назви частини груп ще не синхронізовані.' : null, InputBasis: cap.InputBasis, PresentationBasis: 'CurrentGbaClrDecimal', ResourceUnits: cap.ResourceUnits,
    EffectiveSourcePeriodsVerified: false, SourceParityVerified: false, NativeVirtualTableZeroSuppressionVerified: false, AppliesFxConversion: false, NativeSavedVariantsSupported: false,
    Proof: { InputWitnessSha256: 'b'.repeat(64), SnapshotVerified: true, Current: relation(), Previous: dds ? relation() : null,
      Scenario: dds ? relation() : null, Receipts: kind === 'NetFlow' || kind === 'CalendarReceipts' ? relation() : null,
      Requests: kind === 'NetFlow' || kind === 'CalendarPayouts' ? relation() : null, LabelWitnessSha256: 'd'.repeat(64), ComparisonCurrencyStatus: dds ? 'Compatible' : 'NotApplicable' },
    ObservationStartedAtUtc: '2026-10-02T01:02:03.0000000Z', ObservationCompletedAtUtc: '2026-10-02T01:02:04.0000000Z',
    RequestSha256: 'e'.repeat(64), ResultSha256: 'f'.repeat(64), DocumentURL: '/reports/planned-cash.xlsx', PdfDocumentURL: '/reports/planned-cash.pdf' }
}
export function plannedCashEmptyReport(kind: PlannedCashKind = 'CalendarPayouts'): PlannedCashReport {
  const r = plannedCashReport(kind)
  return { ...r, Rows: [], Totals: r.Totals.map((cell, i) => ({ ...cell, Value: null, FormattedValue: null, ExactValue: null, Available: r.PreviousAvailable === null || [0, 1, 4].includes(i) })),
    HasRows: false, GroupLabelsAvailabilityMessage: null, Code: 'query_empty', AvailabilityMessage: 'За обрані періоди даних немає.' }
}
export function plannedCashPartialReport(): PlannedCashReport {
  const r = plannedCashReport()
  return { ...r, CurrentAvailable: false, Complete: false, Code: 'planned_cash_input_unavailable', AvailabilityMessage: 'Дані синку ще не готові для формування повного звіту.',
    Proof: { ...r.Proof, Current: { Available: false, CompletePublication: false, DatedOpeningVerified: false, CompletedMovementMonths: 0 } },
    Rows: r.Rows.map(row => ({ ...row, Cells: row.Cells.map((cell, i) => i === 0 ? { ...cell, Available: false, Value: null, FormattedValue: null, ExactValue: null } : cell) })),
    Totals: r.Totals.map((cell, i) => i === 0 ? { ...cell, Available: false, Value: null, FormattedValue: null, ExactValue: null } : cell) }
}
export function plannedCashConflictReport(): PlannedCashReport {
  const r = plannedCashReport('DdsPayouts'), close = (cell: PlannedCashCell, i: number) => i === 2 || i === 3 ? { ...cell, Available: false, Value: null, FormattedValue: null, ExactValue: null } : cell
  return { ...r, Code: 'planned_cash_fact_management_currency_conflict', AvailabilityMessage: 'Зміни між періодами недоступні через відмінність управлінської валюти.',
    Proof: { ...r.Proof, ComparisonCurrencyStatus: 'Conflict' }, Rows: r.Rows.map(row => ({ ...row, Cells: row.Cells.map(close) })), Totals: r.Totals.map(close) }
}
export function plannedCashCatalogueEntry(kind: PlannedCashKind = 'CalendarPayouts'): ReportCatalogueEntry {
  const form = PLANNED_CASH_FORMS[kind]
  return { Id: `custom:fenix:${form.SourceId}`, Name: form.ReportName, Title: form.ReportName, Kind: 'custom', Sources: [{ World: 'fenix', SourceId: form.SourceId, DefinitionSha256: null, Attributes: [] }] }
}
