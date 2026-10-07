import { expect, it } from 'vitest'
import { stockRequest, stockDefaultRows } from './originalStockAvailability'
import { stockCapabilityFixture, stockRequestFixture, stockResultFixture } from './originalStockAvailability.fixtures'
import { stockAvailabilitySheet, stockCompleteExport } from './originalStockAvailabilityExport'
import { defaultSheetCsv } from './originalDefaultReportExport'
it('exports whole native ordered table with exact point and captions; no browser totals or opaque keys', () => {
  const result = stockResultFixture(), sheet = stockAvailabilitySheet(result), csv = defaultSheetCsv(sheet)
  expect(sheet.headers).toHaveLength(8); expect(sheet.lines[0].cells.slice(0, 2)).toEqual(['Наш склад', 'Наш товар']); expect(sheet.total).toBeNull()
  expect(csv).toContain('2026-10-06 12:34:56'); expect(csv).not.toContain('Період:'); expect(csv).not.toContain('b'.repeat(64)); expect(stockCompleteExport(result)).toBe(true)
})
it('selected nullable conversion displays unknown and forbids complete export without erasing six raw defaults', () => {
  const request = stockRequest(stockCapabilityFixture(), stockRequestFixture().At, [...stockDefaultRows], ['stock', 'reportStock'], []), result = stockResultFixture(request)
  result.Available = false; result.Data[0].Values.reportStock = null
  expect(stockAvailabilitySheet(result).lines[0].cells.slice(-2)).toEqual(['10.000', 'Недоступно']); expect(stockCompleteExport(result)).toBe(false)
  expect(stockCompleteExport(stockResultFixture())).toBe(true)
})
it('whole export preserves all rows beyond first50 display without multiplying quantities or label formulas', () => {
  const result = stockResultFixture(); result.Data = Array.from({ length: 73 }, (_, i) => ({ ...result.Data[0], Key: [{ ...result.Data[0].Key[0], Caption: `=Склад ${i}` }, result.Data[0].Key[1]] }))
  const sheet = stockAvailabilitySheet(result), csv = defaultSheetCsv(sheet)
  expect(sheet.lines).toHaveLength(73); expect(csv).toContain("'=Склад 72"); expect(sheet.lines[72].cells[2]).toBe('10.000')
})
