import { expect, it } from 'vitest'
import { moneyFlowMeasures, moneyFlowRequest, normalizeMoneyFlow } from './originalMoneyFlowAnalysis'
import { moneyFlowCsv, moneyFlowExportError, moneyFlowFilterSummary, moneyFlowLines, moneyFlowMatrix, moneyFlowPdfDefinition, moneyFlowXlsx } from './originalMoneyFlowAnalysisExport'
import { emptyMoneyFlow, moneyFlowCapability, moneyFlowRef, moneyFlowResponse, unavailableMoneyFlow } from '../testing/originalMoneyFlowAnalysisFixtures'
const full = () => {
  const request = moneyFlowRequest(moneyFlowCapability, '2026-09-10', '2026-09-12', undefined, [...moneyFlowMeasures])
  return normalizeMoneyFlow(moneyFlowResponse(request), request)
}
it('screen, CSV, XLSX and PDF share the complete two-level six-resource result without a pivot', async () => {
  const result = full(), matrix = moneyFlowMatrix(result), lines = moneyFlowLines(result)
  expect(lines).toHaveLength(4); expect(lines[1].cells).toEqual(['Перша організація', 'Оплата', '12.34', '12.34', '0.00', '50.00', '4.00', '46.00'])
  expect(matrix.at(-1)).toEqual(['Разом', '', '0.00', '12.34', '-12.34', '50.00', '4.33', '45.67'])
  expect(moneyFlowCsv(result)).toContain('"0.00","12.34","-12.34","50.00","4.33","45.67"')
  expect(moneyFlowPdfDefinition(result).content.find(item => 'table' in item)?.table.body).toEqual(matrix)
  const blob = await moneyFlowXlsx(result), XLSX = await import('xlsx'), book = XLSX.read(await blob.arrayBuffer(), { type: 'array' })
  expect(XLSX.utils.sheet_to_json(book.Sheets['Аналіз руху коштів'], { header: 1 })).toEqual(matrix)
})
it('exports only selected exact resources and keeps large signed decimals as strings', () => {
  const request = moneyFlowRequest(moneyFlowCapability, '2026-09-10', '2026-09-12', undefined, ['ДенежныйПотокВал'])
  const result = normalizeMoneyFlow(moneyFlowResponse(request), request); result.Totals!.ДенежныйПотокВал = '-1234567890123456789.01'
  expect(moneyFlowMatrix(result)[0]).toEqual(['Організація', 'Стаття руху коштів', 'Денежный поток (вал.)'])
  expect(moneyFlowMatrix(result).at(-1)).toEqual(['Разом', '', '-1234567890123456789.01'])
})
it('exports all organizations and articles beyond the shared screen page', () => {
  const result = full(); result.Rows = Array.from({ length: 40 }, (_, i) => ({ ...structuredClone(result.Rows[0]), Key: moneyFlowRef(i) }))
  expect(moneyFlowLines(result)).toHaveLength(80); expect(moneyFlowMatrix(result)).toHaveLength(82)
})
it('protects formula-like captions while retaining negative stored amounts untouched', () => {
  const result = full(); result.Rows[0].Caption = '=SUM(A1)'; result.Rows[0].Children[0].Caption = '@article'
  const csv = moneyFlowCsv(result); expect(csv).toContain('"\'=SUM(A1)"'); expect(csv).toContain('"\'@article"'); expect(csv).toContain('"-12.34"')
})
it('missing names use stable human ordinals in the same screen and export matrix without raw references', () => {
  const result = full(); result.Rows[0].CaptionAvailable = false; result.Rows[0].Children[0].CaptionAvailable = false
  const line = moneyFlowLines(result)[1]
  expect(line.cells.slice(0, 2)).toEqual(['Організація 1 · назва недоступна', 'Стаття руху коштів 1 · назва недоступна'])
  expect(moneyFlowMatrix(result)[2]).toEqual(line.cells)
  expect(moneyFlowCsv(result)).not.toContain(result.Rows[0].Key)
})
it('empty NULL totals export faithfully; unavailable or oversized results never create partial files', () => {
  expect(moneyFlowMatrix(emptyMoneyFlow()).at(-1)).toEqual(['Разом', '', '—', '—', '—', '—'])
  expect(() => moneyFlowMatrix(unavailableMoneyFlow())).toThrow()
  const result = full(); result.Rows = Array.from({ length: 125_000 }, () => result.Rows[0])
  expect(moneyFlowExportError(result)).toContain('1 000 000'); expect(() => moneyFlowMatrix(result)).toThrow()
})
it('completed filter names and exact identity keys remain bound despite later selection edits', () => {
  const result = full(); result.Selectors.Организация = [moneyFlowRef(1)]
  const csv = moneyFlowCsv(result); expect(moneyFlowFilterSummary(result)).toHaveLength(3)
  expect(csv).toContain(`Перша організація [${moneyFlowRef(1)}]`); expect(csv).toContain('980')
  expect(csv).toContain('без валютного перерахунку'); expect(csv).toContain('1С не підтверджена')
})
