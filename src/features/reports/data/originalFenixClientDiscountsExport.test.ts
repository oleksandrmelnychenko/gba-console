import { expect, it, vi } from 'vitest'
import { fenixEmpty, fenixMissing, fenixResult } from '../testing/originalFenixClientDiscountsFixtures'
import { fenixDiscountCsv, fenixDiscountMatrix, fenixDiscountPdfDefinition, fenixDiscountXlsx } from './originalFenixClientDiscountsExport'
const xlsx = vi.hoisted(() => ({ book_new: vi.fn(() => ({})), aoa_to_sheet: vi.fn((v: unknown) => v), book_append_sheet: vi.fn(), write: vi.fn(() => new ArrayBuffer(0)) }))
vi.mock('xlsx', () => ({ utils: xlsx, write: xlsx.write }))
it('uses completed authentic names and exact signed percentage without sums or raw keys', () => {
  const matrix = fenixDiscountMatrix(fenixResult()); expect(matrix[1]).toEqual(['Клієнт FENIX', 'Товар FENIX', 'Київ', '-12.34'])
  expect(matrix).toHaveLength(2); expect(fenixDiscountCsv(fenixResult())).toContain('"-12.34"'); expect(JSON.stringify(matrix)).not.toContain('2'.repeat(32))
})
it('allows complete empty exports and refuses missing or malformed completed results', () => {
  expect(fenixDiscountMatrix(fenixEmpty())).toHaveLength(1); expect(() => fenixDiscountMatrix(fenixMissing())).toThrow()
  expect(() => fenixDiscountMatrix({ ...fenixResult(), MaximumPercentage: '999.99' })).toThrow()
})
it('escapes human CSV formula prefixes while preserving signed numeric cells', () => {
  const v = fenixResult(); v.Cells[0].ProductName = '=SUM(A1)'; expect(fenixDiscountCsv(v)).toContain('"\'=SUM(A1)"'); expect(fenixDiscountCsv(v)).toContain('"-12.34"')
})
it('shares the same exact completed matrix in XLSX and PDF', async () => {
  vi.clearAllMocks(); const result = fenixResult(), matrix = fenixDiscountMatrix(result); await fenixDiscountXlsx(result)
  expect(xlsx.aoa_to_sheet).toHaveBeenCalledWith(matrix)
  expect(JSON.stringify(fenixDiscountPdfDefinition(result))).toContain(JSON.stringify(matrix))
})
