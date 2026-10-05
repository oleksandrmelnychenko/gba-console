import { expect, it, vi } from 'vitest'
import { amgEmpty, amgMissing, amgResult } from '../testing/originalAmgClientDiscountsFixtures'
import { amgDiscountCsv, amgDiscountMatrix, amgDiscountPdfDefinition, amgDiscountXlsx } from './originalAmgClientDiscountsExport'
const xlsx = vi.hoisted(() => ({ book_new: vi.fn(() => ({})), aoa_to_sheet: vi.fn((v: unknown) => v), book_append_sheet: vi.fn(), write: vi.fn(() => new ArrayBuffer(0)) }))
vi.mock('xlsx', () => ({ utils: xlsx, write: xlsx.write }))
it('uses completed authentic names and exact signed percentage without sums or raw keys', () => {
  const matrix = amgDiscountMatrix(amgResult()); expect(matrix[1]).toEqual(['Клієнт AMG', 'Товар AMG', 'Київ', '-12.34'])
  expect(matrix).toHaveLength(2); expect(amgDiscountCsv(amgResult())).toContain('"-12.34"'); expect(JSON.stringify(matrix)).not.toContain('2'.repeat(32))
})
it('allows complete empty exports and refuses missing or malformed completed results', () => {
  expect(amgDiscountMatrix(amgEmpty())).toHaveLength(1); expect(() => amgDiscountMatrix(amgMissing())).toThrow()
  expect(() => amgDiscountMatrix({ ...amgResult(), MaximumPercentage: '999.99' })).toThrow()
})
it('escapes human CSV formula prefixes while preserving signed numeric cells', () => {
  const v = amgResult(); v.Cells[0].ProductName = '=SUM(A1)'; expect(amgDiscountCsv(v)).toContain('"\'=SUM(A1)"'); expect(amgDiscountCsv(v)).toContain('"-12.34"')
})
it('shares the same exact completed matrix in XLSX and PDF', async () => {
  vi.clearAllMocks(); const result = amgResult(), matrix = amgDiscountMatrix(result); await amgDiscountXlsx(result)
  expect(xlsx.aoa_to_sheet).toHaveBeenCalledWith(matrix)
  expect(JSON.stringify(amgDiscountPdfDefinition(result))).toContain(JSON.stringify(matrix))
})
