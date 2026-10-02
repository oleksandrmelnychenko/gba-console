import { CURRENT_LIQUIDITY_BASIS, CURRENT_LIQUIDITY_CATALOGUE_SOURCE, CURRENT_LIQUIDITY_COLUMNS, CURRENT_LIQUIDITY_NAME,
  CURRENT_LIQUIDITY_RELATIONS, CURRENT_LIQUIDITY_UNITS, type CurrentLiquidityCapabilities, type CurrentLiquidityCell,
  type CurrentLiquidityEndpointProof, type CurrentLiquidityInput, type CurrentLiquidityReport } from './currentLiquidity'
import type { ReportCatalogueEntry } from '../types'

export const CURRENT_LIQUIDITY_TEST_CALLER = '11111111-1111-1111-1111-111111111111'
export function currentLiquidityCapability(): CurrentLiquidityCapabilities {
  return { ...CURRENT_LIQUIDITY_BASIS, Version: 1,
    SourceIdentity: { ...CURRENT_LIQUIDITY_CATALOGUE_SOURCE, DefinitionSha256: '19b786791ac37cc15ef8d670c37dda85322a59acdde0ee4e02e9a90ff2a1b773' },
    ReportName: CURRENT_LIQUIDITY_NAME, ScopeKind: 'CurrentGbaBalanceEndpoints', Grouping: 'Scalar', Filters: ['CurrentEndpoint', 'PreviousEndpoint'],
    Columns: CURRENT_LIQUIDITY_COLUMNS.map(column => ({ ...column })), ResourceUnits: CURRENT_LIQUIDITY_UNITS.map(unit => ({ ...unit })),
    RuntimeImplemented: true, RequiresCompleteNormalPublications: true, InputAvailability: 'CheckedByPreview' }
}
function numericInput(): CurrentLiquidityInput { return { Available: true, CoverageComplete: true, IncludedUnionRows: 6, Code: 'available' } }
function missingInput(): CurrentLiquidityInput { return { Available: false, CoverageComplete: false, IncludedUnionRows: null, Code: 'balance_relation_incomplete' } }
function emptyInput(): CurrentLiquidityInput { return { ...numericInput(), IncludedUnionRows: 0, Code: 'complete_empty' } }
function endpointProof(): CurrentLiquidityEndpointProof {
  return { CompletePublication: true, WarehouseStatusMappingAvailable: true, SettlementMovementSourceIdentityVerified: false,
    Relations: CURRENT_LIQUIDITY_RELATIONS.map(Relation => ({ Relation, Available: true, CompletePublication: true, Code: 'available',
      DatedOpeningVerified: true, CompletedMovementMonths: 2 })) }
}
function missingProof(): CurrentLiquidityEndpointProof {
  const proof = endpointProof()
  return { ...proof, CompletePublication: false, WarehouseStatusMappingAvailable: false,
    Relations: proof.Relations.map(relation => ({ ...relation, Available: false, CompletePublication: false, Code: 'opening_missing', DatedOpeningVerified: false, CompletedMovementMonths: 0 })) }
}
function number(cell: CurrentLiquidityCell, value: string, numerator = value, denominator = '1', percentage = false): CurrentLiquidityCell {
  return { ...cell, Value: value, Available: true, ExactValue: { Numerator: numerator, Denominator: denominator }, FormattedValue: percentage ? `${value}.00` : value }
}
function unavailable(cell: CurrentLiquidityCell): CurrentLiquidityCell { return { ...cell, Available: false, Value: null, FormattedValue: null, ExactValue: null } }
function sourceNull(cell: CurrentLiquidityCell): CurrentLiquidityCell { return { ...unavailable(cell), Available: true } }
export function currentLiquidityReport(): CurrentLiquidityReport {
  const capability = currentLiquidityCapability(), values = ['2.5', '2', '25', '0.5'], n = ['5', '2', '25', '1'], d = ['2', '1', '1', '2']
  return { ...CURRENT_LIQUIDITY_BASIS, Version: capability.Version, SourceIdentity: { ...capability.SourceIdentity }, CurrentEndpoint: '2026-10-01', PreviousEndpoint: '2026-09-01',
    Columns: capability.Columns, ResourceUnits: capability.ResourceUnits, PresentationBasis: 'CurrentGbaClrDecimal',
    Cells: capability.Columns.map((column, index) => ({ Key: column.Key, Value: values[index], Available: true,
      ExactValue: { Numerator: n[index], Denominator: d[index] }, FormattedValue: index === 2 ? '25.00' : values[index] })),
    Inputs: { Current: numericInput(), Previous: numericInput() }, Complete: true, HasRows: true, Code: 'available', AvailabilityMessage: null,
    Proof: { InputWitnessSha256: 'b'.repeat(64), SnapshotVerified: true, Current: endpointProof(), Previous: endpointProof(),
      ComparisonIdentityStatus: 'Compatible', ComparisonSourceIdentityCompatible: true },
    ObservationStartedAtUtc: '2026-10-02T01:02:03.0000000Z', ObservationCompletedAtUtc: '2026-10-02T01:02:04.0000000Z',
    RequestSha256: 'f'.repeat(64), ResultSha256: '0'.repeat(64), DocumentURL: '/reports/liquidity.xlsx', PdfDocumentURL: '/reports/liquidity.pdf' }
}
export function currentLiquidityZeroReport(): CurrentLiquidityReport {
  const r = currentLiquidityReport(), values = ['0', '0', '100', '0']
  return { ...r, Cells: r.Cells.map((cell, i) => number(cell, values[i], values[i], '1', i === 2)) }
}
export function currentLiquidityEmptyReport(): CurrentLiquidityReport {
  const r = currentLiquidityZeroReport()
  return { ...r, Inputs: { Current: emptyInput(), Previous: emptyInput() }, HasRows: false, Code: 'complete_empty',
    AvailabilityMessage: 'За обрані періоди даних немає.', Cells: r.Cells.map((cell, i) => i < 2 ? sourceNull(cell) : cell) }
}
export function currentLiquidityMissingReport(): CurrentLiquidityReport {
  const r = currentLiquidityReport()
  return { ...r, Complete: false, HasRows: false, Code: 'balance_input_unavailable',
    AvailabilityMessage: 'Дані синку ще не готові для формування повного звіту.', Inputs: { Current: missingInput(), Previous: missingInput() },
    Cells: r.Cells.map(unavailable), Proof: { ...r.Proof, Current: missingProof(), Previous: missingProof(),
      ComparisonIdentityStatus: 'Unverified', ComparisonSourceIdentityCompatible: false } }
}
export function currentLiquidityMissingCurrentReport(previousZero = false): CurrentLiquidityReport {
  const r = currentLiquidityReport(), base = currentLiquidityMissingReport()
  return { ...base, HasRows: true, Inputs: { Current: missingInput(), Previous: numericInput() },
    Cells: r.Cells.map((cell, i) => i === 1 ? previousZero ? number(cell, '0') : cell
      : i === 2 && previousZero ? number(cell, '100', '100', '1', true) : unavailable(cell)),
    Proof: { ...base.Proof, Previous: endpointProof() } }
}
export function currentLiquidityMissingCurrentNullPreviousReport(): CurrentLiquidityReport {
  const r = currentLiquidityMissingCurrentReport(true)
  return { ...r, HasRows: false, Inputs: { ...r.Inputs, Previous: emptyInput() }, Cells: r.Cells.map((cell, i) => i === 1 ? sourceNull(cell) : cell) }
}
export function currentLiquidityStatusUnknownReport(): CurrentLiquidityReport {
  const r = currentLiquidityMissingCurrentReport()
  return { ...r, Inputs: { ...r.Inputs, Current: { Available: false, CoverageComplete: true, IncludedUnionRows: null, Code: 'warehouse_status_unavailable' } },
    AvailabilityMessage: 'Для частини складських даних ще не визначено статус. Повний показник недоступний.',
    Proof: { ...r.Proof, Current: { ...endpointProof(), WarehouseStatusMappingAvailable: false } } }
}
export function currentLiquidityOverflowReport(): CurrentLiquidityReport {
  const r = currentLiquidityReport()
  return { ...r, Code: 'decimal_projection_unavailable', AvailabilityMessage: 'Для окремих показників значення перевищує допустимий діапазон.',
    Cells: r.Cells.map((cell, i) => i === 1 ? cell : { ...unavailable(cell), ExactValue: { Numerator: '100000000000000000000000000000000000000', Denominator: '1' } }) }
}
export function currentLiquidityConflictReport(previousZero = false): CurrentLiquidityReport {
  const r = currentLiquidityReport()
  return { ...r, Code: 'liquidity_source_identity_conflict_between_endpoints',
    AvailabilityMessage: 'Порівняння обраних періодів ще не готове через відмінність даних синку.',
    Cells: r.Cells.map((cell, i) => i > 1 ? unavailable(cell) : i === 1 && previousZero ? number(cell, '0') : cell),
    Proof: { ...r.Proof, ComparisonIdentityStatus: 'Conflict', ComparisonSourceIdentityCompatible: false } }
}
export function currentLiquidityCatalogueEntry(): ReportCatalogueEntry {
  return { Id: `custom:fenix:${CURRENT_LIQUIDITY_CATALOGUE_SOURCE.SourceId}`, Name: CURRENT_LIQUIDITY_NAME, Title: CURRENT_LIQUIDITY_NAME, Kind: 'indicator',
    Sources: [{ ...CURRENT_LIQUIDITY_CATALOGUE_SOURCE, DefinitionSha256: null, Attributes: [] }] }
}
