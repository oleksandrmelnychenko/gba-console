import { CASH_MOVEMENT_COLUMNS, CASH_MOVEMENT_DEFINITIONS, CASH_MOVEMENT_INPUT_BASIS, CASH_MOVEMENT_PRESENTATION_BASIS,
  CASH_MOVEMENT_UNSUPPORTED_FILTERS, cashMovementPeriods, type CashMovementCapabilities, type CashMovementInput,
  type CashMovementKind, type CashMovementReport } from './cashMovement'
import type { ReportCatalogueEntry } from '../types'

export function cashMovementCapability(kind: CashMovementKind = 'receipts'): CashMovementCapabilities {
  const definition = CASH_MOVEMENT_DEFINITIONS[kind]
  return { Version: 1, SourceIdentity: { ...definition.SourceIdentity }, Title: definition.Title, Executable: true,
    Periodicity: definition.Periodicity, Columns: CASH_MOVEMENT_COLUMNS.map(column => ({ ...column })), Filters: [definition.Periodicity],
    UnsupportedFilters: [...CASH_MOVEMENT_UNSUPPORTED_FILTERS], CfoAvailable: false, AccountCurrencyAvailable: false,
    InputBasis: CASH_MOVEMENT_INPUT_BASIS, PresentationBasis: CASH_MOVEMENT_PRESENTATION_BASIS,
    EffectiveSourcePeriodsVerified: false, SourceParityVerified: false }
}
export function cashMovementInput(period: CashMovementReport['CurrentPeriod'], empty = false): CashMovementInput {
  const begin = Number(period.From.slice(0, 4)) * 12 + Number(period.From.slice(5, 7)) - 1
  const end = Number(period.ThroughExclusive.slice(0, 4)) * 12 + Number(period.ThroughExclusive.slice(5, 7)) - 1
  return { Available: true, Code: 'available', Publication: { CompletePublication: true, Code: 'available',
    Months: Array.from({ length: end - begin }, (_, index) => ({
      Month: `${String(Math.floor((begin + index) / 12)).padStart(4, '0')}-${String((begin + index) % 12 + 1).padStart(2, '0')}`,
      RunId: '11111111-2222-3333-4444-555555555555', Available: true,
      PhysicalRows: index === 0 && !empty ? 2 : 0, ActiveRows: index === 0 && !empty ? 1 : 0,
      IncludedRows: index === 0 && !empty ? 1 : 0, Code: 'available',
    })), ManagementCurrency: { Available: true, Code: 'available', SourceCurrencyRRef: 'E'.repeat(32), SourceCurrencyCode: '980', SourceCurrencyMarked: '00',
      Currency: { Id: '1', NetUid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', Code: '980', Name: 'Гривня' } } } }
}
export function cashMovementReport(kind: CashMovementKind = 'receipts', period = kind === 'receipts' ? '2026-Q3' : '2026-09'): CashMovementReport {
  const definition = CASH_MOVEMENT_DEFINITIONS[kind], periods = cashMovementPeriods(kind, period)
  const values = ['4', '3', '33.333333333333333333333333333', '1'], formatted = ['4', '3', '33.33', '1']
  const cells = CASH_MOVEMENT_COLUMNS.map((column, index) => ({ Key: column.Key, Value: values[index], FormattedValue: formatted[index], Available: true }))
  return { Version: 1, SourceIdentity: { ...definition.SourceIdentity }, Period: period, Periodicity: definition.Periodicity, ...periods,
    Columns: CASH_MOVEMENT_COLUMNS.map(column => ({ ...column })), Rows: [{ GroupKey: 'c'.repeat(64), NameAvailable: true, Name: 'Тестовий контрагент', Cells: structuredClone(cells), Complete: true }],
    Totals: cells, Inputs: { Current: cashMovementInput(periods.CurrentPeriod), Previous: cashMovementInput(periods.PreviousPeriod) },
    Complete: true, HasRows: true, Code: 'available', CfoAvailable: false, AccountCurrencyAvailable: false,
    InputBasis: CASH_MOVEMENT_INPUT_BASIS, PresentationBasis: CASH_MOVEMENT_PRESENTATION_BASIS,
    EffectiveSourcePeriodsVerified: false, SourceParityVerified: false,
    ObservationStartedAtUtc: '2026-10-02T01:00:00Z', ObservationCompletedAtUtc: '2026-10-02T01:00:01Z',
    RequestSha256: 'a'.repeat(64), ResultSha256: 'b'.repeat(64), DocumentURL: `/files/${kind}.xlsx`, PdfDocumentURL: `/files/${kind}.pdf` }
}
export function cashMovementEmptyReport(kind: CashMovementKind = 'receipts'): CashMovementReport {
  const report = cashMovementReport(kind)
  return { ...report, Rows: [], Complete: true, HasRows: false, Code: 'query_empty',
    Inputs: { Current: cashMovementInput(report.CurrentPeriod, true), Previous: cashMovementInput(report.PreviousPeriod, true) },
    Totals: report.Totals.map((cell, index) => ({ ...cell, Value: null, FormattedValue: null, Available: index < 2 })) }
}
export function cashMovementIncompleteReport(kind: CashMovementKind = 'receipts'): CashMovementReport {
  const report = cashMovementReport(kind)
  report.Complete = false; report.Code = 'query_input_unavailable'
  report.Inputs.Current.Available = false; report.Inputs.Current.Code = 'period_publication_unavailable'
  report.Inputs.Current.Publication.CompletePublication = false
  report.Inputs.Current.Publication.Months[0] = { ...report.Inputs.Current.Publication.Months[0], RunId: null, Available: false,
    PhysicalRows: 0, ActiveRows: 0, IncludedRows: 0, Code: 'period_publication_unavailable' }
  report.Rows[0].Complete = false
  report.Rows[0].Cells = report.Rows[0].Cells.map((cell, index) => index === 1 ? cell : { ...cell, Value: null, FormattedValue: null, Available: false })
  report.Totals = structuredClone(report.Rows[0].Cells)
  return report
}
export function cashMovementCatalogueEntry(kind: CashMovementKind = 'receipts'): ReportCatalogueEntry {
  const definition = CASH_MOVEMENT_DEFINITIONS[kind]
  return { Id: `custom:fenix:${definition.SourceIdentity.SourceId}`, Name: definition.Title, Title: definition.Title, Kind: 'indicator',
    Sources: [{ World: 'fenix', SourceId: definition.SourceIdentity.SourceId, DefinitionSha256: null, Attributes: [] }] }
}
