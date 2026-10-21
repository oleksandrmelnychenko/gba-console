import { expect, it } from 'vitest'
import { currentRegionalCsv, currentRegionalPdf, currentRegionalPdfDefinition,
  currentRegionalSheets, currentRegionalXlsx } from './currentVparivanieRegionalExport'
import { regionalResult } from './currentVparivanieRegional.test-fixtures'
import { CURRENT_VPARIVANIE_PRODUCT_CAPTIONS } from './currentVparivanie'

it('writes the same regional matrix with exact text, separate total and empty-code child to real XLSX/PDF', async () => {
  const value = regionalResult(); value.Rows[0].Name = '=Товар'; value.Rows[0].Cells[3].RegionCode = ''
  const sheets = currentRegionalSheets(value)
  expect(sheets.matrix[3].slice(-2)).toEqual(['Контрагенты', 'Регіон / Без коду'])
  expect(sheets.matrix[3].slice(0, 7)).toEqual([...CURRENT_VPARIVANIE_PRODUCT_CAPTIONS])
  expect(sheets.matrix.flat()).not.toContain('ProductId')
  expect(sheets.matrix[4][0]).toBe(value.Rows[0].Article ?? '')
  expect(sheets.matrix[4].slice(-4)).toEqual(['9007199254740993.00000001', 9.00000001, 9.00000001, 9.00000001])
  expect(sheets.about).toContainEqual(['Період продажів', '2026-10-01 — 2026-10-31'])
  expect(currentRegionalCsv(value)).toContain('"\'=Товар"')
  const XLSX = await import('xlsx'), workbook = XLSX.read(await (await currentRegionalXlsx(value)).arrayBuffer(), { type: 'array' })
  expect(workbook.SheetNames).toEqual(['Звіт', 'Про звіт', 'Клітинки'])
  expect(workbook.Sheets['Звіт'].B5).toMatchObject({ t: 's', v: '=Товар' })
  expect(workbook.Sheets['Звіт'].H5).toMatchObject({ t: 's', v: '9007199254740993.00000001' })
  expect(workbook.Sheets['Про звіт'].A1).toMatchObject({ t: 's', v: 'Аналіз залишків і продажів: регіональна форма' })
  expect(workbook.Sheets['Клітинки'].A1).toMatchObject({ t: 's', v: 'ProductId' })
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
  const tables = currentRegionalPdfDefinition(value).content.filter(part => 'table' in part)
  expect(tables[0]).toHaveProperty('table.body.1.7', 'н/д')
  expect(tables[0]).toHaveProperty('table.body.2.7', 'н/д')
  expect(tables[0]).toHaveProperty('table.body.2.9', '')
  expect(tables[0]).toHaveProperty('table.body.2.10', '')
})

it('labels stock by the anchor the server actually used', () => {
  const value = regionalResult()
  expect(currentRegionalSheets(value).about).toContainEqual(['Залишки', 'Вільний залишок на кінець періоду'])
  expect(currentRegionalPdfDefinition(value).content[1]).toHaveProperty('text', 'Період продажів: 2026-10-01 — 2026-10-31. Залишки на кінець періоду.')
  const legacy = { ...value, StockAnchor: 'CurrentRecordedFree' as const }
  expect(currentRegionalSheets(legacy).about).toContainEqual(['Залишки', 'Поточна записана вільна кількість'])
  expect(currentRegionalPdfDefinition(legacy).content[1]).toHaveProperty('text', 'Період продажів: 2026-10-01 — 2026-10-31. Залишки поточні.')
})

it('writes whole quantities like the 1C workbook: numbers without padded decimals', async () => {
  const value = regionalResult()
  value.Rows[0].Cells[0].Quantity = '2.00000000'; value.Rows[0].Cells[1].Quantity = '-2.50000000'
  value.Rows[0].Cells[2].Quantity = '0.00000000'
  const sheets = currentRegionalSheets(value)
  expect(sheets.matrix[4].slice(-4)).toEqual([2, -2.5, 0, 9.00000001])
  expect(sheets.facts[1][3]).toBe(2)
  expect(currentRegionalCsv(value)).toContain('"2","-2.5","0","9.00000001"')
  const tables = currentRegionalPdfDefinition(value).content.filter(part => 'table' in part)
  expect(tables[0]).toHaveProperty('table.body.1.7', '2')
  const XLSX = await import('xlsx'), workbook = XLSX.read(await (await currentRegionalXlsx(value)).arrayBuffer(), { type: 'array' })
  expect(workbook.Sheets['Звіт'].H5).toMatchObject({ t: 'n', v: 2 })
  expect(workbook.Sheets['Звіт'].I5).toMatchObject({ t: 'n', v: -2.5 })
}, 30_000)
