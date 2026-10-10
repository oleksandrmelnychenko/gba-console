import { expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { matrixFixture } from '../testing/originalVparivanieFixtures'
import { matrixExcelQuantity, originalMatrixCells, originalMatrixCsv, originalMatrixXlsx } from './originalVparivanieExport'
const accepted = () => ({ ...matrixFixture(), SourceParityVerified: true, OriginalFullTaskAccepted: true })
it('exports every physical row and preserves missing cells instead of filling zeros', () => {
  const rows = originalMatrixCells(accepted())
  expect(rows[1]).toEqual([null, null, '', null, ''])
  expect(rows[3]).toEqual(['Однакова назва', '0', '0', null, null])
  expect(rows[4]).toEqual(['Однакова назва', null, null, '-9007199254740993.125', '-9007199254740993.125'])
})
it('prevents formulas in source captions and region codes without changing signed quantities', () => {
  const result = accepted(); result.Rows[0].Caption = ' =HYPERLINK("https://example.invalid")'
  const csv = originalMatrixCsv(result)
  expect(csv).toContain("' =HYPERLINK")
  expect(csv).toContain('"-9007199254740993.125"')
  expect(csv).not.toContain("'-9007199254740993.125")
})
it.each(['1.250', '-2.125', '0.000', '999999999999999'])('keeps normal quantities numeric without changed decimal text: %s', value => {
  const cell = matrixExcelQuantity(value); expect(cell.t).toBe('n'); expect(cell.v).toBe(Number(value))
})
it.each(['9007199254740993.125', '1234567890123456', '0.0000000000000000000000000001'])('retains quantities outside Excel precision as exact text: %s', value => {
  expect(matrixExcelQuantity(value)).toEqual({ t: 's', v: value })
})
it('xlsx retains sparse cells, numeric zeros, duplicate captions and oversized exact decimals', async () => {
  const blob = await originalMatrixXlsx(accepted())
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.onerror = () => reject(reader.error); reader.readAsArrayBuffer(blob) })
  const book = XLSX.read(buffer, { type: 'array' }), sheet = book.Sheets['Матриця']
  expect(sheet.B4.t).toBe('n'); expect(sheet.B4.v).toBe(0)
  expect(sheet.D4).toBeUndefined(); expect(sheet.B5).toBeUndefined()
  expect(sheet.A4.v).toBe(sheet.A5.v)
  expect(sheet.D5).toMatchObject({ t: 's', v: '-9007199254740993.125' })
  expect(sheet.B2).toBeUndefined(); expect(sheet.C2).toMatchObject({ t: 's', v: '' })
  expect(book.Sheets['Про звіт'].A4.v).toContain('збережено текстом')
})
it('candidate or unavailable result cannot be exported', async () => {
  expect(() => originalMatrixCsv(matrixFixture())).toThrow()
  await expect(originalMatrixXlsx({ ...accepted(), Available: false })).rejects.toThrow()
})
