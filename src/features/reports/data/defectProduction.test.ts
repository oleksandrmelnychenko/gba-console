import { expect, it } from 'vitest'
import { createDefectProductionRequest, defectProductionWindows, isDefectProductionCapabilities, isDefectProductionCatalogueEntry,
  defectProductionMonthError, normalizeDefectProductionReport } from './defectProduction'
import { defectProductionCapability, defectProductionCatalogueEntry, defectProductionEmptyReport, defectProductionMissingReport,
  defectProductionReport, defectProductionUnknownCurrentReport, defectProductionZeroReport, defectProductionNullPreviousReport,
  defectProductionUnknownCurrentZeroPreviousReport, defectProductionUnknownCurrentNullPreviousReport } from './defectProduction.test-fixtures'

it('binds the retained scalar identity, original previous caption and dimensionless server ratio without percent scaling', () => {
  const capability = defectProductionCapability(), report = defectProductionReport(), request = createDefectProductionRequest(capability, report.Month)
  expect(isDefectProductionCapabilities(capability)).toBe(true); expect(isDefectProductionCatalogueEntry(defectProductionCatalogueEntry())).toBe(true)
  expect(normalizeDefectProductionReport(report, request)).toBe(report)
  expect(report.Columns.map(column => column.Caption)).toEqual(['Текущее значение', 'Предыдущее значение', 'Изменение %', 'Изменение (абс)'])
  expect(report.Cells.map(cell => cell.FormattedValue)).toEqual(['0.2', '0.4', '-50.00', '-0.2'])
  expect(report.ResultUnit).toBe('DimensionlessRatioWithoutPercentScaling'); expect(report.SourceParityVerified).toBe(false)
})
it('creates only canonical month/prior windows across January, leap years and physical bounds', () => {
  expect(defectProductionWindows('2026-01').PreviousPeriod).toEqual({ From: '2025-12-01T00:00:00.000', ThroughExclusive: '2026-01-01T00:00:00.000' })
  expect(defectProductionWindows('2024-02').CurrentPeriod).toEqual({ From: '2024-02-01T00:00:00.000', ThroughExclusive: '2024-03-01T00:00:00.000' })
  expect(defectProductionWindows('0001-02').PreviousPeriod.From).toBe('0001-01-01T00:00:00.000')
  expect(defectProductionWindows('7999-11').CurrentPeriod.ThroughExclusive).toBe('7999-12-01T00:00:00.000')
  expect(createDefectProductionRequest(defectProductionCapability(), '2026-09')).toEqual({ Version: 1, SourceIdentity: defectProductionCapability().SourceIdentity, Month: '2026-09' })
})
it.each(['2026-9', '2026-00', '2026-13', '2026-09-01', '2026-09Z', ' 2026-09', '', '0000-02', '0001-01', '7999-12', '8000-01'])('refuses unsupported/noncanonical month %s without native-period aliases', month => {
  expect(defectProductionMonthError(month)).not.toBeNull()
  expect(() => createDefectProductionRequest(defectProductionCapability(), month)).toThrow()
})
it('preserves empty scalar NULL/NULL with independent server100/0, known zero and missing values as distinct states', () => {
  for (const report of [defectProductionEmptyReport(), defectProductionMissingReport(), defectProductionUnknownCurrentReport(), defectProductionZeroReport(), defectProductionNullPreviousReport(), defectProductionUnknownCurrentZeroPreviousReport()])
    expect(normalizeDefectProductionReport(report, createDefectProductionRequest(defectProductionCapability(), report.Month))).toBe(report)
  expect(defectProductionEmptyReport().Cells.map(cell => cell.Value)).toEqual([null, null, '100', '0'])
  expect(defectProductionZeroReport().Cells.map(cell => cell.Value)).toEqual(['0', '0', '100', '0'])
  expect(defectProductionMissingReport().Inputs.Current.IncludedRows).toBeNull()
  expect(defectProductionUnknownCurrentZeroPreviousReport().Cells.map(cell => cell.FormattedValue)).toEqual([null, '0', '100.00', null])
})
it('preserves known current with an independently unavailable previous period and no invented changes', () => {
  const report = defectProductionReport(), request = createDefectProductionRequest(defectProductionCapability(), report.Month)
  report.Inputs.Previous = { Available: false, IncludedRows: null, Code: 'production_quality_unavailable' }
  report.Complete = false; report.Code = 'production_input_unavailable'
  report.Cells = report.Cells.map((cell, index) => index === 0 ? cell : { ...cell, Value: null, Available: false, ExactValue: null, FormattedValue: null })
  expect(normalizeDefectProductionReport(report, request).Cells[0].Value).toBe('0.2')
})
it('does not interpret complete physical publications as known quality or complete query inputs', () => {
  const report = defectProductionUnknownCurrentReport()
  expect(report.Proof.Publications.every(parent => parent.Available)).toBe(true)
  expect(normalizeDefectProductionReport(report, createDefectProductionRequest(defectProductionCapability(), report.Month))).toBe(report)
  expect(report.Complete).toBe(false)
})
it('accepts complete projection overflow with exact evidence while preserving server strings without recomputation', () => {
  const report = defectProductionReport(), request = createDefectProductionRequest(defectProductionCapability(), report.Month)
  report.Code = 'decimal_projection_unavailable'; report.Cells[0] = { ...report.Cells[0], Available: false, Value: null, FormattedValue: null,
    ExactValue: { Numerator: '-100000000000000000000000000000', Denominator: '1' } }
  expect(normalizeDefectProductionReport(report, request)).toBe(report)
  report.Cells[1] = { ...report.Cells[1], Value: '0.400000000000000000000000001', FormattedValue: '0.400000000000000000000000001',
    ExactValue: { Numerator: '400000000000000000000000001', Denominator: '1000000000000000000000000000' } }
  expect(normalizeDefectProductionReport(report, request).Cells[1].FormattedValue).toBe('0.400000000000000000000000001')
})
it.each(['identity', 'month', 'period', 'column', 'old_caption', 'query_policy', 'quality_policy', 'empty_policy', 'unit', 'parity', 'zero_suppression', 'native_empty', 'row_cap', 'pages_cap', 'included_rows', 'page_count', 'complete', 'has_rows', 'unknown_count', 'empty_zero', 'logical_null_nonempty', 'false_known', 'parent_vector', 'parent_hash', 'duplicate_run', 'clock', 'unsafe_file', 'rational', 'change_format'])('refuses an inconsistent %s result before any file can be exposed', kind => {
  const report = defectProductionReport(), request = createDefectProductionRequest(defectProductionCapability(), report.Month)
  if (kind === 'identity') Reflect.set(report.SourceIdentity, 'World', 'amg')
  else if (kind === 'month') report.Month = '2026-10'
  else if (kind === 'period') report.PreviousPeriod.From = '2026-07-01T00:00:00.000'
  else if (kind === 'column') report.Columns.reverse()
  else if (kind === 'old_caption') Reflect.set(report.Columns[1], 'Caption', 'Значение предыдущего периода')
  else if (kind === 'query_policy') Reflect.set(report, 'QueryPolicy', 'UnionAll')
  else if (kind === 'quality_policy') Reflect.set(report, 'QualityPolicy', 'TitleGuess')
  else if (kind === 'empty_policy') Reflect.set(report, 'EmptyQueryPolicy', 'EmptyZero')
  else if (kind === 'unit') Reflect.set(report, 'ResultUnit', 'Percent')
  else if (kind === 'parity') Reflect.set(report, 'SourceParityVerified', true)
  else if (kind === 'zero_suppression') Reflect.set(report, 'NativeVirtualTableZeroSuppressionVerified', true)
  else if (kind === 'native_empty') Reflect.set(report, 'NativeEmptyQueryRowsVerified', true)
  else if (kind === 'row_cap') report.Proof.Publications[0].PhysicalRows = 200001
  else if (kind === 'pages_cap') report.Proof.Publications[0].PagesPerPass = 783
  else if (kind === 'included_rows') report.Inputs.Current.IncludedRows = 2
  else if (kind === 'page_count') report.Proof.Publications[0].PagesPerPass = 2
  else if (kind === 'complete') report.Complete = false
  else if (kind === 'has_rows') report.HasRows = false
  else if (kind === 'unknown_count') { report.Inputs.Current.Available = false; report.Inputs.Current.IncludedRows = 0 }
  else if (kind === 'empty_zero') { Object.assign(report, defectProductionEmptyReport()); report.Cells[0] = defectProductionZeroReport().Cells[0] }
  else if (kind === 'logical_null_nonempty') report.Cells[0] = defectProductionEmptyReport().Cells[0]
  else if (kind === 'false_known') { Object.assign(report, defectProductionUnknownCurrentReport()); report.Cells[0] = defectProductionReport().Cells[0] }
  else if (kind === 'parent_vector') report.Proof.Publications.reverse()
  else if (kind === 'parent_hash') report.Proof.Publications[0].CompletePassSha256 = 'wrong'
  else if (kind === 'duplicate_run') report.Proof.Publications[1].RunId = report.Proof.Publications[0].RunId
  else if (kind === 'clock') report.ObservationStartedAtUtc = '2026-02-30T00:00:00.0000000Z'
  else if (kind === 'unsafe_file') report.DocumentURL = 'javascript:alert(1)'
  else if (kind === 'rational') report.Cells[0].ExactValue = { Numerator: '1', Denominator: '0' }
  else report.Cells[2].FormattedValue = '-50'
  expect(() => normalizeDefectProductionReport(report, request)).toThrow('непідтверджений результат')
})
it('never turns unavailable capabilities on and refuses duplicate catalogue worlds or extra filters', () => {
  const capability = defectProductionCapability(); capability.RuntimeImplemented = false
  expect(() => createDefectProductionRequest(capability, '2026-09')).toThrow('Сервер не підтвердив')
  expect(capability.RuntimeImplemented).toBe(false)
  expect(isDefectProductionCatalogueEntry({ ...defectProductionCatalogueEntry(), Sources: [...defectProductionCatalogueEntry().Sources, ...defectProductionCatalogueEntry().Sources] })).toBe(false)
  Reflect.set(capability, 'Filters', ['Month', 'Buyer']); expect(isDefectProductionCapabilities(capability)).toBe(false)
})
it('refuses a different request identity or capability dataset alias without reconstructing it', () => {
  const report = defectProductionReport(), request = createDefectProductionRequest(defectProductionCapability(), report.Month)
  Reflect.set(request.SourceIdentity, 'SourceId', 'dataset22'); expect(() => normalizeDefectProductionReport(report, request)).toThrow()
  const capability = defectProductionCapability(); Reflect.set(capability, 'InputBasis', 'EmployeeCost6')
  expect(isDefectProductionCapabilities(capability)).toBe(false)
})

it('preserves prior logical NULL and its server change independently from current unknown quality', () => {
  const report = defectProductionUnknownCurrentNullPreviousReport()
  expect(normalizeDefectProductionReport(report, createDefectProductionRequest(defectProductionCapability(), report.Month))).toBe(report)
  expect(report.Cells.map(cell => cell.FormattedValue)).toEqual([null, null, '100.00', null])
  expect(report.Cells[0].Available).toBe(false); expect(report.Cells[1].Available).toBe(true)
})
it('refuses an unavailable change in a confirmed empty scalar rather than fabricating a projection failure', () => {
  const report = defectProductionEmptyReport(); report.Code = 'decimal_projection_unavailable'
  report.Cells[2] = { ...report.Cells[2], Available: false, Value: null, FormattedValue: null, ExactValue: null }
  expect(() => normalizeDefectProductionReport(report, createDefectProductionRequest(defectProductionCapability(), report.Month))).toThrow()
})
