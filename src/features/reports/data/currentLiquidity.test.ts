import { expect, it } from 'vitest'
import { createCurrentLiquidityRequest, currentLiquidityCatalogueMatches, currentLiquidityDefaultEndpoints, currentLiquidityEndpointError,
  isCurrentLiquidityCapabilities, isCurrentLiquidityCatalogueEntry, normalizeCurrentLiquidityReport } from './currentLiquidity'
import { currentLiquidityCapability, currentLiquidityCatalogueEntry, currentLiquidityConflictReport, currentLiquidityEmptyReport,
  currentLiquidityMissingCurrentNullPreviousReport, currentLiquidityMissingCurrentReport, currentLiquidityMissingReport,
  currentLiquidityOverflowReport, currentLiquidityReport, currentLiquidityStatusUnknownReport, currentLiquidityZeroReport } from './currentLiquidity.test-fixtures'
const command = () => createCurrentLiquidityRequest(currentLiquidityCapability(), '2026-10-01', '2026-09-01')
it('copies the genuine capability version and opaque definition and sends only the two explicit endpoint filters', () => {
  const capability = currentLiquidityCapability(); capability.SourceIdentity.DefinitionSha256 = 'e'.repeat(64)
  const request = createCurrentLiquidityRequest(capability, '2026-10-01', '2026-08-01')
  expect(isCurrentLiquidityCapabilities(capability)).toBe(true); expect(request.SourceIdentity).toEqual(capability.SourceIdentity)
  expect(request.SourceIdentity).not.toBe(capability.SourceIdentity); capability.SourceIdentity.DefinitionSha256 = 'a'.repeat(64)
  expect(request.SourceIdentity.DefinitionSha256).toBe('e'.repeat(64)); expect(Object.keys(request)).toEqual(['Version', 'SourceIdentity', 'CurrentEndpoint', 'PreviousEndpoint'])
})
it('selects catalogue identity rather than a matching title and requires a retained definition when supplied', () => {
  const entry = currentLiquidityCatalogueEntry(), capability = currentLiquidityCapability()
  expect(isCurrentLiquidityCatalogueEntry(entry)).toBe(true); expect(currentLiquidityCatalogueMatches(entry, capability)).toBe(true)
  entry.Sources[0].DefinitionSha256 = 'a'.repeat(64); expect(currentLiquidityCatalogueMatches(entry, capability)).toBe(false)
  entry.Sources[0].DefinitionSha256 = capability.SourceIdentity.DefinitionSha256; expect(currentLiquidityCatalogueMatches(entry, capability)).toBe(true)
  entry.Sources.push({ ...entry.Sources[0] }); expect(isCurrentLiquidityCatalogueEntry(entry)).toBe(false)
})
it('keeps exact original comparison captions, six declared units and four server strings with no currency or scaling substitution', () => {
  const report = currentLiquidityReport(); expect(normalizeCurrentLiquidityReport(report, command())).toBe(report)
  expect(report.Columns.map(column => column.Caption)).toEqual(['Текущее значение', 'Значение предыдущего периода', 'Изменение %', 'Изменение (абс)'])
  expect(report.Cells.map(cell => cell.FormattedValue)).toEqual(['2.5', '2', '25.00', '0.5'])
  expect(report.ResourceUnits.map(unit => unit.SourceUnitAnnotation)).toEqual(['(Упр)', '(Упр)', '(Упр)', '(грн)', '(Упр)', '(Упр)'])
  expect(report.SourceParityVerified).toBe(false); expect(report.AppliesFxConversion).toBe(false)
})
it('chooses explicit local GBA first-of-month defaults across a year edge and accepts nonadjacent ordered endpoints', () => {
  expect(currentLiquidityDefaultEndpoints('2026-01-31')).toEqual({ CurrentEndpoint: '2026-01-01', PreviousEndpoint: '2025-12-01' })
  expect(currentLiquidityEndpointError('3998-12-01', '0001-02-01')).toBeNull()
  expect(currentLiquidityEndpointError('2026-10-01', '2026-07-01')).toBeNull()
})
it.each([['2026-10-02','2026-09-01'],['2026-10-01','2026-09-02'],['2026-1-01','2025-12-01'],['2026-13-01','2026-09-01'],
  ['2026-10-01','2026-10-01'],['2026-10-01','2026-11-01'],['3999-01-01','2026-09-01'],['2026-10-01','0001-01-01'],
  ['2026-10-01T00:00:00','2026-09-01'],[' 2026-10-01','2026-09-01'],['','2026-09-01']])('rejects unsupported local endpoint pair %s / %s before HTTP', (current, previous) => {
  expect(currentLiquidityEndpointError(current, previous)).not.toBeNull(); expect(() => createCurrentLiquidityRequest(currentLiquidityCapability(), current, previous)).toThrow()
})
it.each(['empty','zero','missing','status','overflow'])('preserves genuine %s availability without making an unknown amount zero', kind => {
  const report = kind === 'empty' ? currentLiquidityEmptyReport() : kind === 'zero' ? currentLiquidityZeroReport() : kind === 'missing' ? currentLiquidityMissingReport()
    : kind === 'status' ? currentLiquidityStatusUnknownReport() : currentLiquidityOverflowReport()
  expect(normalizeCurrentLiquidityReport(report, command())).toBe(report)
  if (kind === 'empty') expect(report.Cells.map(cell => cell.Value)).toEqual([null, null, '100', '0'])
  if (kind === 'status') { expect(report.Proof.Current.CompletePublication).toBe(true); expect(report.Inputs.Current.CoverageComplete).toBe(true); expect(report.Inputs.Current.IncludedUnionRows).toBeNull() }
})
it.each(['number','zero','null'])('admits an independent previous %s beside unavailable current input', kind => {
  const report = kind === 'null' ? currentLiquidityMissingCurrentNullPreviousReport() : currentLiquidityMissingCurrentReport(kind === 'zero')
  expect(normalizeCurrentLiquidityReport(report, command())).toBe(report)
  expect(report.Cells[0].Available).toBe(false); expect(report.Cells[1].Available).toBe(true)
  expect(report.Cells[2].FormattedValue).toBe(kind === 'number' ? null : '100.00'); expect(report.Cells[3].Available).toBe(false)
})
it.each([false,true])('keeps independent endpoint values but masks proven cross-endpoint identity conflicts with previous zero=%s', previousZero => {
  const report = currentLiquidityConflictReport(previousZero); expect(normalizeCurrentLiquidityReport(report, command())).toBe(report)
  expect(report.Cells.slice(2).every(cell => !cell.Available && cell.ExactValue === null)).toBe(true)
  expect(report.Cells[1].Value).toBe(previousZero ? '0' : '2')
})
it('admits a confirmed NULL scalar on nonempty input while retaining the server absolute and percentage cells', () => {
  const report = currentLiquidityReport()
  report.Cells[0] = { ...report.Cells[0], Value: null, FormattedValue: null, ExactValue: null }
  report.Cells[2] = { ...report.Cells[2], Value: '-100', FormattedValue: '-100.00', ExactValue: { Numerator: '-100', Denominator: '1' } }
  report.Cells[3] = { ...report.Cells[3], Value: '-2', FormattedValue: '-2', ExactValue: { Numerator: '-2', Denominator: '1' } }
  expect(normalizeCurrentLiquidityReport(report, command())).toBe(report)
})
it.each(['identity','version','current','previous','column','unit','fx','parity','coverage','count','complete','has_rows','witness','snapshot',
  'compatibility','unverified','conflict','clock','utc','file','fraction','format','notice','relation_order','opening','months','settlement'])('rejects inconsistent %s before displaying values or links', fault => {
  const report = currentLiquidityReport()
  if (fault === 'identity') report.SourceIdentity.DefinitionSha256 = 'e'.repeat(64)
  else if (fault === 'version') Reflect.set(report,'Version',2)
  else if (fault === 'current') report.CurrentEndpoint = '2026-11-01'
  else if (fault === 'previous') report.PreviousEndpoint = '2026-08-01'
  else if (fault === 'column') report.Columns.reverse()
  else if (fault === 'unit') Reflect.set(report.ResourceUnits[0],'SourceUnitAnnotation','EUR')
  else if (fault === 'fx') Reflect.set(report,'AppliesFxConversion',true)
  else if (fault === 'parity') Reflect.set(report,'SourceParityVerified',true)
  else if (fault === 'coverage') report.Proof.Current.CompletePublication = false
  else if (fault === 'count') report.Inputs.Current.IncludedUnionRows = -1
  else if (fault === 'complete') report.Complete = false
  else if (fault === 'has_rows') report.HasRows = false
  else if (fault === 'witness') report.Proof.InputWitnessSha256 = 'wrong'
  else if (fault === 'snapshot') Reflect.set(report.Proof,'SnapshotVerified',false)
  else if (fault === 'compatibility') report.Proof.ComparisonSourceIdentityCompatible = false
  else if (fault === 'unverified') report.Proof.ComparisonIdentityStatus = 'Unverified'
  else if (fault === 'conflict') { report.Proof.ComparisonIdentityStatus = 'Conflict'; report.Proof.ComparisonSourceIdentityCompatible = false }
  else if (fault === 'clock') report.ObservationCompletedAtUtc = '2026-10-02T00:02:03.0000000Z'
  else if (fault === 'utc') report.ObservationCompletedAtUtc = '2026-10-02T01:02:04.0000000+03:00'
  else if (fault === 'file') report.DocumentURL = '//foreign.test/file.xlsx'
  else if (fault === 'fraction') report.Cells[0].ExactValue!.Denominator = '0'
  else if (fault === 'format') report.Cells[2].FormattedValue = '25'
  else if (fault === 'notice') report.AvailabilityMessage = 'not expected'
  else if (fault === 'relation_order') report.Proof.Current.Relations.reverse()
  else if (fault === 'opening') report.Proof.Current.Relations[0].DatedOpeningVerified = false
  else if (fault === 'months') report.Proof.Current.Relations[0].CompletedMovementMonths = 121
  else if (fault === 'settlement') report.Proof.Current.SettlementMovementSourceIdentityVerified = true
  expect(() => normalizeCurrentLiquidityReport(report, command())).toThrow('непідтверджений результат')
})
