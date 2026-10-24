import { expect, it } from 'vitest'
import { defaultSheetBlob, defaultSheetCsv, defaultSheetExportError, type OriginalDefaultSheet } from './originalDefaultReportExport'
const sheet = (): OriginalDefaultSheet => ({ title: 'Звіт за клієнтами', from: '2026-10-01', through: '2026-10-04', note: 'Без перерахунку',
  headers: ['Назва', 'Сума', 'Кількість'], labelColumns: 1, lines: [{ key: 'hidden-reference', cells: ['=Записана назва', '-2.00', '1.250'] }], total: ['Разом', '-2.00', '1.250'] })
it('CSV protects real label formulas while exact signed amount and quantity strings remain unchanged and no key is exported', () => {
  const csv = defaultSheetCsv(sheet())
  expect(csv).toContain('"\'=Записана назва","-2.00","1.250"'); expect(csv).not.toContain('hidden-reference')
  expect(csv).toContain('"Разом","-2.00","1.250"')
})
it('export refuses the complete oversized matrix rather than silently truncating displayed pages', () => {
  const result = sheet(); result.lines = Array.from({ length: 333_334 }, (_, index) => ({ key: String(index), cells: ['Назва', '0.00', '0.000'] }))
  expect(defaultSheetExportError(result)).not.toBeNull(); expect(() => defaultSheetCsv(result)).toThrow()
})

it('the real PDF engine cannot mutate any header, data or total cell of the accepted sheet', async () => {
  const result = sheet(), before = structuredClone(result), csv = defaultSheetCsv(result)
  const pdf = await defaultSheetBlob(result, 'pdf')
  expect(pdf.size).toBeGreaterThan(0)
  expect(result).toEqual(before)
  expect(defaultSheetCsv(result)).toBe(csv)
}, 20_000)
