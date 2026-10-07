import { expect, it } from 'vitest'
import { defectCostRequest, normalizeDefectCost, normalizeDefectCostChoices } from './originalDefectCost'
import { defectCostCsv, defectCostFilterSummary, defectCostMatrix, defectCostPdfDefinition, defectCostXlsx } from './originalDefectCostExport'
import { defectCostCapability, defectCostChoices, defectCostResponse, defectDivision, defectArticle, namedDefectCost } from '../testing/originalDefectCostFixtures'
const request = () => defectCostRequest(defectCostCapability, '2026-09-10', '2026-09-12')
it('distinguishes complete empty typed metadata from absent metadata without inventing options', () => {
  const complete = defectCostChoices(request()); complete.Choices = { Подразделение: [], СтатьяЗатрат: [] }
  expect(normalizeDefectCostChoices(complete, request()).Available).toBe(true)
  const missing = { ...complete, Available: false, MissingFamilies: ['Подразделение', 'СтатьяЗатрат'], NamedChoicesWitnessSha256: null,
    Dependency: { Kind: 'named_catalogue_publication_unavailable', MissingMonth: null } }
  expect(normalizeDefectCostChoices(missing, request()).NormalInputsComplete).toBe(true)
  expect(normalizeDefectCostChoices(missing, request()).Available).toBe(false)
})
it('keeps the same binary reference separate for Division and CostArticle names', () => {
  const scope = request(), names = defectCostChoices(scope); names.Choices.СтатьяЗатрат[0].Key = defectDivision
  expect(normalizeDefectCostChoices(names, scope).Choices.СтатьяЗатрат[0]).toMatchObject({ Caption: 'Потери', TableReference: '00000081', Key: defectDivision })
  const result = namedDefectCost(scope); result.Choices.СтатьяЗатрат[0].Key = defectDivision; result.Rows[0].Articles[0].CostArticle = defectDivision
  expect(normalizeDefectCost(result, scope).Rows[0].Articles[0].Caption).toBe('Потери')
  expect(normalizeDefectCost(result, scope).Rows[0].Caption).toBe('Цех')
})
it.each(['field', 'tref', 'type', 'caption', 'duplicate'])('refuses malformed named catalogue %s evidence', fault => {
  const names = defectCostChoices(request()), row = names.Choices.Подразделение[0]
  const bad = fault === 'field' ? { ...row, Field: 'СтатьяЗатрат' } : fault === 'tref' ? { ...row, TableReference: '00000081' }
    : fault === 'type' ? { ...row, Type: '09' } : fault === 'caption' ? { ...row, Caption: ' ' } : row
  const value = { ...names, Choices: { ...names.Choices, Подразделение: fault === 'duplicate' ? [row, row] : [bad] } }
  expect(() => normalizeDefectCostChoices(value, request())).toThrow()
})
it('checks echoed period selectors resources and normal-parent absence on scoped choices', () => {
  const names = defectCostChoices(request())
  expect(() => normalizeDefectCostChoices({ ...names, Through: '2026-09-13' }, request())).toThrow()
  expect(() => normalizeDefectCostChoices({ ...names, Divisions: [defectDivision] }, request())).toThrow()
  expect(() => normalizeDefectCostChoices({ ...names, Measures: ['КонОст'] }, request())).toThrow()
  expect(() => normalizeDefectCostChoices({ ...names, NormalInputsComplete: false }, request())).toThrow()
  expect(() => normalizeDefectCostChoices({ ...names, Available: false }, request())).toThrow()
})
it('refuses a filtered result from missing stale or foreign-family names before display', () => {
  const scope = defectCostRequest(defectCostCapability, '2026-09-10', '2026-09-12', [defectDivision], [defectArticle], undefined, 'd'.repeat(64))
  const result = namedDefectCost(scope)
  expect(normalizeDefectCost(result, scope).HumanChoicesAvailable).toBe(true)
  expect(() => normalizeDefectCost(result, { ...scope, NamedChoicesWitnessSha256: 'e'.repeat(64) })).toThrow()
  expect(() => normalizeDefectCost(result, { ...scope, NamedChoicesWitnessSha256: null })).toThrow()
  const missing = { ...defectCostResponse(), ...scope }; expect(() => normalizeDefectCost(missing, scope)).toThrow()
  const foreign = structuredClone(result); foreign.Choices.Подразделение[0].Key = defectArticle
  expect(() => normalizeDefectCost(foreign, scope)).toThrow()
})
it('unfiltered amounts remain valid with missing names and never present raw keys as labels', () => {
  const result = normalizeDefectCost(defectCostResponse(), request())
  expect(result.Available).toBe(true); expect(result.HumanChoicesAvailable).toBe(false)
  expect(defectCostCsv(result)).not.toContain(defectDivision); expect(defectCostCsv(result)).not.toContain(defectArticle)
})
it('binds every displayed caption to the completed typed choice rather than accepting a foreign label', () => {
  const result = namedDefectCost(request()); result.Rows[0].Caption = 'Потери'
  expect(() => normalizeDefectCost(result, request())).toThrow()
  const wrongFlag = namedDefectCost(request()); wrongFlag.Rows[0].Articles[0].CaptionAvailable = false
  expect(() => normalizeDefectCost(wrongFlag, request())).toThrow()
})
it('detaches completed names and keeps CSV PDF and workbook captions and wide amounts identical', async () => {
  const scope = defectCostRequest(defectCostCapability, '2026-09-10', '2026-09-12', [defectDivision], [defectArticle], undefined, 'd'.repeat(64))
  const wire = namedDefectCost(scope), wide = '9007199254740993.01'
  wire.Rows[0].Values.НачОст = wide; wire.Rows[0].Articles[0].Values.НачОст = wide; if (wire.Totals) wire.Totals.НачОст = wide
  const completed = normalizeDefectCost(wire, scope)
  wire.Choices.Подразделение[0].Caption = 'Later name'; scope.Divisions.splice(0)
  expect(completed.Rows[0].Caption).toBe('Цех'); expect(defectCostFilterSummary(completed)).toEqual(['Підрозділи: Цех', 'Статті витрат: Потери'])
  const matrix = defectCostMatrix(completed), csv = defectCostCsv(completed), pdf = defectCostPdfDefinition(completed)
  expect(matrix[1][0]).toBe('Цех'); expect(matrix[2][1]).toBe('Потери'); expect(csv).toContain('Цех'); expect(csv).toContain(wide)
  expect(JSON.stringify(pdf)).toContain('Потери'); expect(JSON.stringify(pdf)).not.toContain('Later name')
  const blob = await defectCostXlsx(completed), XLSX = await import('xlsx'), book = XLSX.read(await blob.arrayBuffer(), { type: 'array' })
  expect(XLSX.utils.sheet_to_json(book.Sheets['Вартість браку'], { header: 1 })).toEqual(matrix)
})
it('escapes formula-like human captions in CSV without changing signed resource strings', () => {
  const result = namedDefectCost(request()); result.Choices.Подразделение[0].Caption = '=SUM(A1)'; result.Rows[0].Caption = '=SUM(A1)'
  const csv = defectCostCsv(result); expect(csv).toContain('"\'=SUM(A1)"'); expect(csv).toContain('"-4.00"')
})
