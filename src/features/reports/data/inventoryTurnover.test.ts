import { expect, it } from 'vitest'
import { createInventoryTurnoverRequest, inventoryTurnoverCatalogueMatches, inventoryTurnoverMonthError, inventoryTurnoverWindows,
  isInventoryTurnoverCapabilities, isInventoryTurnoverCatalogueEntry, normalizeInventoryTurnoverReport } from './inventoryTurnover'
import { inventoryTurnoverCapability, inventoryTurnoverCatalogueEntry, inventoryTurnoverConflictReport, inventoryTurnoverEmptyReport,
  inventoryTurnoverMissingCurrentNullPreviousReport, inventoryTurnoverMissingCurrentReport, inventoryTurnoverMissingReport,
  inventoryTurnoverReport, inventoryTurnoverUndefinedReport, inventoryTurnoverZeroReport } from './inventoryTurnover.test-fixtures'

it('copies the actual server version and opaque definition binding instead of substituting a baked-in request identity', () => {
  const capability = inventoryTurnoverCapability(); capability.SourceIdentity.DefinitionSha256 = 'e'.repeat(64)
  const request = createInventoryTurnoverRequest(capability, '2026-09')
  expect(isInventoryTurnoverCapabilities(capability)).toBe(true); expect(request.SourceIdentity).toEqual(capability.SourceIdentity)
  expect(request.SourceIdentity).not.toBe(capability.SourceIdentity)
  capability.SourceIdentity.DefinitionSha256 = 'a'.repeat(64)
  expect(request.SourceIdentity.DefinitionSha256).toBe('e'.repeat(64)); expect(Object.keys(request)).toEqual(['Version', 'SourceIdentity', 'Month'])
})
it('matches the original catalogue identity and enforces a retained definition only when the catalogue provides one', () => {
  const entry = inventoryTurnoverCatalogueEntry(), capability = inventoryTurnoverCapability()
  expect(isInventoryTurnoverCatalogueEntry(entry)).toBe(true); expect(inventoryTurnoverCatalogueMatches(entry, capability)).toBe(true)
  entry.Sources[0].DefinitionSha256 = 'a'.repeat(64); expect(inventoryTurnoverCatalogueMatches(entry, capability)).toBe(false)
  entry.Sources[0].DefinitionSha256 = capability.SourceIdentity.DefinitionSha256; expect(inventoryTurnoverCatalogueMatches(entry, capability)).toBe(true)
  entry.Sources.push({ ...entry.Sources[0] }); expect(isInventoryTurnoverCatalogueEntry(entry)).toBe(false)
})
it('keeps original captions and server ratio strings with no days or percent scaling', () => {
  const report = inventoryTurnoverReport(), request = createInventoryTurnoverRequest(inventoryTurnoverCapability(), report.Month)
  expect(normalizeInventoryTurnoverReport(report, request)).toBe(report)
  expect(report.Columns.map(column => column.Caption)).toEqual(['Текущее значение', 'Предыдущее значение', 'Изменение %', 'Изменение (абс)'])
  expect(report.Cells.map(cell => cell.FormattedValue)).toEqual(['0.25', '0.2', '25.00', '0.05'])
  expect(report.ResourceUnits.map(unit => unit.SourceUnitAnnotation)).toEqual(['(Упр)', '(грн)']); expect(report.AppliesFxConversion).toBe(false)
})
it('uses local date-only month/prior windows across year edges and the real server domain', () => {
  expect(inventoryTurnoverWindows('2026-01').PreviousPeriod).toEqual({ From: '2025-12-01', ThroughExclusive: '2026-01-01' })
  expect(inventoryTurnoverWindows('2024-02').CurrentPeriod).toEqual({ From: '2024-02-01', ThroughExclusive: '2024-03-01' })
  expect(inventoryTurnoverWindows('0001-03').PreviousPeriod.From).toBe('0001-02-01')
  expect(inventoryTurnoverWindows('3998-12').CurrentPeriod.ThroughExclusive).toBe('3999-01-01')
})
it.each(['2026-9', '2026-00', '2026-13', '2026-09-01', '2026-09Z', ' 2026-09', '', '0000-02', '0001-01', '0001-02', '3999-01'])('refuses noncanonical or unsupported month %s before generation', month => {
  expect(inventoryTurnoverMonthError(month)).not.toBeNull(); expect(() => createInventoryTurnoverRequest(inventoryTurnoverCapability(), month)).toThrow()
})
it('preserves confirmed empty, numeric zero, missing sync and undefined zero average without manufacturing values', () => {
  const request = createInventoryTurnoverRequest(inventoryTurnoverCapability(), '2026-09')
  for (const report of [inventoryTurnoverEmptyReport(), inventoryTurnoverZeroReport(), inventoryTurnoverMissingReport(), inventoryTurnoverUndefinedReport(),
    inventoryTurnoverMissingCurrentReport(), inventoryTurnoverMissingCurrentReport(true), inventoryTurnoverMissingCurrentNullPreviousReport()])
    expect(normalizeInventoryTurnoverReport(report, request)).toBe(report)
  expect(inventoryTurnoverEmptyReport().Cells.map(cell => cell.Value)).toEqual([null, null, '100', '0'])
  expect(inventoryTurnoverZeroReport().Cells.map(cell => cell.Value)).toEqual(['0', '0', '100', '0'])
  expect(inventoryTurnoverMissingReport().Inputs.Current.IncludedRows).toBeNull()
  expect(inventoryTurnoverUndefinedReport().Complete).toBe(true)
  expect(inventoryTurnoverMissingCurrentReport(true).Cells.map(cell => cell.FormattedValue)).toEqual([null, '0', '100.00', null])
})
it.each([false, true])('keeps independent period scalars but closes proven differing-generation changes even with previous zero=%s', previousZero => {
  const report = inventoryTurnoverConflictReport(previousZero), request = createInventoryTurnoverRequest(inventoryTurnoverCapability(), report.Month)
  expect(normalizeInventoryTurnoverReport(report, request)).toBe(report)
  expect(report.Cells[0].Value).toBe('0.25'); expect(report.Cells[1].Value).toBe(previousZero ? '0' : '0.2')
  expect(report.Cells.slice(2).every(cell => !cell.Available && cell.ExactValue === null)).toBe(true)
})
it('accepts a confirmed NULL numerator on a nonempty observed grain and decimal overflow as distinct server states', () => {
  const report = inventoryTurnoverReport(), request = createInventoryTurnoverRequest(inventoryTurnoverCapability(), report.Month)
  report.Cells[0] = { ...report.Cells[0], Value: null, FormattedValue: null, ExactValue: null }
  report.Cells[2] = { ...report.Cells[2], Value: '-100', FormattedValue: '-100.00', ExactValue: { Numerator: '-100', Denominator: '1' } }
  report.Cells[3] = { ...report.Cells[3], Value: '-0.2', FormattedValue: '-0.2', ExactValue: { Numerator: '-1', Denominator: '5' } }
  expect(normalizeInventoryTurnoverReport(report, request)).toBe(report)
  report.Cells[0] = { ...report.Cells[0], Available: false, ExactValue: { Numerator: '100000000000000000000000000000', Denominator: '1' } }
  report.Code = 'decimal_projection_unavailable'; report.AvailabilityMessage = 'Для окремих показників значення не визначене або перевищує допустимий діапазон.'
  expect(normalizeInventoryTurnoverReport(report, request)).toBe(report)
})
it.each(['identity', 'version', 'period', 'column', 'unit', 'fx', 'parity', 'coverage', 'count', 'complete', 'has_rows', 'witness', 'snapshot',
  'compatibility', 'unverified', 'conflict', 'clock', 'utc', 'file', 'fraction', 'format', 'notice'])('rejects an inconsistent %s response before displaying values or files', fault => {
  const report = inventoryTurnoverReport(), request = createInventoryTurnoverRequest(inventoryTurnoverCapability(), report.Month)
  if (fault === 'identity') report.SourceIdentity.DefinitionSha256 = 'e'.repeat(64)
  else if (fault === 'version') Reflect.set(report, 'Version', 2)
  else if (fault === 'period') report.PreviousPeriod.From = '2026-07-01'
  else if (fault === 'column') report.Columns.reverse()
  else if (fault === 'unit') Reflect.set(report.ResourceUnits[0], 'SourceUnitAnnotation', 'EUR')
  else if (fault === 'fx') Reflect.set(report, 'AppliesFxConversion', true)
  else if (fault === 'parity') Reflect.set(report, 'SourceParityVerified', true)
  else if (fault === 'coverage') report.Proof.CurrentCompletePublication = false
  else if (fault === 'count') report.Inputs.Current.IncludedRows = 200001
  else if (fault === 'complete') report.Complete = false
  else if (fault === 'has_rows') report.HasRows = false
  else if (fault === 'witness') report.Proof.InputWitnessSha256 = 'wrong'
  else if (fault === 'snapshot') Reflect.set(report.Proof, 'SnapshotVerified', false)
  else if (fault === 'compatibility') report.Proof.ComparisonSourceIdentityCompatible = false
  else if (fault === 'unverified') { report.Proof.ComparisonIdentityStatus = 'Unverified'; report.Proof.ComparisonSourceIdentityCompatible = false }
  else if (fault === 'conflict') { report.Proof.ComparisonIdentityStatus = 'Conflict'; report.Proof.ComparisonSourceIdentityCompatible = false }
  else if (fault === 'clock') report.ObservationCompletedAtUtc = '2026-10-02T01:02:02.0000000Z'
  else if (fault === 'utc') report.ObservationStartedAtUtc = '2026-10-02T01:02:03.0000000+00:00'
  else if (fault === 'file') report.DocumentURL = '//untrusted.test/file'
  else if (fault === 'fraction') report.Cells[0].ExactValue!.Denominator = '0'
  else if (fault === 'format') report.Cells[2].FormattedValue = '25'
  else report.AvailabilityMessage = 'Invented warning'
  expect(() => normalizeInventoryTurnoverReport(report, request)).toThrow('непідтверджений результат')
})
it.each(['version', 'filter', 'identity_extension', 'runtime'])('refuses unsupported %s capabilities before issuing a command', fault => {
  const capability = inventoryTurnoverCapability()
  if (fault === 'version') Reflect.set(capability, 'Version', 2)
  else if (fault === 'filter') Reflect.set(capability, 'Filters', ['Month', 'Status'])
  else if (fault === 'identity_extension') Reflect.set(capability.SourceIdentity, 'NativeId', 42)
  else capability.RuntimeImplemented = false
  expect(() => createInventoryTurnoverRequest(capability, '2026-09')).toThrow('Сервер не підтвердив')
})
