import { expect, it } from 'vitest'
import { cashMovementsRequest, normalizeCashMovements } from './originalCashMovements'
import { cashMovementsCells, cashMovementsCsv, cashMovementsExportError, cashMovementsFilterSummary, cashMovementsLines, cashMovementsMatrix, cashMovementsPdfDefinition, cashMovementsXlsx } from './originalCashMovementsExport'
import { cashKind1, cashMovementsCapability, cashMovementsResponse, emptyCashMovements, unavailableCashMovements } from '../testing/originalCashMovementsFixtures'
const response = () => normalizeCashMovements(cashMovementsResponse(), cashMovementsRequest(cashMovementsCapability, '2026-09-10', '2026-09-12'))
it('screen lines, complete CSV, workbook and PDF retain both resources and every money-kind cell', async () => {
  const result = response(), lines = cashMovementsLines(result), matrix = cashMovementsMatrix(result)
  expect(lines).toHaveLength(8); expect(lines[3].cells).toEqual(['Не задано', 'Прихід', 'Наша каса', 'Оплата', '0.00', '0.00', '0.00', '0.00', '—', '—'])
  expect(lines[7].cells).toEqual(['Валюта джерела', 'Прихід', 'Наш банк', 'Оплата', '-12.34', '45.67', '—', '—', '-12.34', '45.67'])
  expect(cashMovementsCsv(result)).toContain('"-12.34","45.67","—","—","-12.34","45.67"')
  expect(cashMovementsPdfDefinition(result).content.find(item => 'table' in item)?.table.body).toEqual(matrix)
  const blob = await cashMovementsXlsx(result), XLSX = await import('xlsx'), workbook = XLSX.read(await blob.arrayBuffer(), { type: 'array' })
  expect(XLSX.utils.sheet_to_json(workbook.Sheets['Рухи коштів'], { header: 1 })).toEqual(matrix)
  expect(matrix[matrix.length - 1]).toEqual(['Разом', '', '', '', ...cashMovementsCells(result, result.Totals!)])
})
it('exports the whole hierarchy instead of the fifty-row screen page', () => {
  const result = response(); result.Rows = Array.from({ length: 20 }, (_, i) => ({ ...structuredClone(result.Rows[0]), Key: i.toString(16).toUpperCase().padStart(32, '0') }))
  expect(cashMovementsLines(result)).toHaveLength(80); expect(cashMovementsMatrix(result)).toHaveLength(82)
})
it('protects formula-like captions and column headers while leaving signed stored money untouched', () => {
  const result = response(); result.Rows[0].Caption = '=SUM(A1)'; result.Columns[0].Caption = '@kind'
  const csv = cashMovementsCsv(result)
  expect(csv).toContain('"\'=SUM(A1)"'); expect(csv).toContain('"\'@kind · Сумма (оборот)"'); expect(csv).toContain('"-12.34"')
})
it('complete empty retains NULL totals; unavailable never exports a fabricated zero or partial file', () => {
  expect(cashMovementsMatrix(emptyCashMovements()).at(-1)).toEqual(['Разом', '', '', '', '—', '—'])
  expect(cashMovementsExportError(unavailableCashMovements())).not.toBeNull(); expect(() => cashMovementsMatrix(unavailableCashMovements())).toThrow()
})
it('metadata includes all eight complete selected keys and source currency code without ISO or FX inference', () => {
  const result = response(); result.Selectors.ВидДенежныхСредств = [cashKind1]; result.Selectors.БанковскийСчетКасса = result.Choices.БанковскийСчетКасса.map(c => c.Key)
  expect(cashMovementsFilterSummary(result)).toHaveLength(8)
  const csv = cashMovementsCsv(result); expect(csv).toContain('08:0000000F:'); expect(csv).toContain('08:00000038:')
  expect(csv).toContain('980'); expect(csv).toContain('без валютного перерахунку'); expect(csv).toContain('відсутність внеску')
})
