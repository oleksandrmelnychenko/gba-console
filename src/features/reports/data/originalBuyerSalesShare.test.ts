import { expect, it } from 'vitest'
import { originalBuyerSalesShareCatalogueVariant, originalBuyerSalesShareCellText, originalBuyerSalesShareMonthError, originalBuyerSalesSharePeriods,
  createOriginalBuyerSalesShareRequest, isOriginalBuyerSalesShareCapabilities, normalizeOriginalBuyerSalesShareReport } from './originalBuyerSalesShare'
import { originalBuyerSalesShareCapability, originalBuyerSalesShareCatalogueEntry, originalBuyerSalesShareReport } from './originalBuyerSalesShare.test-fixtures'
const variants = ['new', 'repeat'] as const
it.each(variants)('%s uses its exact source identity and capability, without a native17 or percent-base alias', variant => {
  const cap = originalBuyerSalesShareCapability(variant), entry = originalBuyerSalesShareCatalogueEntry(variant)
  expect(originalBuyerSalesShareCatalogueVariant(entry)).toBe(variant)
  expect(isOriginalBuyerSalesShareCapabilities(cap, variant)).toBe(true)
  expect(isOriginalBuyerSalesShareCapabilities(originalBuyerSalesShareCapability(variant === 'new' ? 'repeat' : 'new'), variant)).toBe(false)
  for (const changed of [{ ...cap, BaseFractionIsPercent: true }, { ...cap, SourceParityVerified: true },
    { ...cap, HistoryBasis: 'SelectedMonthOnly' }, { ...cap, Filters: [9] },
    { ...cap, SourceIdentity: { ...cap.SourceIdentity, DefinitionSha256: 'c'.repeat(64) } }])
    expect(isOriginalBuyerSalesShareCapabilities(changed)).toBe(false)
  entry.Sources[0].World = 'amg'; expect(originalBuyerSalesShareCatalogueVariant(entry)).toBeNull()
})
it.each(variants)('%s binds Month only, previous calendar month and the genuine representable request limits', variant => {
  const request = createOriginalBuyerSalesShareRequest(originalBuyerSalesShareCapability(variant), '2026-01')
  expect(Object.keys(request)).toEqual(['Version', 'SourceIdentity', 'Month'])
  expect(originalBuyerSalesSharePeriods(request.Month)).toEqual({ CurrentPeriod: { From: '2026-01-01', ThroughExclusive: '2026-02-01' },
    PreviousPeriod: { From: '2025-12-01', ThroughExclusive: '2026-01-01' } })
  for (const month of ['0001-01', '0001-02', '9999-12', '2026-13', '2026-09-01']) expect(originalBuyerSalesShareMonthError(month)).not.toBeNull()
  expect(originalBuyerSalesShareMonthError('0001-03')).toBeNull()
  expect(() => createOriginalBuyerSalesShareRequest({ ...originalBuyerSalesShareCapability(variant), Executable: false }, '2026-09')).toThrow()
})
it.each(variants)('%s preserves raw fractions and independent server grand-total cells without multiplying by100', variant => {
  const result = originalBuyerSalesShareReport('2026-09', variant), request = createOriginalBuyerSalesShareRequest(originalBuyerSalesShareCapability(variant), result.Month)
  expect(normalizeOriginalBuyerSalesShareReport(result, request)).toBe(result)
  expect(result.Cells.map(cell => originalBuyerSalesShareCellText(cell.Value, null))).toEqual(['0,25', '0,5', '-50', '-0,25'])
  expect(result.TotalCells.map(cell => cell.Value)).toEqual(['0.25', '0.5', '-50', '-0.25'])
  const raw = '33.3333333333333333333333333333'
  result.Cells[2].Value = raw; result.TotalCells[2].Value = raw
  expect(originalBuyerSalesShareCellText(raw, 2)).toBe('33,33')
  expect(normalizeOriginalBuyerSalesShareReport(result, request).Cells[2].Value).toBe(raw)
})
it.each(variants)('%s preserves observed-empty0/0/100/0 including grand totals', variant => {
  const result = originalBuyerSalesShareReport('2026-09', variant)
  for (const input of Object.values(result.Inputs)) Object.assign(input, { SaleLines: 0, ReturnLines: 0, DenominatorNetEur: '0', NumeratorNetEur: '0', RawFraction: '0', FractionIsZero: true })
  for (const cells of [result.Cells, result.TotalCells]) cells.forEach((cell, i) => { cell.Value = i === 2 ? '100' : '0' })
  expect(normalizeOriginalBuyerSalesShareReport(result, createOriginalBuyerSalesShareRequest(originalBuyerSalesShareCapability(variant), result.Month))).toBe(result)
})
it.each(variants)('%s keeps missing history NULL and the known zero-previous relative change100', variant => {
  const result = originalBuyerSalesShareReport('2026-09', variant)
  Object.assign(result.Inputs.Current, { UnknownHistoryLines: 1, NumeratorNetEur: null, RawFraction: null, FractionIsZero: null, Available: false, Code: 'current_our_input_unavailable' })
  Object.assign(result.Inputs.Previous, { NumeratorNetEur: '0', RawFraction: '0', FractionIsZero: true })
  for (const cells of [result.Cells, result.TotalCells]) cells.forEach((cell, i) => { cell.Value = i === 1 ? '0' : i === 2 ? '100' : null; cell.Available = cell.Value !== null })
  const normalized = normalizeOriginalBuyerSalesShareReport(result, createOriginalBuyerSalesShareRequest(originalBuyerSalesShareCapability(variant), result.Month))
  expect(normalized.Cells.map(cell => cell.Value)).toEqual([null, '0', '100', null])
  expect(normalized.Inputs.Current.DenominatorNetEur).toBe('200')
})
it.each(variants)('%s allows known zero-denominator fraction0 while numerator history remains unavailable', variant => {
  const result = originalBuyerSalesShareReport('2026-09', variant)
  Object.assign(result.Inputs.Current, { UnknownHistoryLines: 1, DenominatorNetEur: '0', NumeratorNetEur: null, RawFraction: '0', FractionIsZero: true })
  result.Cells[0].Value = '0'; result.TotalCells[0].Value = '0'
  expect(normalizeOriginalBuyerSalesShareReport(result, createOriginalBuyerSalesShareRequest(originalBuyerSalesShareCapability(variant), result.Month))).toBe(result)
})
it.each(variants)('%s refuses crossed identities, period/column/totals drift and invalid money availability', variant => {
  const result = originalBuyerSalesShareReport('2026-09', variant), request = createOriginalBuyerSalesShareRequest(originalBuyerSalesShareCapability(variant), result.Month)
  for (const changed of [{ ...result, SourceIdentity: originalBuyerSalesShareCapability(variant === 'new' ? 'repeat' : 'new').SourceIdentity },
    { ...result, Month: '2026-08' }, { ...result, PreviousPeriod: result.CurrentPeriod }, { ...result, Columns: [...result.Columns].reverse() },
    { ...result, TotalCells: [] }, { ...result, Inputs: { ...result.Inputs, Current: { ...result.Inputs.Current, UnknownMoneyLines: 1 } } },
    { ...result, Cells: result.Cells.map((cell, i) => i === 2 ? { ...cell, Value: '3e-2' } : cell) }])
    expect(() => normalizeOriginalBuyerSalesShareReport(changed, request)).toThrow()
})

it('retains a rounded0 fraction with genuine nonzero witness rather than forcing zero-previous change100', () => {
  const result = originalBuyerSalesShareReport()
  Object.assign(result.Inputs.Current, { UnknownMoneyLines: 1, DenominatorNetEur: null, NumeratorNetEur: null,
    RawFraction: null, FractionIsZero: null, Available: false, Code: 'current_our_input_unavailable' })
  Object.assign(result.Inputs.Previous, { DenominatorNetEur: '1000000000000', NumeratorNetEur: '0.0000000000000000000001', RawFraction: '0', FractionIsZero: false })
  for (const cells of [result.Cells, result.TotalCells]) cells.forEach((cell, i) => { cell.Value = i === 1 ? '0' : null; cell.Available = cell.Value !== null })
  expect(normalizeOriginalBuyerSalesShareReport(result, createOriginalBuyerSalesShareRequest(originalBuyerSalesShareCapability(), result.Month))).toBe(result)
  expect(result.Cells[2].Available).toBe(false)
})
