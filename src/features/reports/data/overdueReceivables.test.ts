import { expect, it } from 'vitest'
import { createOverdueReceivablesRequest, isOverdueReceivablesCapabilities, isOverdueReceivablesCatalogueEntry, normalizeOverdueReceivablesReport, overdueReceivablesMonthError, overdueReceivablesPeriods } from './overdueReceivables'
import { overdueReceivablesCapability, overdueReceivablesCatalogueEntry, overdueReceivablesEmptyReport, overdueReceivablesMissingReport, overdueReceivablesReport, overdueReceivablesUnknownCurrentReport } from './overdueReceivables.test-fixtures'
it('pins actual code capabilities without claiming numeric publication or inventing an executable/FX flag', () => {
  const capability = overdueReceivablesCapability()
  expect(isOverdueReceivablesCapabilities(capability)).toBe(true)
  expect(isOverdueReceivablesCapabilities({ ...capability, SourceParityVerified: true })).toBe(false)
  expect(isOverdueReceivablesCapabilities({ ...capability, InputAvailability: 'Ready' })).toBe(false)
  expect(isOverdueReceivablesCapabilities({ ...capability, Columns: [...capability.Columns].reverse() })).toBe(false)
  expect(isOverdueReceivablesCatalogueEntry(overdueReceivablesCatalogueEntry())).toBe(true)
  const duplicate = overdueReceivablesCatalogueEntry(); duplicate.Sources.push(duplicate.Sources[0]); expect(isOverdueReceivablesCatalogueEntry(duplicate)).toBe(false)
})
it('uses own current and prior end-of-month cutoffs and exact normal producer year bounds', () => {
  expect(overdueReceivablesPeriods('2027-01')).toEqual({ CurrentPeriod: { From: '2027-01-01', ThroughExclusive: '2027-02-01' }, PreviousPeriod: { From: '2026-12-01', ThroughExclusive: '2027-01-01' } })
  expect(overdueReceivablesPeriods('2028-02').CurrentPeriod.ThroughExclusive).toBe('2028-03-01')
  expect(overdueReceivablesMonthError('0001-02')).toBeNull(); expect(overdueReceivablesMonthError('2006-03')).toBeNull()
  for (const month of ['0001-01', '7999-12', '8000-01', '2026-9', '2026-Q3']) expect(overdueReceivablesMonthError(month)).not.toBeNull()
})
it('preserves wide exact evidence and server formatted strings without calculating ratios in the browser', () => {
  const report = overdueReceivablesReport(), request = createOverdueReceivablesRequest(overdueReceivablesCapability(), report.Month)
  expect(Object.keys(request)).toEqual(['Version', 'SourceIdentity', 'Month'])
  expect(normalizeOverdueReceivablesReport(report, request)).toBe(report)
  expect(report.Cells[2].Value).toBe('-66.666666666666666666666666667'); expect(report.Cells[2].FormattedValue).toBe('-66.67')
})
it('separates confirmed empty NULLs and original hundred/zero guards from missing initial publication', () => {
  const empty = overdueReceivablesEmptyReport(), missing = overdueReceivablesMissingReport(), capability = overdueReceivablesCapability()
  expect(normalizeOverdueReceivablesReport(empty, createOverdueReceivablesRequest(capability, empty.Month))).toBe(empty)
  expect(empty.Cells.map(cell => [cell.Available, cell.Value])).toEqual([[true, null], [true, null], [true, '100'], [true, '0']])
  expect(normalizeOverdueReceivablesReport(missing, createOverdueReceivablesRequest(capability, missing.Month))).toBe(missing)
})
it('accepts the independent known-previous empty guard100 while leaving unknown current balance unavailable', () => {
  const report = overdueReceivablesUnknownCurrentReport()
  expect(normalizeOverdueReceivablesReport(report, createOverdueReceivablesRequest(overdueReceivablesCapability(), report.Month))).toBe(report)
  expect(report.Cells[2].FormattedValue).toBe('100.00')
  report.Cells[0] = { ...report.Cells[0], Available: true, Value: '0', FormattedValue: '0' }
  expect(() => normalizeOverdueReceivablesReport(report, createOverdueReceivablesRequest(overdueReceivablesCapability(), report.Month))).toThrow('некоректний результат')
})
it('accepts a wide projection refusal with complete financial inputs and retained exact sum', () => {
  const report = overdueReceivablesReport(), exact = { Numerator: '-100000000000000000000000000000', Denominator: '1' }
  report.Code = 'decimal_projection_unavailable'
  report.Cells[0] = { ...report.Cells[0], Available: false, Value: null, FormattedValue: null, ExactValue: exact }
  expect(normalizeOverdueReceivablesReport(report, createOverdueReceivablesRequest(overdueReceivablesCapability(), report.Month))).toBe(report)
})
it('checks opening and contiguous own movement generations before accepting download links', () => {
  const request = createOverdueReceivablesRequest(overdueReceivablesCapability(), '2026-09')
  const snapshot = overdueReceivablesReport(); const badSnapshot: unknown = { ...snapshot, Proof: { ...snapshot.Proof, OurSnapshotVerified: false } }
  const gap = overdueReceivablesReport(); gap.Proof.MovementGenerations[0].ThroughExclusive = '2026-07-01'
  const duplicate = overdueReceivablesReport(); duplicate.Proof.MovementGenerations[1].RunId = duplicate.Proof.MovementGenerations[0].RunId
  const missing = overdueReceivablesReport(); missing.Proof.MovementGenerations.pop()
  const parent = overdueReceivablesReport(); parent.Proof.OpeningRunId = null
  for (const report of [badSnapshot, gap, duplicate, missing, parent]) expect(() => normalizeOverdueReceivablesReport(report, request)).toThrow('некоректний результат')
})
it('rejects another month or identity, bad cells, grain counts and falsely complete availability', () => {
  const request = createOverdueReceivablesRequest(overdueReceivablesCapability(), '2026-09')
  const counts = overdueReceivablesReport(); counts.Inputs.Current.UnknownTermsGrains = 2
  const sum = overdueReceivablesReport(); sum.Inputs.Current.Code = 'terms_or_fx_unavailable'
  const format = overdueReceivablesReport(); format.Cells[2].FormattedValue = null
  for (const report of [overdueReceivablesReport('2026-08'), counts, sum, format, { ...overdueReceivablesReport(), HasRows: false },
    { ...overdueReceivablesReport(), SourceIdentity: { ...overdueReceivablesCapability().SourceIdentity, World: 'amg' } }])
    expect(() => normalizeOverdueReceivablesReport(report, request)).toThrow('некоректний результат')
})

it('keeps exact physical counterparty groups and missing captions separate from financial availability', () => {
  const request = createOverdueReceivablesRequest(overdueReceivablesCapability(), '2026-09')
  const report = overdueReceivablesReport(); report.Rows[0].NameAvailable = false; report.Rows[0].CounterpartyName = null
  expect(normalizeOverdueReceivablesReport(report, request)).toBe(report)
  const duplicate = overdueReceivablesReport(); duplicate.Rows.push(structuredClone(duplicate.Rows[0]))
  const malformed = overdueReceivablesReport(); malformed.Rows[0].CounterpartyReference = 'local-client-id'
  for (const invalid of [duplicate, malformed]) expect(() => normalizeOverdueReceivablesReport(invalid, request)).toThrow('некоректний результат')
})
it('declares EUR as current GBA presentation and rejects invented Source currency or parity', () => {
  const capability = overdueReceivablesCapability()
  expect(capability.Periodicity).toBe('Month'); expect(capability.ManagementCurrency).toBe('EUR')
  expect(isOverdueReceivablesCapabilities({ ...capability, ManagementCurrency: 'USD' })).toBe(false)
  expect(isOverdueReceivablesCapabilities({ ...capability, FxBasis: 'Source_Consts' })).toBe(false)
  const report = overdueReceivablesReport()
  expect(() => normalizeOverdueReceivablesReport({ ...report, SourceParityVerified: true }, createOverdueReceivablesRequest(capability, report.Month))).toThrow()
})

it('admits valid extreme request months with adjacent immutable parent boundaries outside the request domain', () => {
  for (const month of ['0001-02', '7999-11']) {
    const report = overdueReceivablesReport(month)
    expect(normalizeOverdueReceivablesReport(report, createOverdueReceivablesRequest(overdueReceivablesCapability(), month))).toBe(report)
  }
})
