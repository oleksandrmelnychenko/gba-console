import { INVENTORY_TURNOVER_BASIS, INVENTORY_TURNOVER_CATALOGUE_SOURCE, INVENTORY_TURNOVER_COLUMNS, INVENTORY_TURNOVER_NAME,
  INVENTORY_TURNOVER_UNITS, inventoryTurnoverWindows, type InventoryTurnoverCapabilities, type InventoryTurnoverCell,
  type InventoryTurnoverInput, type InventoryTurnoverReport } from './inventoryTurnover'
import type { ReportCatalogueEntry } from '../types'

export const INVENTORY_TURNOVER_TEST_CALLER = '11111111-1111-1111-1111-111111111111'
export function inventoryTurnoverCapability(): InventoryTurnoverCapabilities {
  return { ...INVENTORY_TURNOVER_BASIS, Version: 1,
    SourceIdentity: { ...INVENTORY_TURNOVER_CATALOGUE_SOURCE, DefinitionSha256: 'd117a65fde896946b03fe2d6d271586fb662bae7db721fc8962aafe7fdeb8759' },
    ReportName: INVENTORY_TURNOVER_NAME, ScopeKind: 'CurrentGbaMonthAndPreviousMonth', Periodicity: 'Month', Grouping: 'Scalar', Filters: ['Month'],
    Columns: INVENTORY_TURNOVER_COLUMNS.map(column => ({ ...column })), ResourceUnits: INVENTORY_TURNOVER_UNITS.map(unit => ({ ...unit })),
    RuntimeImplemented: true, RequiresCompleteNormalPublications: true, InputAvailability: 'CheckedByPreview' }
}
function numericInput(): InventoryTurnoverInput { return { Complete: true, CoverageComplete: true, ScalarDefined: true, IncludedRows: 1, Code: 'available' } }
function missingInput(): InventoryTurnoverInput { return { Complete: false, CoverageComplete: false, ScalarDefined: false, IncludedRows: null, Code: 'inventory_relation_incomplete' } }
function emptyInput(): InventoryTurnoverInput { return { ...numericInput(), IncludedRows: 0, Code: 'complete_empty' } }
function number(cell: InventoryTurnoverCell, value: string, numerator = value, denominator = '1', percentage = false): InventoryTurnoverCell {
  return { ...cell, Value: value, Available: true, ExactValue: { Numerator: numerator, Denominator: denominator }, FormattedValue: percentage ? `${value}.00` : value }
}
function unavailable(cell: InventoryTurnoverCell): InventoryTurnoverCell { return { ...cell, Available: false, Value: null, FormattedValue: null, ExactValue: null } }
function sourceNull(cell: InventoryTurnoverCell): InventoryTurnoverCell { return { ...unavailable(cell), Available: true } }
export function inventoryTurnoverReport(): InventoryTurnoverReport {
  const capability = inventoryTurnoverCapability(), values = ['0.25', '0.2', '25', '0.05'], n = ['1', '1', '25', '1'], d = ['4', '5', '1', '20']
  return { ...INVENTORY_TURNOVER_BASIS, Version: capability.Version, SourceIdentity: { ...capability.SourceIdentity }, Month: '2026-09',
    ...inventoryTurnoverWindows('2026-09'), Columns: capability.Columns, ResourceUnits: capability.ResourceUnits, PresentationBasis: 'CurrentGbaClrDecimal',
    Cells: capability.Columns.map((column, index) => ({ Key: column.Key, Value: values[index], Available: true,
      ExactValue: { Numerator: n[index], Denominator: d[index] }, FormattedValue: index === 2 ? '25.00' : values[index] })),
    Inputs: { Current: numericInput(), Previous: numericInput() }, Complete: true, HasRows: true, Code: 'available', AvailabilityMessage: null,
    Proof: { InputWitnessSha256: 'b'.repeat(64), SnapshotVerified: true, CurrentCompletePublication: true, PreviousCompletePublication: true,
      ComparisonIdentityStatus: 'Compatible', ComparisonSourceIdentityCompatible: true },
    ObservationStartedAtUtc: '2026-10-02T01:02:03.0000000Z', ObservationCompletedAtUtc: '2026-10-02T01:02:04.0000000Z',
    RequestSha256: 'f'.repeat(64), ResultSha256: '0'.repeat(64), DocumentURL: '/reports/inventory.xlsx', PdfDocumentURL: '/reports/inventory.pdf' }
}
export function inventoryTurnoverZeroReport(): InventoryTurnoverReport {
  const r = inventoryTurnoverReport(), values = ['0', '0', '100', '0']
  return { ...r, Cells: r.Cells.map((cell, i) => number(cell, values[i], values[i], '1', i === 2)) }
}
export function inventoryTurnoverEmptyReport(): InventoryTurnoverReport {
  const r = inventoryTurnoverZeroReport()
  return { ...r, Inputs: { Current: emptyInput(), Previous: emptyInput() }, HasRows: false, Code: 'complete_empty',
    AvailabilityMessage: 'За обрані періоди даних немає.', Cells: r.Cells.map((cell, i) => i < 2 ? sourceNull(cell) : cell) }
}
export function inventoryTurnoverMissingReport(): InventoryTurnoverReport {
  const r = inventoryTurnoverReport()
  return { ...r, Complete: false, HasRows: false, Code: 'inventory_input_unavailable',
    AvailabilityMessage: 'Дані синку ще не готові для формування повного звіту.', Inputs: { Current: missingInput(), Previous: missingInput() },
    Cells: r.Cells.map(unavailable), Proof: { ...r.Proof, CurrentCompletePublication: false, PreviousCompletePublication: false,
      ComparisonIdentityStatus: 'Unverified', ComparisonSourceIdentityCompatible: false } }
}
export function inventoryTurnoverMissingCurrentReport(previousZero = false): InventoryTurnoverReport {
  const r = inventoryTurnoverReport(), base = inventoryTurnoverMissingReport()
  return { ...base, HasRows: true, Inputs: { Current: missingInput(), Previous: numericInput() },
    Cells: r.Cells.map((cell, i) => i === 1 ? previousZero ? number(cell, '0') : cell
      : i === 2 && previousZero ? number(cell, '100', '100', '1', true) : unavailable(cell)),
    Proof: { ...base.Proof, PreviousCompletePublication: true } }
}
export function inventoryTurnoverMissingCurrentNullPreviousReport(): InventoryTurnoverReport {
  const r = inventoryTurnoverMissingCurrentReport(true)
  return { ...r, HasRows: false, Inputs: { ...r.Inputs, Previous: emptyInput() },
    Cells: r.Cells.map((cell, i) => i === 1 ? sourceNull(cell) : cell) }
}
export function inventoryTurnoverUndefinedReport(): InventoryTurnoverReport {
  const r = inventoryTurnoverReport()
  return { ...r, Code: 'average_balance_zero', AvailabilityMessage: 'Для окремих показників значення не визначене або перевищує допустимий діапазон.',
    Inputs: { ...r.Inputs, Current: { ...numericInput(), ScalarDefined: false, Code: 'average_balance_zero' } },
    Cells: r.Cells.map((cell, i) => i === 1 ? cell : unavailable(cell)) }
}
export function inventoryTurnoverConflictReport(previousZero = false): InventoryTurnoverReport {
  const r = inventoryTurnoverReport()
  return { ...r, Code: 'asset_source_identity_conflict_between_periods',
    AvailabilityMessage: 'Порівняння обраних періодів ще не готове через відмінність даних синку.',
    Cells: r.Cells.map((cell, i) => i > 1 ? unavailable(cell) : i === 1 && previousZero ? number(cell, '0') : cell),
    Proof: { ...r.Proof, ComparisonIdentityStatus: 'Conflict', ComparisonSourceIdentityCompatible: false } }
}
export function inventoryTurnoverCatalogueEntry(): ReportCatalogueEntry {
  return { Id: `custom:fenix:${INVENTORY_TURNOVER_CATALOGUE_SOURCE.SourceId}`, Name: INVENTORY_TURNOVER_NAME, Title: INVENTORY_TURNOVER_NAME, Kind: 'indicator',
    Sources: [{ ...INVENTORY_TURNOVER_CATALOGUE_SOURCE, DefinitionSha256: null, Attributes: [] }] }
}
