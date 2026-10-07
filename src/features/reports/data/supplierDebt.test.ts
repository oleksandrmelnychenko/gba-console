import { expect, it } from 'vitest'
import { createSupplierDebtRequest, isSupplierDebtCapabilities, isSupplierDebtCatalogueEntry, normalizeSupplierDebtReport, supplierDebtMonthError, supplierDebtPeriods } from './supplierDebt'
import { supplierDebtCapability, supplierDebtCatalogueEntry, supplierDebtEmptyReport, supplierDebtMissingReport, supplierDebtReport, supplierDebtUnknownCurrentReport } from './supplierDebt.test-fixtures'
it('pins actual code capabilities without claiming numeric publication or inventing an executable/FX flag', () => {
  const capability = supplierDebtCapability()
  expect(isSupplierDebtCapabilities(capability)).toBe(true)
  expect(isSupplierDebtCapabilities({ ...capability, SourceParityVerified: true })).toBe(false)
  expect(isSupplierDebtCapabilities({ ...capability, InputAvailability: 'Ready' })).toBe(false)
  expect(isSupplierDebtCapabilities({ ...capability, Columns: [...capability.Columns].reverse() })).toBe(false)
  expect(isSupplierDebtCatalogueEntry(supplierDebtCatalogueEntry())).toBe(true)
  const duplicate = supplierDebtCatalogueEntry(); duplicate.Sources.push(duplicate.Sources[0]); expect(isSupplierDebtCatalogueEntry(duplicate)).toBe(false)
})
it('uses own current and prior end-of-month cutoffs and exact normal producer year bounds', () => {
  expect(supplierDebtPeriods('2027-01')).toEqual({ CurrentPeriod: { From: '2027-01-01', ThroughExclusive: '2027-02-01' }, PreviousPeriod: { From: '2026-12-01', ThroughExclusive: '2027-01-01' } })
  expect(supplierDebtPeriods('2028-02').CurrentPeriod.ThroughExclusive).toBe('2028-03-01')
  expect(supplierDebtMonthError('0001-02')).toBeNull(); expect(supplierDebtMonthError('2006-03')).toBeNull()
  for (const month of ['0001-01', '7999-12', '8000-01', '2026-9', '2026-Q3']) expect(supplierDebtMonthError(month)).not.toBeNull()
})
it('preserves wide exact evidence and server formatted strings without calculating ratios in the browser', () => {
  const report = supplierDebtReport(), request = createSupplierDebtRequest(supplierDebtCapability(), report.Month)
  expect(Object.keys(request)).toEqual(['Version', 'SourceIdentity', 'Month'])
  expect(normalizeSupplierDebtReport(report, request)).toBe(report)
  expect(report.Cells[2].Value).toBe('-66.666666666666666666666666667'); expect(report.Cells[2].FormattedValue).toBe('-66.67')
})
it('separates confirmed empty raw NULLs and unavailable empty changes from missing initial publication', () => {
  const empty = supplierDebtEmptyReport(), missing = supplierDebtMissingReport(), capability = supplierDebtCapability()
  expect(normalizeSupplierDebtReport(empty, createSupplierDebtRequest(capability, empty.Month))).toBe(empty)
  expect(empty.Cells.map(cell => [cell.Available, cell.Value])).toEqual([[true, null], [true, null], [false, null], [false, null]])
  expect(normalizeSupplierDebtReport(missing, createSupplierDebtRequest(capability, missing.Month))).toBe(missing)
})
it('accepts the independent known-previous empty guard100 while leaving unknown current balance unavailable', () => {
  const report = supplierDebtUnknownCurrentReport()
  expect(normalizeSupplierDebtReport(report, createSupplierDebtRequest(supplierDebtCapability(), report.Month))).toBe(report)
  expect(report.Cells[2].FormattedValue).toBe('100.00')
  report.Cells[0] = { ...report.Cells[0], Available: true, Value: '0', FormattedValue: '0' }
  expect(() => normalizeSupplierDebtReport(report, createSupplierDebtRequest(supplierDebtCapability(), report.Month))).toThrow('некоректний результат')
})
it('accepts a wide projection refusal with complete financial inputs and retained exact sum', () => {
  const report = supplierDebtReport(), exact = { Numerator: '-100000000000000000000000000000', Denominator: '1' }
  report.Code = 'decimal_projection_unavailable'; report.Inputs.Current.ManagementBalanceSum = exact
  report.Cells[0] = { ...report.Cells[0], Available: false, Value: null, FormattedValue: null, ExactValue: exact }
  expect(normalizeSupplierDebtReport(report, createSupplierDebtRequest(supplierDebtCapability(), report.Month))).toBe(report)
})
it('checks opening and contiguous own movement generations before accepting download links', () => {
  const request = createSupplierDebtRequest(supplierDebtCapability(), '2026-09')
  const snapshot = supplierDebtReport(); const badSnapshot: unknown = { ...snapshot, Proof: { ...snapshot.Proof, OurSnapshotVerified: false } }
  const gap = supplierDebtReport(); gap.Proof.MovementGenerations[0].BusinessMonth = '2026-07-01'
  const duplicate = supplierDebtReport(); duplicate.Proof.MovementGenerations[1].RunId = duplicate.Proof.MovementGenerations[0].RunId
  const missing = supplierDebtReport(); missing.Proof.MovementGenerations.pop()
  const parent = supplierDebtReport(); parent.Inputs.Current.PublicationId = 'ffffffff-eeee-dddd-cccc-bbbbbbbbbbbb'
  for (const report of [badSnapshot, gap, duplicate, missing, parent]) expect(() => normalizeSupplierDebtReport(report, request)).toThrow('некоректний результат')
})
it('rejects another month or identity, bad cells, grain counts and falsely complete availability', () => {
  const request = createSupplierDebtRequest(supplierDebtCapability(), '2026-09')
  const counts = supplierDebtReport(); counts.Inputs.Current.UnknownKindGrains = 2
  const sum = supplierDebtReport(); sum.Inputs.Current.ManagementBalanceSum = { Numerator: '-2', Denominator: '1' }
  const format = supplierDebtReport(); format.Cells[2].FormattedValue = null
  for (const report of [supplierDebtReport('2026-08'), counts, sum, format, { ...supplierDebtReport(), HasRows: false },
    { ...supplierDebtReport(), SourceIdentity: { ...supplierDebtCapability().SourceIdentity, World: 'amg' } }])
    expect(() => normalizeSupplierDebtReport(report, request)).toThrow('некоректний результат')
})
