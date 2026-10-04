import { expect, it } from 'vitest'
import { defectCostCapability, defectCostResponse, defectDivision, defectArticle, emptyDefectCost, missingDefectCost } from '../testing/originalDefectCostFixtures'
import { defectCostCents, defectCostDefaultMeasures, defectCostMeasures, defectCostPeriodError, defectCostRequest, isDefectCostCapability, normalizeDefectCost } from './originalDefectCost'
const request = () => defectCostRequest(defectCostCapability, '2026-09-10', '2026-09-12')
it('preserves original four default cost measures and all four optional VAT measures without invented readiness', () => {
  expect(isDefectCostCapability(defectCostCapability)).toBe(true)
  expect(request().Measures).toEqual(defectCostDefaultMeasures)
  expect(defectCostRequest(defectCostCapability, '2026-09-10', '2026-09-12', [], [], defectCostMeasures).Measures).toEqual(defectCostMeasures)
  expect(isDefectCostCapability({ ...defectCostCapability, NormalInputsReadinessVerified: true })).toBe(false)
  expect(isDefectCostCapability({ ...defectCostCapability, HumanChoicesAvailable: true })).toBe(false)
})
it('copies both typed filters and canonicalizes selected resource order without mutating caller arrays', () => {
  const divisions = ['F'.repeat(32), defectDivision], articles = [defectArticle]
  const value = defectCostRequest(defectCostCapability, '2026-09-10', '2026-09-12', divisions, articles, ['КонОст', 'НачОст'])
  expect(value.Divisions).toEqual([defectDivision, 'F'.repeat(32)]); expect(value.Measures).toEqual(['НачОст', 'КонОст'])
  divisions.splice(0); articles.splice(0); expect(value.CostArticles).toEqual([defectArticle]); expect(value.Divisions).toHaveLength(2)
})
it('refuses invalid dates duplicate references zero resources and duplicate resources before generation', () => {
  expect(defectCostPeriodError('2026-02-30', '2026-03-01')).not.toBeNull()
  expect(defectCostPeriodError('2026-09-10', '2027-09-10')).not.toBeNull()
  expect(() => defectCostRequest(defectCostCapability, '2026-09-10', '2026-09-12', [defectDivision, defectDivision])).toThrow()
  expect(() => defectCostRequest(defectCostCapability, '2026-09-10', '2026-09-12', [], [], [])).toThrow()
  expect(() => defectCostRequest(defectCostCapability, '2026-09-10', '2026-09-12', [], [], ['НачОст', 'НачОст'])).toThrow()
})
it('binds complete and missing results to both filters and the current measure selection', () => {
  const selected = defectCostRequest(defectCostCapability, '2026-09-10', '2026-09-12', [defectDivision], [defectArticle])
  expect(() => normalizeDefectCost(defectCostResponse(), selected)).toThrow()
  expect(() => normalizeDefectCost(missingDefectCost(), selected)).toThrow()
  expect(() => normalizeDefectCost(defectCostResponse(defectCostMeasures), request())).toThrow()
})
it('preserves exact signed strings and rejects wrong subtotal or grand total despite valid witnesses', () => {
  const result = defectCostResponse(); expect(normalizeDefectCost(result, request()).Totals?.Расход).toBe('-4.00')
  result.Rows[0].Values.НачОст = '-9.99'; expect(() => normalizeDefectCost(result, request())).toThrow()
  const wrongTotal = defectCostResponse(); if (wrongTotal.Totals) wrongTotal.Totals.Приход = '30.01'
  expect(() => normalizeDefectCost(wrongTotal, request())).toThrow()
})
it('checks selected row membership and duplicate complete hierarchy keys', () => {
  const result = defectCostResponse(); result.Divisions = [defectDivision]; result.CostArticles = [defectArticle]
  const selected = defectCostRequest(defectCostCapability, result.From, result.Through, result.Divisions, result.CostArticles)
  result.Rows[0].Articles[0].CostArticle = 'C'.repeat(32); expect(() => normalizeDefectCost(result, selected)).toThrow()
  const duplicate = defectCostResponse(); duplicate.Rows[0].Articles.push(structuredClone(duplicate.Rows[0].Articles[0])); expect(() => normalizeDefectCost(duplicate, request())).toThrow()
})
it('keeps complete zero distinct from absent opening or month without fabricating a zero balance', () => {
  expect(normalizeDefectCost(emptyDefectCost(), request()).Totals).toEqual({ НачОст: '0.00', Приход: '0.00', Расход: '0.00', КонОст: '0.00' })
  const missing = missingDefectCost(); expect(normalizeDefectCost(missing, request()).Totals).toBeNull()
  missing.Totals = emptyDefectCost().Totals; expect(() => normalizeDefectCost(missing, request())).toThrow()
})
it('retains amounts beyond Number precision and refuses noncanonical monetary strings', () => {
  expect(defectCostCents('9007199254740993.01')).toBe(900719925474099301n)
  for (const value of ['-0.00', '1', '01.00', '1.000', '+1.00', '1e3']) expect(() => defectCostCents(value)).toThrow()
  const result = defectCostResponse(); const wide = '9007199254740993.01'
  result.Rows[0].Articles[0].Values.НачОст = wide; result.Rows[0].Values.НачОст = wide; if (result.Totals) result.Totals.НачОст = wide
  expect(normalizeDefectCost(result, request()).Totals?.НачОст).toBe(wide)
})
it('does not infer FX currency native dates registrar totals or zero suppression from a complete normal result', () => {
  for (const flag of ['AppliesFxConversion', 'ManagementCurrencyPresentationVerified', 'NativeDateParametersVerified', 'NativeVirtualRegistrarTotalsVerified', 'NativeZeroGroupSuppressionVerified', 'SourceParityVerified'])
    expect(() => normalizeDefectCost({ ...defectCostResponse(), [flag]: true }, request())).toThrow()
})
