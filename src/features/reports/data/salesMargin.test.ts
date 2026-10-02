import { expect, it } from 'vitest'
import { createSalesMarginRequest, isSalesMarginCapabilities, isSalesMarginCatalogueEntry, normalizeSalesMarginReport,
  salesMarginMonthError, salesMarginPeriods } from './salesMargin'
import { salesMarginCapability, salesMarginCatalogueEntry, salesMarginEmptyInput, salesMarginReport } from './salesMargin.test-fixtures'

it('binds the dedicated identity, four columns and explicit current monthly basis', () => {
  expect(isSalesMarginCapabilities(salesMarginCapability())).toBe(true)
  expect(isSalesMarginCapabilities({ ...salesMarginCapability(), SourceParityVerified: true })).toBe(false)
  expect(isSalesMarginCapabilities({ ...salesMarginCapability(), Currency: 'USD' })).toBe(false)
  expect(isSalesMarginCapabilities({ ...salesMarginCapability(), Columns: [...salesMarginCapability().Columns].reverse() })).toBe(false)
  expect(isSalesMarginCatalogueEntry(salesMarginCatalogueEntry())).toBe(true)
  expect(isSalesMarginCatalogueEntry({ ...salesMarginCatalogueEntry(), Sources: [...salesMarginCatalogueEntry().Sources, ...salesMarginCatalogueEntry().Sources] })).toBe(false)
})

it('derives only calendar periods and does not impose a historical 2007 or Source physical-year limit', () => {
  expect(salesMarginPeriods('2028-02').CurrentPeriod.ThroughExclusive).toBe('2028-03-01')
  expect(salesMarginPeriods('2027-01').PreviousPeriod.From).toBe('2026-12-01')
  expect(salesMarginMonthError('2006-03')).toBeNull()
  expect(salesMarginMonthError('8000-01')).toBeNull()
  expect(salesMarginMonthError('0001-02')).not.toBeNull()
  expect(salesMarginMonthError('9999-12')).not.toBeNull()
  expect(salesMarginMonthError('2026-09-01')).not.toBeNull()
})

it('preserves raw strings and server formatted values without client arithmetic', () => {
  const report = salesMarginReport(), request = createSalesMarginRequest(salesMarginCapability(), '2026-09')
  report.Inputs.Current.CostEur = { Numerator: '30', Denominator: '1' }
  report.Inputs.Previous.CostEur = { Numerator: '40', Denominator: '1' }
  report.Cells[0] = { ...report.Cells[0], Value: '0.7', FormattedValue: '0.7' }
  report.Cells[1] = { ...report.Cells[1], Value: '0.6', FormattedValue: '0.6' }
  report.Cells[2].Value = '16.666666666666666666666666667'
  report.Cells[2].FormattedValue = '16.67'
  expect(normalizeSalesMarginReport(report, request)).toBe(report)
  expect(report.Cells[2].Value).toBe('16.666666666666666666666666667')
})

it('accepts confirmed empty scalar NULLs and the source-derived empty changes', () => {
  const report = salesMarginReport()
  report.HasRows = false; report.Code = 'recorded_empty'
  report.Inputs = { Current: salesMarginEmptyInput(), Previous: salesMarginEmptyInput() }
  report.Cells = report.Cells.map((cell, index) => ({ ...cell,
    Value: index < 2 ? null : index === 2 ? '100' : '0', FormattedValue: index < 2 ? null : index === 2 ? '100.00' : '0.00' }))
  expect(normalizeSalesMarginReport(report, createSalesMarginRequest(salesMarginCapability(), report.Month))).toBe(report)
})

it('distinguishes incomplete cost from confirmed NULL and retains known other-period values', () => {
  const report = salesMarginReport(), request = createSalesMarginRequest(salesMarginCapability(), '2026-09')
  report.Complete = false; report.Code = 'input_not_available'
  report.Inputs.Current = { ...report.Inputs.Current, UnknownCostGroups: 1, CostEur: null, Available: false }
  report.Cells = report.Cells.map((cell, index) => index === 1 ? cell : { ...cell, Value: null, FormattedValue: null, Available: false })
  expect(normalizeSalesMarginReport(report, request)).toBe(report)
  report.Cells[0] = { ...report.Cells[0], Value: '0', FormattedValue: '0', Available: true }
  expect(() => normalizeSalesMarginReport(report, request)).toThrow('некоректний результат')
})

it('keeps the proven zero-sales branch numeric while its missing-cost completeness gap remains visible', () => {
  const report = salesMarginReport()
  report.Complete = false; report.Code = 'input_not_available'
  report.Inputs.Current = { ...report.Inputs.Current, SalesEur: { Numerator: '0', Denominator: '1' }, UnknownCostGroups: 1, CostEur: null, Available: false }
  report.Cells[0] = { ...report.Cells[0], Value: '0', FormattedValue: '0' }
  report.Cells[2] = { ...report.Cells[2], Value: '-100', FormattedValue: '-100.00' }
  report.Cells[3] = { ...report.Cells[3], Value: '-0.5', FormattedValue: '-0.50' }
  expect(normalizeSalesMarginReport(report, createSalesMarginRequest(salesMarginCapability(), report.Month))).toBe(report)
})

it('accepts the independent prior-zero 100 branch without treating missing current money as Source NULL', () => {
  const report = salesMarginReport()
  report.Complete = false; report.Code = 'input_not_available'
  report.Inputs.Current = { ...report.Inputs.Current, UnknownSalesLines: 1, SalesEur: null, Available: false }
  report.Inputs.Previous.CostEur = { Numerator: '100', Denominator: '1' }
  report.Cells[0] = { ...report.Cells[0], Value: null, FormattedValue: null, Available: false }
  report.Cells[1] = { ...report.Cells[1], Value: '0', FormattedValue: '0' }
  report.Cells[2] = { ...report.Cells[2], Value: '100', FormattedValue: '100.00' }
  report.Cells[3] = { ...report.Cells[3], Value: null, FormattedValue: null, Available: false }
  expect(normalizeSalesMarginReport(report, createSalesMarginRequest(salesMarginCapability(), report.Month))).toBe(report)
})

it('accepts unavailable numeric projection with complete financial inputs', () => {
  const report = salesMarginReport()
  report.Code = 'arithmetic_or_projection_unavailable'
  report.Inputs.Previous.SalesEur = { Numerator: '1', Denominator: '1' }
  report.Inputs.Previous.CostEur = { Numerator: '999999999999999999999999999999', Denominator: '1000000000000000000000000000000' }
  report.Cells[1] = { ...report.Cells[1], Value: '0', FormattedValue: '0' }
  report.Cells[2] = { ...report.Cells[2], Value: null, FormattedValue: null, Available: false }
  report.Cells[3] = { ...report.Cells[3], Value: '0.6', FormattedValue: '0.60' }
  expect(normalizeSalesMarginReport(report, createSalesMarginRequest(salesMarginCapability(), report.Month))).toBe(report)
})

it('rejects another month, basis, count, column, clock or missing formatted value before accepting links', () => {
  const request = createSalesMarginRequest(salesMarginCapability(), '2026-09')
  const bad: unknown[] = [salesMarginReport('2026-08'), { ...salesMarginReport(), Currency: 'USD' },
    { ...salesMarginReport(), HasRows: false }, { ...salesMarginReport(), ObservationCompletedAtUtc: '2026-10-01T00:00:00Z' }]
  const missingFormat = salesMarginReport()
  missingFormat.Cells[2] = { ...missingFormat.Cells[2], FormattedValue: null }
  bad.push(missingFormat)
  const count = salesMarginReport()
  count.Inputs.Current.UnknownCostGroups = 2
  bad.push(count)
  for (const report of bad) expect(() => normalizeSalesMarginReport(report, request)).toThrow('некоректний результат')
})
