import { expect, it } from 'vitest'
import {
  createDebtToSalesRatioRequest,
  debtToSalesRatioCellText,
  debtToSalesRatioMonthError,
  debtToSalesRatioPeriods,
  isDebtToSalesRatioCapabilities,
  isDebtToSalesRatioCatalogueEntry,
  normalizeDebtToSalesRatioReport,
} from './debtToSalesRatio'
import { debtRatioCapability, debtRatioCatalogueEntry, debtRatioReport } from './debtToSalesRatio.test-fixtures'

it('matches original source identity without promoting captured metadata to executable capability', () => {
  const entry = debtRatioCatalogueEntry()
  expect(isDebtToSalesRatioCatalogueEntry(entry)).toBe(true)
  entry.Sources[0].World = 'amg'
  expect(isDebtToSalesRatioCatalogueEntry(entry)).toBe(false)
  const capability = debtRatioCapability()
  expect(isDebtToSalesRatioCapabilities(capability)).toBe(true)
  expect(isDebtToSalesRatioCapabilities({ ...capability, SourceIdentity: { ...capability.SourceIdentity, DefinitionSha256: 'c'.repeat(64) } })).toBe(false)
  expect(isDebtToSalesRatioCapabilities({ ...capability, Filters: [{ Type: 9, Name: 'Agreement' }] })).toBe(false)
  expect(() => createDebtToSalesRatioRequest({ ...capability, Executable: false }, '2026-09')).toThrow('Сервер не підтвердив')
})

it('uses calendar months including year boundaries with no business date cutoff', () => {
  expect(debtToSalesRatioPeriods('2026-01')).toEqual({
    CurrentPeriod: { From: '2026-01-01', ThroughExclusive: '2026-02-01' },
    PreviousPeriod: { From: '2025-12-01', ThroughExclusive: '2026-01-01' },
  })
  expect(debtToSalesRatioMonthError('1753-02')).toBeNull()
  expect(debtToSalesRatioMonthError('0001-02')).toBeNull()
  expect(debtToSalesRatioMonthError('0001-01')).not.toBeNull()
  expect(debtToSalesRatioMonthError('9999-12')).not.toBeNull()
  expect(debtToSalesRatioMonthError('2026-13')).not.toBeNull()
  expect(debtToSalesRatioMonthError('2026-09-01')).not.toBeNull()
})

it('retains four unavailable NULL cells and exact decimal strings without client-side calculations', () => {
  const request = createDebtToSalesRatioRequest(debtRatioCapability(), '2026-09')
  const response = debtRatioReport()
  response.Cells[0].Value = '12345678901234567890.12345678'
  expect(normalizeDebtToSalesRatioReport(response, request).Cells[0].Value).toBe('12345678901234567890.12345678')
  expect(debtToSalesRatioCellText(response.Cells[0].Value, null)).toBe('12345678901234567890,12345678')
  expect(debtToSalesRatioCellText('0', 2)).toBe('0,00')
  response.Cells = response.Cells.map(cell => ({ ...cell, Available: false, Value: null }))
  for (const input of Object.values(response.Inputs)) { input.Available = false; input.RunId = null; input.Code = 'coverage_missing' }
  expect(normalizeDebtToSalesRatioReport(response, request).Cells.map(cell => cell.Value)).toEqual([null, null, null, null])
  expect(debtToSalesRatioCellText(null, 2)).toBe('—')
})

it('refuses a reordered shape or files bound to another source/month', () => {
  const request = createDebtToSalesRatioRequest(debtRatioCapability(), '2026-09')
  const response = debtRatioReport()
  expect(() => normalizeDebtToSalesRatioReport({ ...response, Month: '2026-08' }, request)).toThrow('інший місячний період')
  expect(() => normalizeDebtToSalesRatioReport({ ...response, SourceIdentity: { ...response.SourceIdentity, SourceId: 'other' } }, request)).toThrow()
  expect(() => normalizeDebtToSalesRatioReport({ ...response, PreviousPeriod: response.CurrentPeriod }, request)).toThrow()
  expect(() => normalizeDebtToSalesRatioReport({ ...response, Columns: [...response.Columns].reverse() }, request)).toThrow()
  response.Cells[2].Value = '25e-3'
  expect(() => normalizeDebtToSalesRatioReport(response, request)).toThrow()
})

it('accepts raw fractional percentages and rounds only display while preserving result and export bindings', () => {
  const request = createDebtToSalesRatioRequest(debtRatioCapability(), '2026-09')
  const response = debtRatioReport()
  const binding = [response.RequestSha256, response.ResultSha256, response.DocumentURL, response.PdfDocumentURL]
  for (const [raw, display] of [
    ['25.001', '25,00'],
    ['21.238938053097345132743362832', '21,24'],
  ]) {
    response.Cells[2].Value = raw
    expect(normalizeDebtToSalesRatioReport(response, request)).toBe(response)
    expect(debtToSalesRatioCellText(response.Cells[2].Value, 2)).toBe(display)
    expect(response.Cells[2].Value).toBe(raw)
    expect([response.RequestSha256, response.ResultSha256, response.DocumentURL, response.PdfDocumentURL]).toEqual(binding)
  }
})

it('rounds signed decimal display halfway away from zero with exact carry and no binary number conversion', () => {
  for (const [raw, display] of [
    ['0.005', '0,01'],
    ['-0.005', '-0,01'],
    ['1.005', '1,01'],
    ['-1.005', '-1,01'],
    ['-25.001', '-25,00'],
    ['9.995', '10,00'],
    ['-9.995', '-10,00'],
    ['1.0049999999999999999999999999', '1,00'],
    ['12345678901234567890.995', '12345678901234567891,00'],
  ]) expect(debtToSalesRatioCellText(raw, 2)).toBe(display)
})

it('does not reject server-known zero cells because a separate debt input is unavailable', () => {
  const request = createDebtToSalesRatioRequest(debtRatioCapability(), '2026-09')
  const response = debtRatioReport()
  for (const name of ['CurrentDebt', 'PreviousDebt'] as const)
    response.Inputs[name] = { Available: false, RunId: null, ActiveRows: 0, IncludedRows: 0, UnknownKindRows: 0, Code: 'period_not_published' }
  response.Cells.forEach((cell, index) => { cell.Value = index === 2 ? '100' : '0'; cell.Available = true })
  expect(normalizeDebtToSalesRatioReport(response, request).Cells.map(cell => cell.Value)).toEqual(['0', '0', '100', '0'])
})
