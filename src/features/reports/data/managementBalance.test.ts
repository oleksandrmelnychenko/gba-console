import { expect, it } from 'vitest'
import { createManagementBalanceRequest, initialManagementBalancePeriod, isManagementBalanceCapabilities, managementBalanceCatalogueKind,
  managementBalanceEndpoints, managementBalancePeriodError, normalizeManagementBalanceReport, type ManagementBalanceKind } from './managementBalance'
import { managementBalanceCapability, managementBalanceCatalogueEntry, managementBalanceEmptyReport, managementBalanceMissingReport, managementBalanceReport } from './managementBalance.test-fixtures'
const kinds: ManagementBalanceKind[] = ['monthlyReceivables', 'quarterlyManagementPayables']
it.each(kinds)('binds %s original identity, four fields and honest raw management resource', kind => {
  const capability = managementBalanceCapability(kind), report = managementBalanceReport(kind)
  expect(isManagementBalanceCapabilities(capability, kind)).toBe(true); expect(managementBalanceCatalogueKind(managementBalanceCatalogueEntry(kind))).toBe(kind)
  expect(normalizeManagementBalanceReport(report, createManagementBalanceRequest(capability, report.Period))).toBe(report)
  expect(report.Totals.map(cell => cell.FormattedValue)).toEqual(['5', '10', '-50.00', '-5'])
  expect(report.DeclaredResourceUnit).toBe('(Упр)'); expect(report.SourceParityVerified).toBe(false)
})
it('derives balance endpoints at selected month/quarter boundaries rather than turnover windows', () => {
  expect(managementBalanceEndpoints('monthlyReceivables', '2024-02')).toEqual({ CurrentThroughExclusive: '2024-03-01', PreviousThroughExclusive: '2024-02-01' })
  expect(managementBalanceEndpoints('quarterlyManagementPayables', '2026-Q1')).toEqual({ CurrentThroughExclusive: '2026-04-01', PreviousThroughExclusive: '2026-01-01' })
  expect(initialManagementBalancePeriod('quarterlyManagementPayables', '2026-12')).toBe('2026-Q4')
})
it.each(['0000-01', '0001-01', '7999-12', '2026-13', '2026-Q3', '2026-09-01', ' 2026-09'])('refuses invalid monthly selection %s', period => {
  expect(managementBalancePeriodError('monthlyReceivables', period)).not.toBeNull()
  expect(() => createManagementBalanceRequest(managementBalanceCapability(), period)).toThrow()
})
it.each(['0001-Q1', '7999-Q4', '2026-Q0', '2026-Q5', '2026-09', '2026-q3'])('refuses invalid quarter selection %s', period => {
  expect(managementBalancePeriodError('quarterlyManagementPayables', period)).not.toBeNull()
})
it('accepts the first and last supported endpoints without date guessing', () => {
  for (const [kind, period] of [['monthlyReceivables', '0001-02'], ['monthlyReceivables', '7999-11'],
    ['quarterlyManagementPayables', '0001-Q2'], ['quarterlyManagementPayables', '7999-Q3']] as const)
    expect(managementBalancePeriodError(kind, period)).toBeNull()
})
it.each(kinds)('keeps %s published empty and missing opening separate', kind => {
  for (const report of [managementBalanceEmptyReport(kind), managementBalanceMissingReport(kind)])
    expect(normalizeManagementBalanceReport(report, createManagementBalanceRequest(managementBalanceCapability(kind), report.Period))).toBe(report)
  expect(managementBalanceEmptyReport(kind).Totals.map(cell => cell.Available)).toEqual([true, true, false, false])
})
it('accepts invalid opening retained ID and partial contiguous parents only as unavailable', () => {
  const report = managementBalanceMissingReport(); report.Proof.OpeningRunId = managementBalanceReport().Proof.OpeningRunId
  expect(normalizeManagementBalanceReport(report, createManagementBalanceRequest(managementBalanceCapability(), report.Period))).toBe(report)
  const partial = managementBalanceReport('quarterlyManagementPayables'); partial.Complete = false; partial.Code = 'balance_input_unavailable'
  partial.Inputs.Current = { ...partial.Inputs.Current, Available: false, PhysicalRows: null, MovementPrefixComplete: false }
  partial.Inputs.Previous = { ...partial.Inputs.Previous, Available: false, PhysicalRows: null, MovementPrefixComplete: false }
  partial.Totals = partial.Totals.map(cell => ({ ...cell, Value: null, FormattedValue: null, ExactValue: null, Available: false }))
  partial.Rows = []; partial.HasRows = false; partial.Proof.MovementGenerations.pop()
  expect(normalizeManagementBalanceReport(partial, createManagementBalanceRequest(managementBalanceCapability('quarterlyManagementPayables'), partial.Period))).toBe(partial)
})
it('keeps independent previous-zero hundred when current input is missing without coalescing it', () => {
  const report = managementBalanceReport(); report.Complete = false; report.Code = 'balance_input_unavailable'
  report.Inputs.Current = { ...report.Inputs.Current, Available: false, PhysicalRows: null }
  const cells = report.Totals.map((cell, index) => index === 1 ? { ...cell, Value: '0', FormattedValue: '0', ExactValue: { Numerator: '0', Denominator: '1' } }
    : index === 2 ? { ...cell, Value: '100', FormattedValue: '100.00', ExactValue: { Numerator: '100', Denominator: '1' } }
    : { ...cell, Value: null, FormattedValue: null, ExactValue: null, Available: false })
  report.Totals = cells; report.Rows[0].Cells = structuredClone(cells)
  expect(normalizeManagementBalanceReport(report, createManagementBalanceRequest(managementBalanceCapability(), report.Period))).toBe(report)
})
it('keeps missing names and exact decimal overflow independent from input coverage', () => {
  const report = managementBalanceReport(); report.Rows[0].NameAvailable = false; report.Rows[0].Caption = null; report.CounterpartyNamesComplete = false
  report.Code = 'decimal_projection_unavailable'; report.Totals[0] = { ...report.Totals[0], Available: false, Value: null, FormattedValue: null,
    ExactValue: { Numerator: '100000000000000000000000000000', Denominator: '1' } }
  expect(normalizeManagementBalanceReport(report, createManagementBalanceRequest(managementBalanceCapability(), report.Period))).toBe(report)
})
it.each(['identity', 'endpoint', 'periodicity', 'column', 'unit', 'parity', 'unsafe_file', 'duplicate_group', 'name', 'count', 'opening', 'parent_month', 'parent_run', 'parent_hash', 'parent_missing', 'parent_opening_run', 'future_boundary', 'snapshot', 'name_hash', 'empty_change', 'complete'])('refuses inconsistent %s delivery and witness', kind => {
  const report = managementBalanceReport('quarterlyManagementPayables'), request = createManagementBalanceRequest(managementBalanceCapability('quarterlyManagementPayables'), report.Period)
  const value = report as unknown as Record<string, unknown>
  if (kind === 'identity') value.SourceIdentity = managementBalanceCapability().SourceIdentity
  else if (kind === 'endpoint') report.CurrentThroughExclusive = '2026-09-01'
  else if (kind === 'periodicity') value.Periodicity = 'Month'
  else if (kind === 'column') report.Columns.reverse()
  else if (kind === 'unit') value.DeclaredResourceUnit = 'EUR'
  else if (kind === 'parity') value.SourceParityVerified = true
  else if (kind === 'unsafe_file') report.PdfDocumentURL = 'javascript:alert(1)'
  else if (kind === 'duplicate_group') report.Rows.push(report.Rows[0])
  else if (kind === 'name') report.Rows[0].NameAvailable = false
  else if (kind === 'count') report.Inputs.Current.PhysicalRows = Number.MAX_SAFE_INTEGER + 1
  else if (kind === 'opening') report.Proof.OpeningPassSha256 = null
  else if (kind === 'parent_month') report.Proof.MovementGenerations.reverse()
  else if (kind === 'parent_run') report.Proof.MovementGenerations[1].RunId = report.Proof.MovementGenerations[0].RunId
  else if (kind === 'parent_hash') report.Proof.MovementGenerations[0].PassSha256 = 'wrong'
  else if (kind === 'parent_missing') report.Proof.MovementGenerations.pop()
  else if (kind === 'parent_opening_run') report.Proof.MovementGenerations[0].RunId = report.Proof.OpeningRunId!
  else if (kind === 'future_boundary') report.Proof.BusinessBoundary = '2026-07-02'
  else if (kind === 'snapshot') value.Proof = { ...report.Proof, OurSnapshotVerified: false }
  else if (kind === 'name_hash') report.Proof.CounterpartyNamesSha256 = 'wrong'
  else if (kind === 'empty_change') { Object.assign(report, managementBalanceEmptyReport('quarterlyManagementPayables')); report.Totals[2] = managementBalanceReport().Totals[2] }
  else report.Complete = false
  expect(() => normalizeManagementBalanceReport(report, request)).toThrow('непідтверджений результат')
})
it('never substitutes executable flags or accepts another original capability and duplicate identity', () => {
  const capability = managementBalanceCapability(); capability.RuntimeImplemented = false
  expect(() => createManagementBalanceRequest(capability, '2026-09')).toThrow('Сервер не підтвердив'); expect(capability.RuntimeImplemented).toBe(false)
  expect(isManagementBalanceCapabilities(managementBalanceCapability(), 'quarterlyManagementPayables')).toBe(false)
  const entry = managementBalanceCatalogueEntry(); entry.Sources.push(entry.Sources[0]); expect(managementBalanceCatalogueKind(entry)).toBeNull()
})

it('keeps physically covered unknown resources unavailable without assuming coverage proves numeric completeness', () => {
  const report = managementBalanceReport(); report.Complete = false; report.Code = 'balance_input_unavailable'
  report.Totals = report.Totals.map((cell, index) => index === 1 ? cell : { ...cell, Available: false, Value: null, FormattedValue: null, ExactValue: null })
  report.Rows[0].Cells = structuredClone(report.Totals)
  expect(report.Inputs.Current.Available).toBe(true)
  expect(normalizeManagementBalanceReport(report, createManagementBalanceRequest(managementBalanceCapability(), report.Period))).toBe(report)
})

it('keeps a complete previous balance when only the current movement prefix is missing', () => {
  const report = managementBalanceReport(); report.Complete = false; report.Code = 'balance_input_unavailable'
  report.Inputs.Current = { ...report.Inputs.Current, Available: false, PhysicalRows: null, MovementPrefixComplete: false }
  report.Proof.MovementGenerations = []
  report.Totals = report.Totals.map((cell, index) => index === 1 ? cell : { ...cell, Available: false, Value: null, FormattedValue: null, ExactValue: null })
  report.Rows[0].Cells = structuredClone(report.Totals)
  expect(normalizeManagementBalanceReport(report, createManagementBalanceRequest(managementBalanceCapability(), report.Period))).toBe(report)
})

it('requires every claimed complete movement prefix even when resource availability is false', () => {
  const report = managementBalanceMissingReport(), parent = managementBalanceReport()
  report.Proof = parent.Proof; report.Proof.MovementGenerations = []
  report.Inputs.Current.DatedOpeningComplete = true; report.Inputs.Previous.DatedOpeningComplete = true
  report.Inputs.Current.MovementPrefixComplete = true
  expect(() => normalizeManagementBalanceReport(report, createManagementBalanceRequest(managementBalanceCapability(), report.Period))).toThrow('непідтверджений результат')
})
