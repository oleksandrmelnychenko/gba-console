import { expect, it } from 'vitest'
import { currentRegionalCsv, currentRegionalPdf, currentRegionalPdfDefinition,
  currentRegionalSheets, currentRegionalXlsx } from './currentVparivanieRegionalExport'
import { regionalResult } from './currentVparivanieRegional.test-fixtures'

it('writes the same regional matrix with exact text, separate total and empty-code child to real XLSX/PDF', async () => {
  const value = regionalResult(); value.Rows[0].Name = '=Товар'; value.Rows[0].Cells[3].RegionCode = ''
  const sheets = currentRegionalSheets(value)
  expect(sheets.matrix[3].slice(-2)).toEqual(['Контрагенты', 'Регіон / Без коду'])
  expect(sheets.matrix[4].slice(-4)).toEqual(['9007199254740993.00000001', '9.00000001', '9.00000001', '9.00000001'])
  expect(sheets.about).toContainEqual(['Період продажів', '2026-10-01 — 2026-10-31'])
  expect(currentRegionalCsv(value)).toContain('"\'=Товар"')
  const XLSX = await import('xlsx'), workbook = XLSX.read(await (await currentRegionalXlsx(value)).arrayBuffer(), { type: 'array' })
  expect(workbook.SheetNames).toEqual(['Matrix', 'About', 'Cells'])
  expect(workbook.Sheets.Matrix.C5).toMatchObject({ t: 's', v: '=Товар' })
  expect(workbook.Sheets.Matrix.I5).toMatchObject({ t: 's', v: '9007199254740993.00000001' })
  const tables = currentRegionalPdfDefinition(value).content.filter(part => 'table' in part)
  expect(tables[0]).toHaveProperty('table.body.1.7', '9007199254740993.00000001')
  const pdf = await currentRegionalPdf(value)
  expect(pdf.type).toBe('application/pdf'); expect(await pdf.slice(0, 8).text()).toBe('%PDF-1.3')
}, 30_000)

it('preserves an explicit unknown quantity independently of an absent regional contribution', () => {
  const value = regionalResult(); value.Rows[0].Cells[0].Quantity = null; value.Rows[0].Cells[0].UnitId = null
  value.Rows.push({ ...value.Rows[0], ProductId: '2', Cells: value.Rows[0].Cells.slice(0, 2) }); value.ProductCount = 2
  const rows = currentRegionalSheets(value).matrix
  expect(rows[4].at(-4)).toBe('∅'); expect(rows[5].slice(-2)).toEqual(['', ''])
})
