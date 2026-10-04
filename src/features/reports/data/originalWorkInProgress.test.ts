import { expect, it } from 'vitest'
import { isWipCapability, normalizeWip, wipDefaults, wipMeasures, wipRequest } from './originalWorkInProgress'
import { wipCapability, wipRef, wipResult, wipWire } from '../testing/originalWorkInProgressFixtures'
import { wipCsv, wipLines, wipMatrix, wipPdfDefinition, wipXlsx } from './originalWorkInProgressExport'
it('own f494 default four optional five and typed three selectors do not borrow another world', () => {
  expect(isWipCapability(wipCapability)).toBe(true); expect(wipDefaults).toHaveLength(4); expect(wipMeasures).toHaveLength(9)
  expect(isWipCapability({ ...wipCapability, World: 'amg' })).toBe(false)
  expect(() => wipRequest(wipCapability, '2026-09-01', '2026-09-30', { Divisions: [wipRef(1), wipRef(1)], ProductGroups: [], CostArticles: [] })).toThrow()
})
it('three union lanes keep undefined article and all nine exact additive cells in the same hierarchy matrix', () => {
  const request = wipWire(true), result = normalizeWip(wipResult(request), request)
  expect(result.Rows[0].ProductGroups[0].Articles.map(a => a.CostArticle)).toEqual([null, wipRef(3)])
  expect(wipLines(result).at(-1)?.cells.slice(3)).toEqual(['0.00', '0.00', '0.00', '0.00', '3.000', '2.00', '0.40', '0.00', '0.00'])
  expect(wipMatrix(result).at(-1)?.slice(3)).toEqual(['10.00', '2.00', '0.00', '0.00', '3.000', '2.00', '0.40', '8.00', '1.60'])
})
it('all three filter echoes reject a different complete or empty response under current selections', () => {
  const request = { ...wipWire(), Divisions: [wipRef(1)], ProductGroups: [wipRef(2)], CostArticles: [wipRef(3)] }
  for (const key of ['Divisions', 'ProductGroups', 'CostArticles'] as const) expect(() => normalizeWip({ ...wipResult(request), [key]: [] }, request)).toThrow()
  expect(() => normalizeWip({ ...wipResult(request), Rows: [], Totals: Object.fromEntries(request.Measures.map(m => [m, '0.00'])), Divisions: [] }, request)).toThrow()
})
it('article selection excludes undefined balances without narrowing the human chooser universe', () => {
  const request = { ...wipWire(true), CostArticles: [wipRef(3)] }, result = normalizeWip(wipResult(request), request)
  expect(result.Rows[0].ProductGroups[0].Articles).toHaveLength(1); expect(result.Totals?.НачОст).toBe('0.00'); expect(result.Totals?.КонОст).toBe('0.00')
  expect(result.Choices.Подразделение[0].Caption).toBe('Наш підрозділ'); expect(result.Totals?.НоменклатураЗатратКоличество).toBe('3.000')
})
it('partial or forged additive group and totals cannot display or export an admitted matrix', () => {
  const request = wipWire(), result = wipResult(request)
  expect(() => normalizeWip({ ...result, Totals: { ...result.Totals, НачОст: '9.00' } }, request)).toThrow()
  const forged = structuredClone(result); forged.Rows[0].ProductGroups[0].Articles[0].Values.НачОст = '9.00'
  expect(() => normalizeWip(forged, request)).toThrow()
})
it('exact signed wide resource strings retain precision above JavaScript safe integers and scale', () => {
  const request = wipWire(), result = wipResult(request), number = '-900719925474099300000000000000.01'
  result.Rows[0].Values.НачОст = number; result.Rows[0].ProductGroups[0].Values.НачОст = number; result.Rows[0].ProductGroups[0].Articles[0].Values.НачОст = number; result.Totals!.НачОст = number
  expect(normalizeWip(result, request).Totals?.НачОст).toBe(number)
  expect(() => normalizeWip({ ...result, Totals: { ...result.Totals, НачОст: '-0.00' } }, request)).toThrow()
})
it('known empty complete response differs from missing ordinary input and never invents zero partial amounts', () => {
  const request = { ...wipWire(), Divisions: [wipRef(999)] }, result = wipResult(request)
  expect(normalizeWip(result, request).Rows).toEqual([]); expect(result.Totals?.НачОст).toBe('0.00')
  const missing = { ...result, Available: false, NormalInputsComplete: false, Code: 'original_work_in_progress_month_publication_unavailable', Rows: [], Totals: null, InputWitnessSha256: null, ResultSha256: null, Choices: { Подразделение: [], НоменклатурнаяГруппа: [], СтатьяЗатрат: [] }, Dependency: { Kind: 'month_publication_unavailable', MissingMonth: '2026-09-01' } }
  expect(normalizeWip(missing, request).Totals).toBeNull(); expect(() => wipMatrix(missing)).toThrow()
})
it('csv xlsx and pdf retain the complete same hierarchical matrix and native quantity note', async () => {
  const result = wipResult(wipWire(true)), matrix = wipMatrix(result), pdf = wipPdfDefinition(result)
  expect(pdf.content.find(c => 'table' in c)?.table?.body).toEqual(matrix); expect(wipCsv(result)).toContain('Кількість матеріалів'); expect(wipCsv(result)).toContain('"3.000"')
  const XLSX = await import('xlsx'), book = XLSX.read(await (await wipXlsx(result)).arrayBuffer(), { type: 'array' })
  expect(XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1 })).toEqual(matrix)
})
it('unresolved and conflicting names remain separate typed hierarchy keys while csv neutralizes formula captions only', () => {
  const result = wipResult(); result.Rows[0].Caption = '=SUM(1)'; result.Rows[0].CaptionAvailable = false
  expect(wipCsv(result)).toContain("'=SUM(1)"); expect(wipCsv(result)).toContain('"10.00"'); expect(wipLines(result)[0].key).toContain(wipRef(1))
})
