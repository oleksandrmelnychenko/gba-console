import { expect, it } from 'vitest'
import { fenixCapability, fenixEmpty, fenixMissing, fenixProduct, fenixResult, fenixScope, fenixUnresolved } from '../testing/originalFenixDiscountAnalysisFixtures'
import { fenixDiscountDateError, fenixDiscountIndex, fenixDiscountValues, normalizeFenixDiscountCapability, normalizeFenixDiscountResult, validateFenixDiscountRequest } from './originalFenixDiscountAnalysis'
it('distinguishes implementation capability from current input readiness and rejects foreign default policies', () => {
  expect(fenixCapability.Executable).toBe(true); expect(fenixCapability.NormalInputsReadinessVerified).toBe(false)
  expect(() => normalizeFenixDiscountCapability({ ...fenixCapability, DefaultMeasures: ['ПроцентСкидкиНаценки'] })).toThrow()
  expect(() => normalizeFenixDiscountCapability({ ...fenixCapability, HumanChoicesAvailable: true })).toThrow()
})
it.each(['World', 'SourceId', 'DefinitionSha256', 'Through', 'Products', 'Counterparties'])('rejects a changed own result echo %s', field => {
  const result = fenixResult(), wrong = field === 'World' ? 'amg' : field === 'Through' ? '2026-10-01' : field === 'SourceId' ? '56e2ad4b-9f75-4461-a742-eb54ae01823f' : field === 'DefinitionSha256' ? 'f'.repeat(64) : [fenixProduct]
  expect(() => normalizeFenixDiscountResult({ ...result, [field]: wrong }, fenixScope())).toThrow()
})
it('accepts complete empty data and preserves missing input as unavailable rather than empty success', () => {
  expect(normalizeFenixDiscountResult(fenixEmpty(), fenixScope()).Available).toBe(true)
  expect(normalizeFenixDiscountResult(fenixMissing(), fenixScope()).Available).toBe(false)
  expect(() => normalizeFenixDiscountResult({ ...fenixMissing(), OurSnapshotVerified: true }, fenixScope())).toThrow()
})
it('keeps exact signed three-place numbers and a genuine sole reference caption as different supported types', () => {
  const result = fenixResult(); expect(normalizeFenixDiscountResult(result, fenixScope()).Cells[0].Percentage).toBe('-12.340')
  result.Cells[0].Percentage = null; result.Cells[0].PercentageRef = '7'.repeat(32); result.Cells[0].PercentageReferenceCaption = 'Договірна ціна'
  expect(fenixDiscountValues(normalizeFenixDiscountResult(result, fenixScope()).Cells[0])).toEqual(['Роздрібна', 'Договірна ціна'])
})
it('retains unresolved multiple prices and typed empty percentage without choosing a winner or numeric zero', () => {
  const result = fenixUnresolved(), cell = result.Cells[0]
  cell.PercentageAvailable = false; cell.Percentage = null; cell.PercentageRef = '0'.repeat(32); cell.MissingPercentage = 'percentage_empty_reference_presentation_unverified'
  expect(fenixDiscountValues(normalizeFenixDiscountResult(result, fenixScope()).Cells[0])).toEqual(['Недоступно', 'Недоступно'])
  cell.Percentage = '0.000'; expect(() => normalizeFenixDiscountResult(result, fenixScope())).toThrow()
})
it('rejects duplicate cells, conflicting captions, malformed numeric values and unsupported readiness claims', () => {
  const result = fenixResult(); result.Cells.push(structuredClone(result.Cells[0])); expect(() => normalizeFenixDiscountResult(result, fenixScope())).toThrow()
  result.Cells[1].ProductRef = '8'.repeat(32); result.Cells[1].CounterpartyCaption = 'Інша назва'; expect(() => normalizeFenixDiscountResult(result, fenixScope())).toThrow()
  expect(() => normalizeFenixDiscountResult({ ...fenixResult(), SourceParityVerified: true }, fenixScope())).toThrow()
  const bad = fenixResult(); bad.Cells[0].Percentage = '-0.000'; expect(() => normalizeFenixDiscountResult(bad, fenixScope())).toThrow()
})
it('validates dates and exact detached uppercase reference scopes without inventing named choice authority', () => {
  expect(fenixDiscountDateError('2024-02-29')).toBeNull(); expect(fenixDiscountDateError('2025-02-29')).not.toBeNull()
  expect(() => validateFenixDiscountRequest({ ...fenixScope(), Products: ['a'.repeat(32)] })).toThrow()
  expect(() => validateFenixDiscountRequest({ ...fenixScope(), ChoicesWitnessSha256: 'bad' })).toThrow()
  expect(validateFenixDiscountRequest({ ...fenixScope(), ChoicesWitnessSha256: 'a'.repeat(64) }).ChoicesWitnessSha256).toBe('a'.repeat(64))
  const raw = { ...fenixScope(), Products: ['F'.repeat(32), 'A'.repeat(32)] }, detached = validateFenixDiscountRequest(raw); raw.Products.length = 0
  expect(detached.Products).toEqual(['A'.repeat(32), 'F'.repeat(32)])
})
it('indexes absent cross-products as blank cells and never uses raw references as display captions', () => {
  const result = fenixResult(), next = structuredClone(result.Cells[0]); next.CounterpartyRef = '9'.repeat(32); next.CounterpartyCaption = 'Другий клієнт'
  next.ProductRef = 'A'.repeat(32); next.ProductCaption = 'Другий товар'; result.Cells.push(next)
  const index = fenixDiscountIndex(normalizeFenixDiscountResult(result, fenixScope()))
  expect(index.parties).toHaveLength(2); expect(index.products).toHaveLength(2)
  expect(fenixDiscountValues(index.cells.get(JSON.stringify([index.parties[0].key, index.products[1].key])))).toEqual(['', ''])
})
