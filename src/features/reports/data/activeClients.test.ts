import { expect, it } from 'vitest'
import {
  activeClientsCellText,
  activeClientsMonthError,
  activeClientsPeriods,
  createActiveClientsRequest,
  isActiveClientsCapabilities,
  isActiveClientsCatalogueEntry,
  normalizeActiveClientsReport,
} from './activeClients'
import { activeClientsCapability, activeClientsCatalogueEntry, activeClientsReport } from './activeClients.test-fixtures'
import { debtRatioCapability } from './debtToSalesRatio.test-fixtures'

it('uses the exact original identity and separate capability without native aliases or source-parity promotion', () => {
  const entry = activeClientsCatalogueEntry(), capability = activeClientsCapability()
  expect(isActiveClientsCatalogueEntry(entry)).toBe(true)
  expect(isActiveClientsCapabilities(capability)).toBe(true)
  expect(isActiveClientsCapabilities(debtRatioCapability())).toBe(false)
  expect(isActiveClientsCapabilities({ ...capability, IdentityBasis: 'SourceCounterparty' })).toBe(false)
  expect(isActiveClientsCapabilities({ ...capability, Filters: [{ Type: 9 }] })).toBe(false)
  expect(isActiveClientsCapabilities({ ...capability, SourceIdentity: { ...capability.SourceIdentity, DefinitionSha256: 'c'.repeat(64) } })).toBe(false)
  entry.Sources[0].World = 'amg'
  expect(isActiveClientsCatalogueEntry(entry)).toBe(false)
})

it('binds only the selected calendar month including previous-year offset minus one', () => {
  const request = createActiveClientsRequest(activeClientsCapability(), '2026-01')
  expect(Object.keys(request)).toEqual(['Version', 'SourceIdentity', 'Month'])
  expect(activeClientsPeriods(request.Month)).toEqual({
    CurrentPeriod: { From: '2026-01-01', ThroughExclusive: '2026-02-01' },
    PreviousPeriod: { From: '2025-12-01', ThroughExclusive: '2026-01-01' },
  })
  expect(activeClientsMonthError('0001-02')).toBeNull()
  for (const month of ['0001-01', '9999-12', '2026-13', '2026-09-01']) expect(activeClientsMonthError(month)).not.toBeNull()
  expect(() => createActiveClientsRequest({ ...activeClientsCapability(), Executable: false }, '2026-09')).toThrow()
})

it('preserves an observed empty count of zero and the source zero-previous percent of 100', () => {
  const response = activeClientsReport()
  for (const input of Object.values(response.Inputs)) Object.assign(input, {
    EligibleSaleLines: 0, EligibleReturnLines: 0, UnattributedLines: 0, DistinctClients: 0,
  })
  response.Cells.forEach((cell, index) => { cell.Value = index === 2 ? '100' : '0' })
  expect(normalizeActiveClientsReport(response, createActiveClientsRequest(activeClientsCapability(), '2026-09'))).toBe(response)
  expect(response.Cells.map(cell => activeClientsCellText(cell.Value, null))).toEqual(['0', '0', '100', '0'])
})

it('keeps missing attribution NULL while retaining a server-known zero-previous percentage', () => {
  const response = activeClientsReport()
  Object.assign(response.Inputs.Current, { Available: false, UnattributedLines: 1, DistinctClients: null, Code: 'client_attribution_unavailable' })
  Object.assign(response.Inputs.Previous, { EligibleSaleLines: 0, EligibleReturnLines: 0, DistinctClients: 0 })
  response.Cells.forEach((cell, index) => { cell.Value = index === 1 ? '0' : index === 2 ? '100' : null; cell.Available = cell.Value !== null })
  const normalized = normalizeActiveClientsReport(response, createActiveClientsRequest(activeClientsCapability(), '2026-09'))
  expect(normalized.Cells.map(cell => cell.Value)).toEqual([null, '0', '100', null])
  expect(activeClientsCellText(normalized.Cells[0].Value, null)).toBe('—')
})

it('formats raw percent precision only for display and preserves server values and both file bindings', () => {
  const response = activeClientsReport(), raw = response.Cells[2].Value
  const binding = [response.RequestSha256, response.ResultSha256, response.DocumentURL, response.PdfDocumentURL]
  expect(normalizeActiveClientsReport(response, createActiveClientsRequest(activeClientsCapability(), '2026-09'))).toBe(response)
  expect(activeClientsCellText(raw, 2)).toBe('33,33')
  expect(activeClientsCellText('9.995', 2)).toBe('10,00')
  expect(activeClientsCellText('-0.005', 2)).toBe('-0,01')
  expect(response.Cells[2].Value).toBe(raw)
  expect([response.RequestSha256, response.ResultSha256, response.DocumentURL, response.PdfDocumentURL]).toEqual(binding)
})

it('refuses mismatched source, month, period, ordered columns or missing-attribution zero coercion', () => {
  const response = activeClientsReport(), request = createActiveClientsRequest(activeClientsCapability(), '2026-09')
  for (const changed of [
    { ...response, SourceIdentity: debtRatioCapability().SourceIdentity },
    { ...response, Month: '2026-08' },
    { ...response, PreviousPeriod: response.CurrentPeriod },
    { ...response, Columns: [...response.Columns].reverse() },
    { ...response, Inputs: { ...response.Inputs, Current: { ...response.Inputs.Current, Available: false, DistinctClients: 0 } } },
    { ...response, Cells: response.Cells.map((cell, index) => index === 2 ? { ...cell, Value: '33e-2' } : cell) },
  ]) expect(() => normalizeActiveClientsReport(changed, request)).toThrow()
})
