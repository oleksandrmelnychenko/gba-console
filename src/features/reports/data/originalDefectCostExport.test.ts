import { expect, it } from 'vitest'
import { defectCostMeasures } from './originalDefectCost'
import { defectCostCsv, defectCostExportError, defectCostLines, defectCostMatrix, defectCostPdfDefinition, defectCostXlsx } from './originalDefectCostExport'
import { defectCostResponse, defectDivision, defectArticle, emptyDefectCost, missingDefectCost } from '../testing/originalDefectCostFixtures'
it('screen CSV and PDF use one exact default-four matrix with fallback captions and no raw technical labels', () => {
  const result = defectCostResponse(), matrix = defectCostMatrix(result), csv = defectCostCsv(result), pdf = defectCostPdfDefinition(result)
  expect(matrix[0]).toHaveLength(6); expect(matrix[1].slice(2)).toEqual(['-10.00', '30.00', '-4.00', '24.00'])
  expect(defectCostLines(result).map(row => row.cells)).toEqual(matrix.slice(1, -1))
  expect(JSON.stringify(pdf)).toContain('-10.00'); expect(csv).toContain('"-4.00"')
  for (const value of [defectDivision, defectArticle]) { expect(csv).not.toContain(value); expect(JSON.stringify(matrix)).not.toContain(value); expect(JSON.stringify(pdf)).not.toContain(value) }
})
it('optional VAT columns preserve their signed scale and missing data cannot be exported as complete zero', () => {
  expect(defectCostMatrix(defectCostResponse(defectCostMeasures))[0]).toHaveLength(10)
  expect(defectCostMatrix(defectCostResponse(defectCostMeasures))[1]).toContain('-0.80')
  expect(defectCostMatrix(emptyDefectCost())).toHaveLength(2)
  expect(defectCostExportError(missingDefectCost())).not.toBeNull(); expect(() => defectCostCsv(missingDefectCost())).toThrow()
})
it('exports recheck authenticated totals and limit full matrix size before loading workbook code', () => {
  const result = defectCostResponse(); if (result.Totals) result.Totals.КонОст = '23.99'
  expect(() => defectCostMatrix(result)).toThrow()
  const large = defectCostResponse(); large.Rows = Array.from({ length: 100_000 }, () => large.Rows[0])
  expect(defectCostExportError(large)).toContain('1 000 000')
})
it('XLSX retains the shared matrix including wide exact amounts as strings', async () => {
  const result = defectCostResponse()
  const amount = '9007199254740993.01'; result.Rows[0].Articles[0].Values.НачОст = amount; result.Rows[0].Values.НачОст = amount; if (result.Totals) result.Totals.НачОст = amount
  const blob = await defectCostXlsx(result), XLSX = await import('xlsx'), book = XLSX.read(await blob.arrayBuffer(), { type: 'array' })
  const matrix = XLSX.utils.sheet_to_json(book.Sheets['Вартість браку'], { header: 1 })
  expect(matrix).toEqual(defectCostMatrix(result)); expect(JSON.stringify(matrix)).toContain(amount)
})
