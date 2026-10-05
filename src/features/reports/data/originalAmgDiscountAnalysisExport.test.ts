import { expect, it, vi } from 'vitest'
import { amgEmpty, amgMissing, amgProduct, amgResult, amgUnresolved } from '../testing/originalAmgDiscountAnalysisFixtures'
import { amgDiscountAnalysisCsv, amgDiscountAnalysisMatrix, amgDiscountAnalysisPdfDefinition, amgDiscountAnalysisXlsx } from './originalAmgDiscountAnalysisExport'
const xlsx = vi.hoisted(() => ({ book_new: vi.fn(() => ({})), aoa_to_sheet: vi.fn((v: unknown) => v), book_append_sheet: vi.fn(), write: vi.fn(() => new ArrayBuffer(0)) }))
vi.mock('xlsx', () => ({ utils: xlsx, write: xlsx.write }))
it('exports own default matrix with both resources and exact signed numeric strings without totals or raw keys', () => {
  const result = amgResult(), matrix = amgDiscountAnalysisMatrix(result)
  expect(matrix).toEqual([['Контрагент', 'Товар AMG · Тип ціни', 'Товар AMG · Відсоток знижки/націнки'], ['Клієнт AMG', 'Роздрібна', '-12.340']])
  expect(amgDiscountAnalysisCsv(result)).toContain('"-12.340"'); expect(JSON.stringify(matrix)).not.toContain(amgProduct)
})
it('keeps missing cross-products blank and never calculates a matrix sum', () => {
  const result = amgResult(), next = structuredClone(result.Cells[0]); next.ProductRef = 'A'.repeat(32); next.ProductCaption = 'Другий товар'
  next.CounterpartyRef = '9'.repeat(32); next.CounterpartyCaption = 'Другий клієнт'; next.Percentage = '0.000'; result.Cells.push(next)
  expect(amgDiscountAnalysisMatrix(result).slice(1)).toEqual([['Клієнт AMG', 'Роздрібна', '-12.340', '', ''], ['Другий клієнт', '', '', 'Роздрібна', '0.000']])
})
it('preserves formula-like reference captions as text while signed numeric percentages remain exact', () => {
  const result = amgResult(); result.Cells[0].Percentage = null; result.Cells[0].PercentageRef = '7'.repeat(32); result.Cells[0].PercentageReferenceCaption = '=Ціна'
  expect(amgDiscountAnalysisCsv(result)).toContain('"\'=Ціна"'); expect(amgDiscountAnalysisMatrix(result)[1][2]).toBe('=Ціна')
})
it('allows complete empty exports but refuses missing input and unresolved resources', () => {
  expect(amgDiscountAnalysisMatrix(amgEmpty())).toEqual([['Контрагент']])
  expect(() => amgDiscountAnalysisMatrix(amgMissing())).toThrow(); expect(() => amgDiscountAnalysisMatrix(amgUnresolved())).toThrow()
})
it('uses the same immutable completed matrix for XLSX and PDF and rejects changed snapshot proof', async () => {
  vi.clearAllMocks(); const result = amgResult(), matrix = amgDiscountAnalysisMatrix(result); await amgDiscountAnalysisXlsx(result)
  expect(xlsx.aoa_to_sheet).toHaveBeenCalledWith(matrix); expect(JSON.stringify(amgDiscountAnalysisPdfDefinition(result))).toContain(JSON.stringify(matrix))
  expect(() => amgDiscountAnalysisMatrix({ ...result, OurSnapshotVerified: false })).toThrow()
})
it('refuses an oversized complete matrix without trimming the offered product columns', () => {
  const result = amgResult(); result.Cells = Array.from({ length: 8192 }, (_, i) => ({ ...structuredClone(result.Cells[0]),
    ProductRef: (i + 1).toString(16).toUpperCase().padStart(32, '0'), ProductCaption: `Товар ${i + 1}` }))
  expect(() => amgDiscountAnalysisMatrix(result)).toThrow(/16 384/); expect(result.Cells).toHaveLength(8192)
})
