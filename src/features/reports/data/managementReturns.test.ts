import { expect, it } from 'vitest'
import { createManagementReturnsRequest, initialManagementReturnsWindows, isManagementReturnsCapabilities, isManagementReturnsCatalogueEntry,
  managementReturnsWindowsError, normalizeManagementReturnsReport } from './managementReturns'
import { managementReturnsCapability, managementReturnsCatalogueEntry, managementReturnsEmptyReport, managementReturnsMissingReport,
  managementReturnsReport, managementReturnsUnknownCurrentReport } from './managementReturns.test-fixtures'

it('binds exact original identity, field order, raw values and explicit management currency without native parity', () => {
  const capability = managementReturnsCapability(), report = managementReturnsReport(), request = createManagementReturnsRequest(capability, report)
  expect(isManagementReturnsCapabilities(capability)).toBe(true); expect(isManagementReturnsCatalogueEntry(managementReturnsCatalogueEntry())).toBe(true)
  expect(normalizeManagementReturnsReport(report, request)).toBe(report)
  expect(report.Columns.map(column => column.Caption)).toEqual(['Текущее значение', 'Значение предыдущего периода', 'Изменение %', 'Изменение (абс)'])
  expect(report.Totals.map(cell => cell.Value)).toEqual(['-5', '-10', '-50', '5'])
  expect(report.ManagementCurrency).toBe('Управлінська валюта'); expect(report.SourceParityVerified).toBe(false)
})
it('produces local month/prior windows across January and leap months with no timezone shift', () => {
  expect(initialManagementReturnsWindows('2026-01').PreviousPeriod).toEqual({ From: '2025-12-01T00:00:00.000', ThroughExclusive: '2026-01-01T00:00:00.000' })
  const windows = initialManagementReturnsWindows('2024-02'); windows.CurrentPeriod.From = '2024-02-29T12:34'
  expect(createManagementReturnsRequest(managementReturnsCapability(), windows).CurrentPeriod.From).toBe('2024-02-29T12:34:00.000')
  windows.CurrentPeriod.From = '2024-02-29T12:34:56.123'
  expect(createManagementReturnsRequest(managementReturnsCapability(), windows).CurrentPeriod.From).toBe(windows.CurrentPeriod.From)
})
it.each(['2026-02-30T00:00', '2026-09-01T00:00Z', '2026-09-01T00:00+03:00', '2026-09-01T00:00:00.0001', '', '0000-01-01T00:00'])('refuses invalid calendar boundary %s without replacing it with now', value => {
  const windows = initialManagementReturnsWindows('2026-09'); windows.CurrentPeriod.From = value
  expect(managementReturnsWindowsError(windows)).not.toBeNull()
  expect(() => createManagementReturnsRequest(managementReturnsCapability(), windows)).toThrow()
})
it('rejects reversed windows and the exact physical calendar overflow while allowing the last supported month', () => {
  const windows = initialManagementReturnsWindows('7999-11')
  expect(managementReturnsWindowsError(windows)).toBeNull()
  windows.CurrentPeriod = { From: '7999-12-01T00:00', ThroughExclusive: '8000-01-01T00:00' }
  expect(managementReturnsWindowsError(windows)).not.toBeNull()
  windows.CurrentPeriod = { From: '2026-09-01T00:00', ThroughExclusive: '2026-09-01T00:00' }
  expect(managementReturnsWindowsError(windows)).not.toBeNull()
})
it('keeps published empty, missing publication and known previous numbers distinct with no invented changes', () => {
  for (const report of [managementReturnsEmptyReport(), managementReturnsMissingReport(), managementReturnsUnknownCurrentReport()])
    expect(normalizeManagementReturnsReport(report, createManagementReturnsRequest(managementReturnsCapability(), report))).toBe(report)
  expect(managementReturnsEmptyReport().Totals.every(cell => cell.Value === null)).toBe(true)
  expect(managementReturnsMissingReport().Inputs.Current.IncludedRows).toBeNull()
  expect(managementReturnsUnknownCurrentReport().Totals[1].Value).toBe('-10')
})
it('keeps caption unavailable or Source NULL independent from complete financial inputs', () => {
  const report = managementReturnsReport(), request = createManagementReturnsRequest(managementReturnsCapability(), report)
  report.Rows[0] = { ...report.Rows[0], Caption: null, NameAvailable: false }; report.CounterpartyNamesComplete = false
  expect(normalizeManagementReturnsReport(report, request)).toBe(report)
  report.Rows[0] = { ...report.Rows[0], SourceNull: true, NameAvailable: true }; report.CounterpartyNamesComplete = true
  expect(normalizeManagementReturnsReport(report, request)).toBe(report)
})
it('accepts complete decimal overflow with exact evidence and preserves server formatting rather than calculating it', () => {
  const report = managementReturnsReport(), request = createManagementReturnsRequest(managementReturnsCapability(), report)
  report.Code = 'decimal_projection_unavailable'; report.Totals[0] = { ...report.Totals[0], Available: false, Value: null, FormattedValue: null,
    ExactValue: { Numerator: '-100000000000000000000000000000', Denominator: '1' } }
  expect(normalizeManagementReturnsReport(report, request)).toBe(report)
  report.Totals[1] = { ...report.Totals[1], Value: '-10.000000000000000000000000001', FormattedValue: '-10.000000000000000000000000001',
    ExactValue: { Numerator: '-10000000000000000000000000001', Denominator: '1000000000000000000000000000' } }
  expect(normalizeManagementReturnsReport(report, request).Totals[1].FormattedValue).toBe('-10.000000000000000000000000001')
})
it.each(['identity', 'period', 'column', 'currency', 'parity', 'row_key', 'caption', 'complete', 'unknown_count', 'empty_change', 'parent_vector', 'parent_hash', 'duplicate_run', 'clock', 'unsafe_file'])('refuses an inconsistent %s response without exposing files', kind => {
  const report = managementReturnsReport(), request = createManagementReturnsRequest(managementReturnsCapability(), report)
  if (kind === 'identity') report.SourceIdentity = { ...report.SourceIdentity, World: 'amg' } as typeof report.SourceIdentity
  else if (kind === 'period') report.PreviousPeriod.From = '2026-07-01T00:00:00.000'
  else if (kind === 'column') report.Columns.reverse()
  else if (kind === 'currency') report.ManagementCurrency = 'EUR' as typeof report.ManagementCurrency
  else if (kind === 'parity') report.SourceParityVerified = true as false
  else if (kind === 'row_key') report.Rows[0].Key = '00000000000000000000000000000001'
  else if (kind === 'caption') report.Rows[0].NameAvailable = false
  else if (kind === 'complete') report.Complete = false
  else if (kind === 'unknown_count') { report.Inputs.Current.Available = false; report.Inputs.Current.IncludedRows = 0 }
  else if (kind === 'empty_change') { Object.assign(report, managementReturnsEmptyReport()); report.Totals[2] = managementReturnsReport().Totals[2] }
  else if (kind === 'parent_vector') report.Proof.Publications.reverse()
  else if (kind === 'parent_hash') report.Proof.Publications[0].CompletePassSha256 = 'wrong'
  else if (kind === 'duplicate_run') report.Proof.Publications[1].RunId = report.Proof.Publications[0].RunId
  else if (kind === 'clock') report.ObservationStartedAtUtc = '2026-02-30T00:00:00.0000000Z'
  else report.DocumentURL = 'javascript:alert(1)'
  expect(() => normalizeManagementReturnsReport(report, request)).toThrow('непідтверджений результат')
})
it('requires genuine exact capabilities and never changes an unavailable runtime flag', () => {
  const capability = managementReturnsCapability(); capability.RuntimeImplemented = false
  expect(() => createManagementReturnsRequest(capability, initialManagementReturnsWindows('2026-09'))).toThrow('Сервер не підтвердив')
  expect(capability.RuntimeImplemented).toBe(false)
  expect(isManagementReturnsCatalogueEntry({ ...managementReturnsCatalogueEntry(), Sources: [...managementReturnsCatalogueEntry().Sources, ...managementReturnsCatalogueEntry().Sources] })).toBe(false)
})
