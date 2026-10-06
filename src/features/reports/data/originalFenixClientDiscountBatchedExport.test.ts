import { expect, it, vi } from 'vitest'
import { fenixResult } from '../testing/originalFenixClientDiscountsFixtures'
import { fenixDiscountCsv, fenixDiscountCsvBlob, fenixDiscountExportError, fenixDiscountPdfDefinition, fenixDiscountXlsx } from './originalFenixClientDiscountsExport'
const writer = vi.hoisted(() => ({ book_new: vi.fn(() => ({})), aoa_to_sheet: vi.fn(() => ({})), sheet_add_aoa: vi.fn(), book_append_sheet: vi.fn(), write: vi.fn(() => new ArrayBuffer(0)) }))
vi.mock('xlsx', () => ({ utils: writer, write: writer.write }))
function resultWithRows(count: number) { const result = fenixResult(), row = result.Cells[0]; result.Cells = Array.from({ length: count }, (_, i) => ({ ...row, Product: (i + 1).toString(16).toUpperCase().padStart(32, '0'), ProductName: `P${i + 1}` })); return result }
it('large complete292266-row default no longer hits the former1M-cell CSV/XLSX guard and never enables a shortened PDF', () => {
  const result = resultWithRows(292266); expect(fenixDiscountExportError(result, 'csv')).toBeNull(); expect(fenixDiscountExportError(result, 'xlsx')).toBeNull()
  expect(fenixDiscountExportError(result, 'pdf')).toMatch(/CSV та XLSX/); expect(() => fenixDiscountPdfDefinition(result)).toThrow(/PDF/)
  expect(result.Cells).toHaveLength(292266)
})
it('batched CSV bytes equal the existing complete lossless export including formula protection and exact signed text', async () => {
  const result = resultWithRows(1201); result.Cells[1].ProductName = '=SUM(A1)'; result.Cells[1200].ProductName = 'final retained row'
  const bytes = new Uint8Array(await (await fenixDiscountCsvBlob(result)).arrayBuffer())
  expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); expect(bytes).toEqual(new TextEncoder().encode(fenixDiscountCsv(result))); expect(result.Cells).toHaveLength(1201)
})
it('XLSX batches include every292266 row with at most1000 formatted rows per writer call and the final row intact', async () => {
  vi.clearAllMocks(); const result = resultWithRows(292266); await fenixDiscountXlsx(result)
  const calls = writer.sheet_add_aoa.mock.calls as unknown as [unknown, string[][], { origin: number }][]
  expect(calls.reduce((sum, c) => sum + c[1].length, 0)).toBe(292266); expect(calls.every(c => c[1].length <= 1000 && c[2].origin === -1)).toBe(true)
  expect(calls.at(-1)![1].at(-1)![1]).toBe('P292266'); expect(writer.write).toHaveBeenCalledTimes(1)
})
it('caller cancellation between batches prevents final CSV/XLSX output rather than dropping remaining rows', async () => {
  const result = resultWithRows(12001), csvCaller = new AbortController(), csv = fenixDiscountCsvBlob(result, csvCaller.signal); csvCaller.abort()
  await expect(csv).rejects.toMatchObject({ name: 'AbortError' })
  vi.clearAllMocks(); const xlsxCaller = new AbortController(), xlsx = fenixDiscountXlsx(result, xlsxCaller.signal); xlsxCaller.abort()
  await expect(xlsx).rejects.toMatchObject({ name: 'AbortError' }); expect(writer.write).not.toHaveBeenCalled()
})
it('keeps an explicit500000-row own bound and refuses complete-but-oversized output rather than truncating', () => {
  const result = resultWithRows(1); result.Cells = new Array(500001).fill(result.Cells[0])
  expect(fenixDiscountExportError(result, 'csv')).toMatch(/500 000/); expect(fenixDiscountExportError(result, 'xlsx')).toMatch(/500 000/)
})
