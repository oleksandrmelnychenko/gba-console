import { expect, it } from 'vitest'
import { isStockCapability, stockDateError, stockDateInput, stockDefaultRows, stockDefaults, stockMeasures, stockRequest, stockCatalogueMatches, stockDefinition } from './originalStockAvailability'
import { stockCapabilityFixture, stockRequestFixture, stockResultFixture, stockNumberFixture } from './originalStockAvailability.fixtures'
import { normalizeStockResult, readStockNumber } from './originalStockAvailabilityResponse'
import type { ReportCatalogueEntry } from '../types'
it('defaultWarehouse then Product retains six raw measures even optional unit names and conversions are absent', () => {
  const request = stockRequestFixture(), result = normalizeStockResult(stockResultFixture(request), request)
  expect(request.Rows).toEqual(stockDefaultRows); expect(request.Measures).toEqual(stockDefaults); expect(stockMeasures).toHaveLength(18)
  expect(result.Available).toBe(true); expect(result.Choices.quality).toEqual([]); expect(result.Choices.basisDocument).toEqual([])
  expect(isStockCapability(stockCapabilityFixture())).toBe(true)
})
it.each(['2026-10-06T12:34:56Z', '2026-10-06 12:34:56.000', '2026-02-29 12:00:00', '1999-12-31 23:59:59', '2100-01-01 00:00:00', '2026-10-06 24:00:00'])('refuses invalid or adapted DateKon %s before dispatch', at => {
  expect(stockDateError(at)).not.toBeNull(); expect(() => stockRequest(stockCapabilityFixture(), at, [...stockDefaultRows], [...stockDefaults], [])).toThrow()
})
it('explicit local seconds stay exact without year offset timezone or end-of-day adaptation', () => {
  expect(stockDateError('2028-02-29 00:00:00')).toBeNull(); expect(stockDateInput('2026-10-06T12:34')).toBe('2026-10-06 12:34:00')
  expect(stockDateInput('2026-10-06T12:34:56')).toBe('2026-10-06 12:34:56')
})
it('opaque same-field AND filters are single exact issued keys and request detaches caller arrays', () => {
  const filters = [{ Field: 'product' as const, Key: 'b'.repeat(64) }], rows = [...stockDefaultRows], measures = [...stockDefaults]
  const request = stockRequest(stockCapabilityFixture(), '2026-10-06 12:34:56', rows, measures, filters)
  filters[0].Key = 'c'.repeat(64); rows.reverse(); expect(request.Filters[0].Key).toBe('b'.repeat(64)); expect(request.Rows).toEqual(stockDefaultRows)
  expect(() => stockRequest(stockCapabilityFixture(), request.At, request.Rows, request.Measures, [...request.Filters, ...request.Filters])).toThrow()
  expect(() => stockRequest(stockCapabilityFixture(), request.At, request.Rows, request.Measures, [{ Field: 'product', Key: 'A'.repeat(32) }])).toThrow()
})
it('unknown selected report-unit value preserves all observed raw quantities and never becomes zero', () => {
  const request = stockRequest(stockCapabilityFixture(), stockRequestFixture().At, [...stockDefaultRows], ['stock', 'reportStock'], []), wire = stockResultFixture(request)
  wire.Available = false; wire.Code = 'original_stock_availability_unit_mapping_unavailable'; wire.Data[0].Values.reportStock = null
  const result = normalizeStockResult(wire, request); expect(result.Data[0].Values.stock?.Display).toBe('10.000'); expect(result.Data[0].Values.reportStock).toBeNull()
})
it('selected optional missing caption refuses only that requested axis while six default result remains available', () => {
  const request = stockRequest(stockCapabilityFixture(), stockRequestFixture().At, ['quality'], [...stockDefaults], []), wire = { ...stockResultFixture(), ...request, Available: false, Code: 'original_stock_availability_quality_caption_unavailable', Data: [] }
  expect(normalizeStockResult(wire, request).Available).toBe(false)
  expect(normalizeStockResult(stockResultFixture(), stockRequestFixture()).Available).toBe(true)
})
it('large rationals negative half-away rounding null and exact zero stay lossless; forged display refuses', () => {
  expect(readStockNumber(stockNumberFixture('9007199254740993001'))?.Numerator).toBe('9007199254740993001')
  expect(readStockNumber({ Numerator: '-1', Denominator: '2000', Display: '-0.001' })?.Display).toBe('-0.001')
  expect(readStockNumber(stockNumberFixture('0'))?.Display).toBe('0.000'); expect(readStockNumber(null)).toBeNull()
  expect(() => readStockNumber({ Numerator: '1', Denominator: '3', Display: '0.334' })).toThrow()
})
it('stale filters groups duplicate keys altered captions and unavailable snapshot data are refused', () => {
  const request = stockRequestFixture(), result = stockResultFixture(request)
  expect(() => normalizeStockResult({ ...result, Filters: [{ Field: 'product', Key: 'c'.repeat(64) }] }, request)).toThrow()
  expect(() => normalizeStockResult({ ...result, Data: [...result.Data, ...result.Data] }, request)).toThrow()
  expect(() => normalizeStockResult({ ...result, Data: [{ ...result.Data[0], Key: [{ ...result.Data[0].Key[0], Caption: 'Інша назва' }, result.Data[0].Key[1]] }] }, request)).toThrow()
  expect(() => normalizeStockResult({ ...result, Available: false, OurSnapshotVerified: false }, request)).toThrow()
})
it('only exact original source definition in Fenix catalogue can launch', () => {
  const report: ReportCatalogueEntry = { Id: `builtin:${stockDefinition.name}`, Name: stockDefinition.name, Title: '', Kind: 'builtin', Sources: [{ World: 'fenix', SourceId: stockDefinition.source, DefinitionSha256: stockDefinition.definition, Attributes: [] }] }
  expect(stockCatalogueMatches(report, ['fenix'])).toBe(true); expect(stockCatalogueMatches(report, ['amg'])).toBe(false)
  expect(stockCatalogueMatches({ ...report, Id: 'builtin:ТоварыНаСкладах' }, ['fenix'])).toBe(false)
})
