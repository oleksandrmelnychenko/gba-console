import { expect, it } from 'vitest'
import { fenixDiscountDisplayPage } from './originalFenixClientDiscountDisplay'
import { fenixDiscountMatrix } from './originalFenixClientDiscountsExport'
import { fenixResult } from '../testing/originalFenixClientDiscountsFixtures'
function complete(count: number) { const result = fenixResult(); result.Cells = Array.from({ length: count }, (_, i) => ({ ...result.Cells[0], Product: (i + 1).toString(16).toUpperCase().padStart(32, '0'), ProductName: `Product ${i + 1}` })); return result }
it('maps only50 current display rows while the complete verified result stays untouched for export', () => {
  const result = complete(121), digest = result.ResultSha256, shown = fenixDiscountDisplayPage(result.Cells, 1)
  expect(shown.lines).toHaveLength(50); expect(shown.total).toBe(121); expect(shown.lines[0].cells[1]).toBe('Product 51'); expect(shown.lines[49].cells[1]).toBe('Product 100')
  expect(result.Cells).toHaveLength(121); expect(result.ResultSha256).toBe(digest); expect(fenixDiscountMatrix(result)).toHaveLength(122)
})
it('reaches last and complete empty display pages without clipping full result or inventing totals', () => {
  const result = complete(121), last = fenixDiscountDisplayPage(result.Cells, 99); expect(last.current).toBe(2); expect(last.lines).toHaveLength(21)
  expect(last.lines[20].cells[1]).toBe('Product 121'); expect(fenixDiscountDisplayPage([], 4)).toMatchObject({ current: 0, start: 0, total: 0, lines: [] })
})
it('refuses malformed page numbers and preserves exact signed numeric text', () => {
  const result = complete(1); for (const page of [-1, 0.5, Number.NaN]) expect(() => fenixDiscountDisplayPage(result.Cells, page)).toThrow()
  expect(fenixDiscountDisplayPage(result.Cells, 0).lines[0].cells[3]).toBe('-12.34')
})
it('large display accesses only its visible cells rather than eagerly transforming323359 rows', () => {
  const base = fenixResult().Cells[0], cells = new Array(323359).fill(base), shown = fenixDiscountDisplayPage(cells, 6467)
  expect(shown.total).toBe(323359); expect(shown.lines).toHaveLength(9); expect(cells).toHaveLength(323359)
})
