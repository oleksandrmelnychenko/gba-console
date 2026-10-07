import { expect, it } from 'vitest'
import { cashMovementCatalogueKind, cashMovementPeriodError, cashMovementPeriods, createCashMovementRequest,
  initialCashMovementPeriod, isCashMovementCapabilities, normalizeCashMovementReport } from './cashMovement'
import { cashMovementCapability, cashMovementCatalogueEntry, cashMovementEmptyReport, cashMovementIncompleteReport, cashMovementReport } from './cashMovement.test-fixtures'

it.each(['receipts', 'payouts'] as const)('binds %s to its exact original definition and four columns', kind => {
  const capability = cashMovementCapability(kind)
  expect(isCashMovementCapabilities(capability, kind)).toBe(true)
  expect(isCashMovementCapabilities(capability, kind === 'receipts' ? 'payouts' : 'receipts')).toBe(false)
  expect(isCashMovementCapabilities({ ...capability, SourceParityVerified: true })).toBe(false)
  expect(isCashMovementCapabilities({ ...capability, CfoAvailable: true })).toBe(false)
  expect(isCashMovementCapabilities({ ...capability, Filters: [] })).toBe(false)
  expect(isCashMovementCapabilities({ ...capability, Columns: [...capability.Columns].reverse() })).toBe(false)
  expect(cashMovementCatalogueKind(cashMovementCatalogueEntry(kind))).toBe(kind)
  const duplicate = cashMovementCatalogueEntry(kind)
  duplicate.Sources.push(duplicate.Sources[0])
  expect(cashMovementCatalogueKind(duplicate)).toBeNull()
})
it('uses own contiguous quarter and month windows, calendar edges and the physical year boundary', () => {
  const quarters = cashMovementPeriods('receipts', '2027-Q1')
  expect(quarters.CurrentPeriod).toEqual({ From: '2027-01-01T00:00:00', ThroughExclusive: '2027-04-01T00:00:00' })
  expect(quarters.PreviousPeriod.From).toBe('2026-10-01T00:00:00')
  expect(cashMovementPeriods('payouts', '2028-02').CurrentPeriod.ThroughExclusive).toBe('2028-03-01T00:00:00')
  expect(cashMovementPeriods('payouts', '2027-01').PreviousPeriod.From).toBe('2026-12-01T00:00:00')
  expect(initialCashMovementPeriod('receipts', '2026-09')).toBe('2026-Q3')
  expect(cashMovementPeriodError('receipts', '2006-Q3')).toBeNull()
  expect(cashMovementPeriodError('receipts', '0001-Q1')).not.toBeNull()
  expect(cashMovementPeriodError('receipts', '7999-Q4')).not.toBeNull()
  expect(cashMovementPeriodError('payouts', '7999-12')).not.toBeNull()
  expect(cashMovementPeriodError('payouts', '0001-01')).not.toBeNull()
  expect(cashMovementPeriodError('receipts', '2026-09')).not.toBeNull()
  expect(cashMovementPeriodError('payouts', '2026-Q3')).not.toBeNull()
})
it.each(['receipts', 'payouts'] as const)('preserves exact server money strings and %s formatted cells without arithmetic', kind => {
  const report = cashMovementReport(kind), request = createCashMovementRequest(cashMovementCapability(kind), report.Period)
  expect(Object.keys(request)).toEqual(['Version', 'SourceIdentity', 'Period'])
  expect(normalizeCashMovementReport(report, request)).toBe(report)
  expect(report.Rows[0].Cells[2].Value).toBe('33.333333333333333333333333333')
  expect(report.Rows[0].Cells[2].FormattedValue).toBe('33.33')
  expect(report.Rows[0].Cells[3].FormattedValue).toBe('1')
})
it('keeps complete empty raw NULLs distinct from unknown publication, with no fabricated empty changes', () => {
  const capability = cashMovementCapability(), empty = cashMovementEmptyReport(), missing = cashMovementIncompleteReport()
  expect(normalizeCashMovementReport(empty, createCashMovementRequest(capability, empty.Period))).toBe(empty)
  expect(empty.Totals.map(cell => [cell.Available, cell.Value])).toEqual([[true, null], [true, null], [false, null], [false, null]])
  expect(normalizeCashMovementReport(missing, createCashMovementRequest(capability, missing.Period))).toBe(missing)
  missing.Totals[0] = { ...missing.Totals[0], Available: true, Value: '0', FormattedValue: '0' }
  expect(() => normalizeCashMovementReport(missing, createCashMovementRequest(capability, missing.Period))).toThrow('некоректний результат')
})
it('accepts unknown caption and unavailable local currency presentation without substituting EUR or blocking coherent money', () => {
  const report = cashMovementReport()
  report.Rows[0].NameAvailable = false; report.Rows[0].Name = null
  report.Inputs.Current.Publication.ManagementCurrency.Available = false
  report.Inputs.Current.Publication.ManagementCurrency.Currency = null
  report.Inputs.Current.Publication.ManagementCurrency.Code = 'management_currency_mapping_unavailable'
  expect(normalizeCashMovementReport(report, createCashMovementRequest(cashMovementCapability(), report.Period))).toBe(report)
  expect(report.Totals[0].Value).toBe('4')
})
it('preserves a complete input with unavailable decimal projection', () => {
  const report = cashMovementReport()
  report.Code = 'decimal_projection_unavailable'
  report.Totals[2] = { ...report.Totals[2], Available: false, Value: null, FormattedValue: null }
  expect(normalizeCashMovementReport(report, createCashMovementRequest(cashMovementCapability(), report.Period))).toBe(report)
})
it('rejects stale form/window, missing month, repeated group, fake availability and clock before accepting links', () => {
  const request = createCashMovementRequest(cashMovementCapability(), '2026-Q3')
  const wrong = cashMovementReport(); wrong.Inputs.Current.Publication.Months.pop()
  const duplicate = cashMovementReport(); duplicate.Rows.push(duplicate.Rows[0])
  const missingFormat = cashMovementReport(); missingFormat.Totals[2].FormattedValue = null
  const caption = cashMovementReport(); caption.Rows[0].NameAvailable = false
  const counts = cashMovementReport(); counts.Inputs.Current.Publication.Months[0].IncludedRows = 3
  const states = [cashMovementReport('payouts'), cashMovementReport('receipts', '2026-Q2'), wrong, duplicate, missingFormat, caption, counts,
    { ...cashMovementReport(), HasRows: false }, { ...cashMovementReport(), ObservationCompletedAtUtc: '2026-10-01T00:00:00Z' }]
  for (const report of states) expect(() => normalizeCashMovementReport(report, request)).toThrow('некоректний результат')
})
