import { expect, it } from 'vitest'
import { amgCapability, amgEmpty, amgMissing, amgProduct, amgResult, amgScope, amgUnresolved } from '../testing/originalAmgDiscountAnalysisFixtures'
import { amgDiscountAnalysisDateError, amgDiscountAnalysisIndex, amgDiscountAnalysisValues, normalizeAmgDiscountAnalysisCapability, normalizeAmgDiscountAnalysisResult, validateAmgDiscountAnalysisRequest } from './originalAmgDiscountAnalysis'
it('distinguishes implementation capability from current input readiness and rejects foreign default policies', () => {
  expect(amgCapability.Executable).toBe(true); expect(amgCapability.NormalInputsReadinessVerified).toBe(false)
  expect(() => normalizeAmgDiscountAnalysisCapability({ ...amgCapability, DefaultMeasures: ['ПроцентСкидкиНаценки'] })).toThrow()
  expect(() => normalizeAmgDiscountAnalysisCapability({ ...amgCapability, HumanChoicesAvailable: true })).toThrow()
})
it.each(['World', 'SourceId', 'DefinitionSha256', 'Through', 'Products', 'Counterparties'])('rejects a changed own result echo %s', field => {
  const result = amgResult(), wrong = field === 'World' ? 'fenix' : field === 'Through' ? '2026-10-01' : field === 'SourceId' ? '56e2ad4b-9f75-4461-a742-eb54ae01823f' : field === 'DefinitionSha256' ? 'f'.repeat(64) : [amgProduct]
  expect(() => normalizeAmgDiscountAnalysisResult({ ...result, [field]: wrong }, amgScope())).toThrow()
})
it('accepts complete empty data and preserves missing input as unavailable rather than empty success', () => {
  expect(normalizeAmgDiscountAnalysisResult(amgEmpty(), amgScope()).Available).toBe(true)
  expect(normalizeAmgDiscountAnalysisResult(amgMissing(), amgScope()).Available).toBe(false)
  expect(() => normalizeAmgDiscountAnalysisResult({ ...amgMissing(), OurSnapshotVerified: true }, amgScope())).toThrow()
})
it('keeps exact signed three-place numbers and a genuine sole reference caption as different supported types', () => {
  const result = amgResult(); expect(normalizeAmgDiscountAnalysisResult(result, amgScope()).Cells[0].Percentage).toBe('-12.340')
  result.Cells[0].Percentage = null; result.Cells[0].PercentageRef = '7'.repeat(32); result.Cells[0].PercentageReferenceCaption = 'Договірна ціна'
  expect(amgDiscountAnalysisValues(normalizeAmgDiscountAnalysisResult(result, amgScope()).Cells[0])).toEqual(['Роздрібна', 'Договірна ціна'])
})
it('retains unresolved multiple prices and typed empty percentage without choosing a winner or numeric zero', () => {
  const result = amgUnresolved(), cell = result.Cells[0]
  cell.PercentageAvailable = false; cell.Percentage = null; cell.PercentageRef = '0'.repeat(32); cell.MissingPercentage = 'percentage_empty_reference_presentation_unverified'
  expect(amgDiscountAnalysisValues(normalizeAmgDiscountAnalysisResult(result, amgScope()).Cells[0])).toEqual(['Недоступно', 'Недоступно'])
  cell.Percentage = '0.000'; expect(() => normalizeAmgDiscountAnalysisResult(result, amgScope())).toThrow()
})
it('rejects duplicate cells, conflicting captions, malformed numeric values and unsupported readiness claims', () => {
  const result = amgResult(); result.Cells.push(structuredClone(result.Cells[0])); expect(() => normalizeAmgDiscountAnalysisResult(result, amgScope())).toThrow()
  result.Cells[1].ProductRef = '8'.repeat(32); result.Cells[1].CounterpartyCaption = 'Інша назва'; expect(() => normalizeAmgDiscountAnalysisResult(result, amgScope())).toThrow()
  expect(() => normalizeAmgDiscountAnalysisResult({ ...amgResult(), SourceParityVerified: true }, amgScope())).toThrow()
  const bad = amgResult(); bad.Cells[0].Percentage = '-0.000'; expect(() => normalizeAmgDiscountAnalysisResult(bad, amgScope())).toThrow()
})
it('validates dates and exact detached uppercase reference scopes without inventing named choice authority', () => {
  expect(amgDiscountAnalysisDateError('2024-02-29')).toBeNull(); expect(amgDiscountAnalysisDateError('2025-02-29')).not.toBeNull()
  expect(() => validateAmgDiscountAnalysisRequest({ ...amgScope(), Products: ['a'.repeat(32)] })).toThrow()
  expect(() => validateAmgDiscountAnalysisRequest({ ...amgScope(), ChoicesWitnessSha256: 'bad' })).toThrow()
  expect(() => validateAmgDiscountAnalysisRequest({ ...amgScope(), ChoicesWitnessSha256: 'a'.repeat(64) })).toThrow()
  const raw = { ...amgScope(), Products: ['F'.repeat(32), 'A'.repeat(32)] }, detached = validateAmgDiscountAnalysisRequest(raw); raw.Products.length = 0
  expect(detached.Products).toEqual(['A'.repeat(32), 'F'.repeat(32)])
})
it('indexes absent cross-products as blank cells and never uses raw references as display captions', () => {
  const result = amgResult(), next = structuredClone(result.Cells[0]); next.CounterpartyRef = '9'.repeat(32); next.CounterpartyCaption = 'Другий клієнт'
  next.ProductRef = 'A'.repeat(32); next.ProductCaption = 'Другий товар'; result.Cells.push(next)
  const index = amgDiscountAnalysisIndex(normalizeAmgDiscountAnalysisResult(result, amgScope()))
  expect(index.parties).toHaveLength(2); expect(index.products).toHaveLength(2)
  expect(amgDiscountAnalysisValues(index.cells.get(JSON.stringify([index.parties[0].key, index.products[1].key])))).toEqual(['', ''])
})

it('authenticates the own missing-result hash and refuses a borrowed Fenix unavailable code', () => {
  expect(normalizeAmgDiscountAnalysisResult(amgMissing(), amgScope()).ResultSha256).toBe('c'.repeat(64))
  expect(() => normalizeAmgDiscountAnalysisResult({ ...amgMissing(), ResultSha256: null }, amgScope())).toThrow()
  expect(() => normalizeAmgDiscountAnalysisResult({ ...amgMissing(), Code: 'original_discount_analysis_input_unavailable' }, amgScope())).toThrow()
})
